import { env } from "cloudflare:workers";
import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { customerSessions, customers } from "@/db/schema";

const COOKIE = "dm_customer";

export { normalizePhone } from "@/lib/phone";

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(raw: string | null, key: string) {
  return raw?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${key}=`))?.slice(key.length + 1) ?? "";
}

export async function getCustomer() {
  const requestHeaders = await headers();
  const token = cookieValue(requestHeaders.get("cookie"), COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const db = getDb();
  const [row] = await db.select({ customer: customers, session: customerSessions })
    .from(customerSessions)
    .innerJoin(customers, eq(customerSessions.customerId, customers.id))
    .where(and(eq(customerSessions.tokenHash, tokenHash), gt(customerSessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return row?.customer ?? null;
}

export function makeCustomerCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function clearCustomerCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function authSecret() {
  const values = env as unknown as { CUSTOMER_AUTH_SECRET?: string; ADMIN_SESSION_SECRET?: string };
  const secret = values.CUSTOMER_AUTH_SECRET || values.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace_")) throw new Error("Задайте случайный секрет авторизации длиной от 32 символов");
  return secret;
}
