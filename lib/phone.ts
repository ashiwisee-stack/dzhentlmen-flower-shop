export function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return ((digits.length > 10 && /^[78]/.test(digits)) || value.trim().startsWith("+7") ? digits.slice(1) : digits).slice(0, 10);
}

export function normalizePhone(value: string) {
  if (!/^[+\d\s().-]+$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+") && !(digits.length === 11 && digits[0] === "7")) return "";
  if (digits.length === 11 && /^[78]/.test(digits)) return `+7${digits.slice(1)}`;
  if (digits.length === 10) return `+7${digits}`;
  return "";
}
