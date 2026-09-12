import { catalogExtras } from "@/lib/flower-catalog";
import { paymentReady,paymentTest } from "@/lib/payments";
import { BRANCHES, DEFAULT_CATEGORIES, DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from "@/lib/catalog";
import { listProducts } from "@/lib/product-storage";
import { readStoreData } from "@/lib/store-storage";

export async function GET() {
  try {
    const products = await listProducts();
    const store = await readStoreData();
    store.settings.extras = catalogExtras(store.settings.extras as typeof DEFAULT_SETTINGS.extras, products, store.categories);
    return Response.json({ products, branches: BRANCHES, ...store, payment:{ready:paymentReady(),test:paymentTest()} }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("store:get", error);
    return Response.json({
      products: DEFAULT_PRODUCTS.filter((item) => !item.hidden),
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS,
      branches: BRANCHES,
      vacancies: [],
      storageUnavailable: true,
    });
  }
}
