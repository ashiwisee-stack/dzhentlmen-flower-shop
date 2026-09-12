/** Resolve only our image assets, including URLs cached by the old storefront. */
export function localImageSource(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const url = new URL(value, "https://images.invalid");
  if (/^\/(products|brand)\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/i.test(url.pathname)) return url.pathname;
  if (url.pathname === "/api/media" && /^products\/[a-zA-Z0-9_./-]+$/.test(url.searchParams.get("key") || "")) return url.pathname + url.search;
  return null;
}
