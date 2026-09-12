import { env } from "cloudflare:workers";
import { database } from "@/db";
import { makeCustomerCookie, normalizePhone, sha256 } from "@/lib/customer-auth";
import { limitRequest, sameOrigin } from "@/lib/security";
import { callcheckReady, createCallcheck, checkCallcheck } from "@/lib/callcheck";
import { CONSENT_VERSION } from "@/lib/consent";

const COOKIE = "dm_call_challenge";
type Challenge = { browser_hash: string; phone: string; name: string; check_id: string | null; call_phone: string | null; expires: number };
function cookie(value: string, request: Request, clear = false) {
  return `${COOKIE}=${value}; Path=/api/auth/call; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 300}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function json(body: unknown, status = 200, headers?: HeadersInit) {
  const h = new Headers(headers); h.set("cache-control", "no-store");
  return Response.json(body, { status, headers: h });
}
function publicChallenge(row: Challenge) {
  return { challenge: { phone: row.phone, callPhone: row.call_phone, expires: row.expires }, ready: true };
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const p = await request.json() as { action?: string; phone?: string; name?: string; consent?: boolean };
    if (!["start", "current", "check", "cancel"].includes(p.action || "")) throw new Error("Неизвестное действие");
    await limitRequest(request, "call-requests", 180, 600);
    const db = database(), now = Date.now();
    const raw = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
    const hash = raw ? await sha256(raw) : "";
    const existing = hash ? await db.prepare("SELECT * FROM call_auth WHERE browser_hash=? AND expires>?").bind(hash, now).first<Challenge>() : null;
    if (p.action === "cancel") {
      if (hash) await db.prepare("DELETE FROM call_auth WHERE browser_hash=?").bind(hash).run();
      return json({ ok: true }, 200, { "set-cookie": cookie("", request, true) });
    }
    if (p.action === "current") return json({ ready: callcheckReady(), challenge: callcheckReady() && existing?.call_phone ? publicChallenge(existing).challenge : null });
    if (!callcheckReady()) throw new Error("Вход по звонку пока не подключён. Можно войти через Telegram.");

    if (p.action === "start") {
      if (p.consent !== true) throw new Error("Подтвердите согласие на обработку данных");
      const phone = normalizePhone(String(p.phone || ""));
      const name = String(p.name || "").trim().slice(0, 100);
      if (!phone) throw new Error("Введите 10 цифр российского номера после +7");
      if (name.length < 2) throw new Error("Укажите имя — не менее двух символов");
      const allowed = String(env.SMS_RU_CALLCHECK_ALLOWED_PHONES || "").split(",").map(s => normalizePhone(s.trim())).filter(Boolean);
      if (String(env.SMS_RU_CALLCHECK_ALLOWED_PHONES || "").trim() && !allowed.includes(phone)) throw new Error("Сейчас вход по звонку доступен только для тестовых номеров магазина.");
      if (existing) {
        if (existing.phone !== phone) throw new Error("Сначала отмените текущую попытку входа");
        if (existing.call_phone) return json(publicChallenge(existing));
        throw new Error("Попытка уже создана. Если номер для звонка не появился, попробуйте через пять минут.");
      }
      await limitRequest(request, "call-start-ip", 5, 600);
      await limitRequest(request, "call-start-phone", 1, 60, phone);
      await limitRequest(request, "call-start-phone-day", 3, 86400, phone);
      const configured = Number(env.SMS_RU_CALLCHECK_DAILY_LIMIT || 5);
      const dailyLimit = Number.isFinite(configured) ? Math.max(1, Math.min(100, Math.floor(configured))) : 5;
      await limitRequest(request, "call-start-global-day", dailyLimit, 86400, "store");
      const browser = crypto.randomUUID() + crypto.randomUUID(), browserHash = await sha256(browser), expires = now + 300000;
      const inserted = await db.batch([
        db.prepare("DELETE FROM call_auth WHERE expires<=?").bind(now),
        db.prepare("INSERT INTO call_auth(browser_hash,phone,name,expires,consent_version) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO NOTHING RETURNING browser_hash").bind(browserHash, phone, name, expires, CONSENT_VERSION),
      ]);
      if (!inserted[1].results.length) throw new Error("Для этого номера уже ожидается звонок. Вернитесь в исходный браузер или повторите через пять минут.");
      // Reserve before contacting the provider. Keep uncertain attempts until expiry;
      // do not auto-retry a chargeable creation after a timeout.
      try {
        const result = await createCallcheck(phone);
        const saved = await db.prepare("UPDATE call_auth SET check_id=?,call_phone=? WHERE browser_hash=? AND expires>? RETURNING browser_hash").bind(result.checkId, result.callPhone, browserHash, Date.now()).first();
        if (!saved) throw new Error("Время попытки истекло. Начните вход заново.");
        return json({ ready: true, challenge: { phone, callPhone: result.callPhone, expires } }, 200, { "set-cookie": cookie(browser, request) });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Не удалось создать попытку входа" }, 400, { "set-cookie": cookie(browser, request) });
      }
    }

    if (!existing?.check_id) return json({ error: "Попытка истекла или не найдена. Начните вход заново.", expired: true }, 400);
    const leased = await db.prepare("UPDATE call_auth SET next_check_at=? WHERE browser_hash=? AND expires>? AND next_check_at<=? RETURNING check_id").bind(now + 15000, hash, now, now).first<{ check_id: string }>();
    if (!leased) return json({ pending: true, retryAfter: 15 });
    const status = await checkCallcheck(leased.check_id);
    if (status === "pending") return json({ pending: true, retryAfter: 15 });
    if (status === "expired") {
      await db.prepare("DELETE FROM call_auth WHERE browser_hash=?").bind(hash).run();
      return json({ expired: true, error: "Время на звонок истекло. Начните вход заново." }, 400, { "set-cookie": cookie("", request, true) });
    }
    const session = crypto.randomUUID() + crypto.randomUUID(), completedAt = Date.now();
    const condition = "browser_hash=? AND check_id=? AND expires>?";
    const args = [hash, leased.check_id, completedAt];
    const result = await db.batch([
      db.prepare(`INSERT INTO customers(id,name,phone) SELECT ?,name,phone FROM call_auth WHERE ${condition} ON CONFLICT(phone) DO NOTHING`).bind(crypto.randomUUID(), ...args),
      db.prepare(`INSERT INTO consent_events(id,subject,purpose,version) SELECT ?,phone,'call-login',consent_version FROM call_auth WHERE ${condition}`).bind(crypto.randomUUID(), ...args),
      db.prepare(`INSERT INTO customer_sessions(id,customer_id,token_hash,expires_at) SELECT ?,(SELECT id FROM customers WHERE phone=call_auth.phone),?,? FROM call_auth WHERE ${condition} RETURNING customer_id`).bind(crypto.randomUUID(), await sha256(session), new Date(completedAt + 2592000000).toISOString(), ...args),
      db.prepare(`DELETE FROM call_auth WHERE ${condition}`).bind(...args),
    ]);
    if (!result[2].results.length) throw new Error("Попытка уже завершена или отменена. Обновите страницу.");
    const h = new Headers(); h.append("set-cookie", makeCustomerCookie(session, request)); h.append("set-cookie", cookie("", request, true));
    return json({ ok: true }, 200, h);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось войти" }, 400);
  }
}
