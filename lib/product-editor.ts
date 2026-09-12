import type { Product } from "@/lib/catalog";

export function setProductAvailability(product: Product, available: boolean): Product {
  return {
    ...product,
    available,
    variants: available && !product.variants.some(variant => variant.available)
      ? product.variants.map(variant => ({ ...variant, available: true }))
      : product.variants,
  };
}
