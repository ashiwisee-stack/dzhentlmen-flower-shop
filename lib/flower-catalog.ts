import type { Category, Extra, Product } from "@/lib/catalog";

// Products are the single source of price, visibility and availability for flowers.
// Imported flowers keep their old extra IDs so existing carts remain valid.
export function catalogExtras(extras: Extra[], products: Product[], categories: Pick<Category, "name" | "visible">[]): Extra[] {
  return [
    ...extras.filter(extra => extra.kind !== "flower"),
    ...products.filter(product => product.singleFlower && !product.hidden && categories.some(category => category.name === product.category && category.visible)).map(product => {
      const variant = product.variants[0];
      return {
        id: product.flowerExtraId || `product:${product.id}`,
        name: product.name,
        description: product.description,
        price: variant.price,
        image: product.image,
        kind: "flower" as const,
        available: product.available && variant.available,
      };
    }),
  ];
}
