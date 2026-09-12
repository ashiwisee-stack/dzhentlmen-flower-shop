import { sameOrigin } from "@/lib/security";
import { eq, max } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-auth";
import { DEFAULT_PRODUCTS, type Product, type ProductVariant } from "@/lib/catalog";
import { listProducts, rowToProduct } from "@/lib/product-storage";
import { readStoreData } from "@/lib/store-storage";

export async function GET(request: Request) {
  try {
    const includeHidden = new URL(request.url).searchParams.get("admin") === "1";
    if (includeHidden) {
      const auth = await requireAdminApi();
      if (!auth.ok) return auth.response;
    }
    return Response.json({ products: await listProducts(includeHidden) }, {headers:{"cache-control":"no-store"}});
  } catch (error) {
    console.error("products:list", error);
    return Response.json({ products: DEFAULT_PRODUCTS.filter((item) => !item.hidden), storageUnavailable: true });
  }
}

function normalizeProduct(payload: Partial<Product> & { pricingMode?: "single" | "variants" }) {
  const name = String(payload.name ?? "").trim();
  const category = String(payload.category ?? "").trim();
  const images = Array.isArray(payload.images) ? payload.images.map(String).map((value) => value.trim()).filter(Boolean) : [];
  const image = String(payload.image ?? images[0] ?? "").trim();
  const single = payload.pricingMode === "single" || payload.singleFlower === true;
  const variants = (single ? [{id:"one",name:"Один размер",price:payload.price,available:payload.available !== false}] : Array.isArray(payload.variants) ? payload.variants : []).map((item, index): ProductVariant => ({
    id: String(item.id || `variant-${index + 1}`),
    name: String(item.name || "Один размер").trim(),
    price: Number(item.price),
    available: item.available !== false,
  })).filter((item) => item.name && Number.isInteger(item.price) && item.price >= 0);
  const fallbackPrice = Number(payload.price);
  if (!variants.length && Number.isInteger(fallbackPrice) && fallbackPrice >= 0) {
    variants.push({ id: "one", name: "Один размер", price: fallbackPrice, available: payload.available !== false });
  }
  if(variants.length>30 || new Set(variants.map(v=>v.id)).size!==variants.length || variants.some(v=>v.price>1000000))throw new Error("Проверьте варианты и цены");
  if(images.length>20 || [image,...images].some(url=>url!=="/product-placeholder.svg" && !url.startsWith("/products/") && !url.startsWith("/api/media?")))throw new Error("Загрузите фотографии через админку, максимум 20");
  const availablePrices = variants.filter((item) => item.available).map((item) => item.price);
  if (!name || !category || !image || !variants.length) throw new Error("Заполните название, раздел, фото и хотя бы один размер");
  return {
    name,
    category,
    singleFlower:payload.singleFlower===true,
    acceptsFlowers:payload.singleFlower!==true && payload.acceptsFlowers!==false,
    price: availablePrices.length ? Math.min(...availablePrices) : Math.min(...variants.map((item) => item.price)),
    oldPrice: payload.oldPrice ? Number(payload.oldPrice) : null,
    image,
    imagesJson: JSON.stringify(images.length ? images : [image]),
    variantsJson: JSON.stringify(variants),
    description: String(payload.description ?? "").trim(),
    composition: String(payload.composition ?? "").trim(),
    badge: String(payload.badge ?? "").trim() || null,
    available: payload.available !== false && availablePrices.length > 0,
    hidden: payload.hidden === true,
    popular: payload.popular === true,
    updatedAt: new Date().toISOString(),
  };
}

function slugify(value: string) {
  const map: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return value.toLowerCase().split("").map((letter) => map[letter] ?? letter).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tovar";
}

export async function POST(request: Request) {
  sameOrigin(request);
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const payload = await request.json() as Partial<Product>;
    const values = normalizeProduct(payload);
    if(!(await readStoreData()).categories.some(c=>c.name===values.category))throw new Error("Сначала создайте раздел в админке");
    const db = getDb();
    const [{ value: lastOrder }] = await db.select({ value: max(products.sortOrder) }).from(products);
    const [created] = await db.insert(products).values({ ...values, slug: `${slugify(values.name)}-${Date.now().toString().slice(-5)}`, sortOrder: (lastOrder ?? -1) + 1 }).returning();
    return Response.json({ product: rowToProduct(created) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось добавить товар" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  sameOrigin(request);
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const payload = await request.json() as Partial<Product> & { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id)) throw new Error("Не указан товар");
    const values = normalizeProduct(payload);
    const db = getDb();
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if(!existing)throw new Error("Товар уже удалён. Обновите каталог.");
    if(!(await readStoreData()).categories.some(c=>c.name===values.category))throw new Error("Сначала создайте раздел в админке");
    const [saved] = await db.update(products).set(values).where(eq(products.id, id)).returning();
    return Response.json({ product: rowToProduct(saved) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить товар" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  sameOrigin(request);
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await request.json() as { id?: number };
    const productId = Number(id);
    if (!Number.isInteger(productId)) throw new Error("Не указан товар");
    await getDb().delete(products).where(eq(products.id, productId));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось удалить товар" }, { status: 400 });
  }
}
