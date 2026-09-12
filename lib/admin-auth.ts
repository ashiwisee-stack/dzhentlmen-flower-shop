import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual } from "@/lib/security";

type AdminEnv = { ADMIN_EMAILS?: string; ADMIN_PASSWORD?: string; ADMIN_SESSION_SECRET?: string };
const COOKIE = "dm_admin";

function base64url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(raw: string | null) {
  return raw?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? "";
}

async function cookieAdmin() {
  const values = env as unknown as AdminEnv;
  if (!values.ADMIN_SESSION_SECRET) return null;
  const token = cookieValue((await headers()).get("cookie"));
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(await sign(payload, values.ADMIN_SESSION_SECRET),signature)) return null;
  try {
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const data = JSON.parse(atob(base64)) as { exp?: number };
    return data.exp && data.exp > Date.now() ? { displayName: "Администратор", email: "admin@local" } : null;
  } catch {
    return null;
  }
}

export async function createAdminCookie(password: string, request: Request) {
  const values = env as unknown as AdminEnv;
  if (!values.ADMIN_PASSWORD || !values.ADMIN_SESSION_SECRET) return null;
  if (values.ADMIN_SESSION_SECRET.length < 32 || values.ADMIN_PASSWORD.length < 12 || values.ADMIN_PASSWORD.startsWith("replace_")) return null;
  if (!safeEqual(password, values.ADMIN_PASSWORD)) return null;
  const payload = base64url(JSON.stringify({ exp: Date.now() + 12 * 60 * 60_000 }));
  const token = `${payload}.${await sign(payload, values.ADMIN_SESSION_SECRET)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`;
}

export function clearAdminCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function getAdminIdentity() {
  return cookieAdmin();
}

export async function requireAdminApi() {
  const user = await getAdminIdentity();
  if (!user) return { ok: false as const, response: Response.json({ error: "Требуется вход администратора" }, { status: 401 }) };
  return { ok: true as const, user };
}

export async function requireAdminPage() {
  const user = await getAdminIdentity();
  if (!user) redirect("/admin/login");
  return user;
}
