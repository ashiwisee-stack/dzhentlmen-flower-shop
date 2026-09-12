import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual } from "@/lib/security";

type AdminEnv = {
  ADMIN_EMAILS?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  DB?: D1Database;
};

const COOKIE = "dm_admin";
const SESSION_TTL_MS = 12 * 60 * 60_000;

function base64url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cookieValue(raw: string | null) {
  return (
    raw
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? ""
  );
}

async function ensureAdminSessionTable(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `);
}

async function dbCookieAdmin(token: string, db: D1Database) {
  if (!token.startsWith("db.")) return null;
  const raw = token.slice(3);
  if (!raw) return null;

  await ensureAdminSessionTable(db);
  const tokenHash = await sha256Hex(raw);
  const row = await db
    .prepare("SELECT expires_at FROM admin_sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ expires_at: number }>();

  if (!row || Number(row.expires_at) <= Date.now()) {
    if (row) {
      await db
        .prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
        .bind(tokenHash)
        .run();
    }
    return null;
  }

  return { displayName: "Администратор", email: "admin@local" };
}

async function cookieAdmin() {
  const values = env as unknown as AdminEnv;
  const token = cookieValue((await headers()).get("cookie"));

  if (token.startsWith("db.") && values.DB) {
    return dbCookieAdmin(token, values.DB);
  }

  if (!values.ADMIN_SESSION_SECRET || values.ADMIN_SESSION_SECRET.length < 32) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(await sign(payload, values.ADMIN_SESSION_SECRET), signature)) {
    return null;
  }

  try {
    const base64 = payload
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const data = JSON.parse(atob(base64)) as { exp?: number };
    return data.exp && data.exp > Date.now()
      ? { displayName: "Администратор", email: "admin@local" }
      : null;
  } catch {
    return null;
  }
}

async function validAdminPassword(password: string, values: AdminEnv) {
  const configured = values.ADMIN_PASSWORD;
  const configuredIsUsable =
    Boolean(configured) &&
    configured!.length >= 12 &&
    !configured!.startsWith("replace_");

  return configuredIsUsable ? safeEqual(password, configured!) : false;
}

async function createDbAdminCookie(db: D1Database, request: Request) {
  await ensureAdminSessionTable(db);

  const rawToken = randomHex();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await db
    .prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)")
    .bind(tokenHash, expiresAt)
    .run();

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=db.${rawToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`;
}

export async function createAdminCookie(password: string, request: Request) {
  const values = env as unknown as AdminEnv;
  if (!(await validAdminPassword(password, values))) return null;

  if (values.ADMIN_SESSION_SECRET && values.ADMIN_SESSION_SECRET.length >= 32) {
    const payload = base64url(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS }));
    const token = `${payload}.${await sign(payload, values.ADMIN_SESSION_SECRET)}`;
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`;
  }

  if (values.DB) return createDbAdminCookie(values.DB, request);
  return null;
}

export function clearAdminCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function getAdminIdentity() {
  return cookieAdmin();
}

export async function requireAdminApi() {
  const user = await getAdminIdentity();
  if (!user) {
    return {
      ok: false as const,
      response: Response.json({ error: "Требуется вход администратора" }, { status: 401 }),
    };
  }
  return { ok: true as const, user };
}

export async function requireAdminPage() {
  const user = await getAdminIdentity();
  if (!user) redirect("/admin/login");
  return user;
}
