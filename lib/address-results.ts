export type AddressResult = { label: string; coordinates: [number, number]; precision: "house" | "street"; houseNumber?: string };

export function splitAddress(query: string) {
  const text = query.trim().replace(/^(?:г\.?\s*)?екатеринбург\s*,?\s*/i, "").replace(/^(?:ул\.?|улица)\s+/i, "");
  const match = text.match(/^(.+?)[,\s]+(?:д(?:ом)?\.?\s*)?(\d+[а-яa-z]?(?:\s*[/к]\s*\d+[а-яa-z]?)?)$/i);
  return { street: match ? match[1].trim() : text, houseNumber: match?.[2].replace(/\s/g, "") || "" };
}

function key(text: string) {
  return text.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/(?:^|[\s,])(?:улица|ул\.|дом|д\.)\s*/g, " ").replace(/[\s,.-]+/g, " ").trim();
}

export function uniqueAddresses(rows: AddressResult[], requestedHouse: string) {
  const seen = new Set<string>();
  const exact = requestedHouse ? rows.filter(row => row.precision === "house" && key(row.houseNumber || "") === key(requestedHouse)) : [];
  const candidates = exact.length ? exact : requestedHouse ? rows.filter(row => row.precision === "street") : rows;
  return candidates.filter(row => {
    const id = key(row.label);
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  }).slice(0, 8);
}
