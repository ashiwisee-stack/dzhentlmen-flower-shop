import { database } from "@/db";
import { sha256 } from "@/lib/customer-auth";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) throw new Error("Запрос с другого сайта запрещён");
}
export async function limitRequest(request: Request, action: string, limit = 20, seconds = 3600, subject = "") {
  sameOrigin(request);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Math.floor(Date.now() / 1000);
  const key = await sha256(`${action}:${subject || ip}:${Math.floor(now / seconds)}`);
  const row = await database().prepare(`INSERT INTO rate_limits (key, count, expires) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, now + seconds).first<{count:number}>();
  if (!row || row.count > limit) throw new Error("Слишком много попыток. Попробуйте позже.");
  await database().prepare("DELETE FROM rate_limits WHERE expires < ?").bind(now - 3600).run();
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function randomCode() {
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= 4294000000);
  return String(values[0] % 1000000).padStart(6, "0");
}
