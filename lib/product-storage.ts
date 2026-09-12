import { ensureStoreDefaults } from "@/lib/store-storage";
import { asc } from "drizzle-orm";
import { database, getDb } from "@/db";
import { products } from "@/db/schema";
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS, type Extra, type Product, type ProductVariant } from "@/lib/catalog";

type ProductRow = typeof products.$inferSelect;

function readArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

export function rowToProduct(row: ProductRow): Product {
  const images = readArray<string>(row.imagesJson, [row.image]).filter((item) => typeof item === "string");
  const variants = readArray<ProductVariant>(row.variantsJson, [{ id: "one", name: "Один размер", price: row.price, available: row.available }])
    .filter((item) => item && typeof item.id === "string" && Number.isInteger(item.price));
  return {
    id: row.id,
    acceptsFlowers:row.acceptsFlowers,
    singleFlower:row.singleFlower,
    flowerExtraId:row.flowerExtraId ?? undefined,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    oldPrice: row.oldPrice ?? undefined,
    image: row.image,
    images: images.length ? images : [row.image],
    variants: variants.length ? variants : [{ id: "one", name: "Один размер", price: row.price, available: row.available }],
    description: row.description,
    composition: row.composition,
    badge: row.badge ?? undefined,
    available: row.available,
    hidden: row.hidden,
    popular: row.popular,
  };
}

export async function listProducts(includeHidden = false): Promise<Product[]> {
  await ensureStoreDefaults();
  const db = getDb();
  let rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id));

  const initialized=await database().prepare("SELECT key FROM store_settings WHERE key='_products_initialized'").first();
  if (!rows.length && !initialized) {
    const seeds = DEFAULT_PRODUCTS.map((item, index) => db.insert(products).values({
      id: item.id,
      acceptsFlowers:item.acceptsFlowers!==false,
      slug: item.slug,
      name: item.name,
      category: item.category,
      price: item.price,
      oldPrice: item.oldPrice ?? null,
      image: item.image,
      imagesJson: JSON.stringify(item.images),
      variantsJson: JSON.stringify(item.variants),
      description: item.description,
      composition: item.composition,
      badge: item.badge ?? null,
      available: item.available,
      hidden: item.hidden,
      popular: item.popular,
      sortOrder: index,
    }).onConflictDoNothing().toSQL());
    // D1 limits bound parameters per statement. Seed each product separately
    // within one atomic batch, including the initialization marker.
    await database().batch([
      ...seeds.map(({sql, params}) => database().prepare(sql).bind(...params)),
      database().prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('_products_initialized','true')"),
    ]);
    rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id));
  }

  if(!initialized)await database().prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('_products_initialized','true')").run();
  await importLegacyFlowers();
  rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id));
  return rows.map(rowToProduct).filter((item) => includeHidden || !item.hidden);
}


async function importLegacyFlowers() {
  const db = database();
  if (await db.prepare("SELECT key FROM store_settings WHERE key='_flowers_initialized'").first()) return;
  const stored = await db.prepare("SELECT value FROM store_settings WHERE key='extras'").first<{value:string}>();
  const extras: Extra[] = stored ? JSON.parse(stored.value) : DEFAULT_SETTINGS.extras;
  const flowers = extras.filter(extra => extra.kind === "flower");
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO categories(slug,name,sort_order,visible) SELECT 'single-flowers','Одиночные цветы',5,1 WHERE NOT EXISTS(SELECT 1 FROM store_settings WHERE key='_flowers_initialized')"),
    ...flowers.map((extra, index) => db.prepare("INSERT OR IGNORE INTO products(slug,name,category,price,image,images_json,variants_json,description,composition,available,accepts_flowers,single_flower,flower_extra_id,sort_order) SELECT ?,?,'Одиночные цветы',?,?,?,?,?,?,?,0,1,?,? WHERE NOT EXISTS(SELECT 1 FROM store_settings WHERE key='_flowers_initialized')").bind(
      'single-flower-' + extra.id, extra.name, extra.price, extra.image || '/product-placeholder.svg', JSON.stringify([extra.image || '/product-placeholder.svg']),
      JSON.stringify([{id:'one',name:'Один размер',price:extra.price,available:extra.available !== false}]), extra.description, 'Один цветок', extra.available === false ? 0 : 1, extra.id, 1000 + index,
    )),
    db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('_flowers_initialized','true')"),
  ]);
}
