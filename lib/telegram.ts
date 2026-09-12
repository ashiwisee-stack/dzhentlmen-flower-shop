import { env } from "cloudflare:workers";
import { database } from "@/db";
import { authSecret, sha256 } from "@/lib/customer-auth";
export function telegramReady() { return !!env.TELEGRAM_BOT_TOKEN && !!env.PUBLIC_ORIGIN; }
export async function telegramCall(method:string, body:unknown) {
  if (!telegramReady()) throw new Error("Telegram ещё не подключён");
  const response = await fetch(`https://api.telegram.org/bot${String(env.TELEGRAM_BOT_TOKEN)}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data = await response.json() as {ok:boolean;result:Record<string,unknown>};
  if (!response.ok || !data.ok) throw new Error("Telegram временно недоступен");
  return data.result;
}
export async function webhookSecret() { return env.TELEGRAM_WEBHOOK_SECRET?String(env.TELEGRAM_WEBHOOK_SECRET):sha256(authSecret()+":telegram-webhook"); }
export function notificationStatement(event:string,message:string,customerId:string|null = null) {
  return database().prepare("INSERT OR IGNORE INTO notification_jobs(id,chat_id,message) SELECT ? || ':' || chat_id,chat_id,? FROM telegram_subscribers WHERE role='admin' OR (role='customer' AND customer_id=?)").bind(event,message,customerId);
}
export async function flushNotifications() {
  if (!telegramReady()) return;
  const db = database(), now = Date.now();
  const jobs = await db.prepare("SELECT id,chat_id,message FROM notification_jobs WHERE sent=0 AND attempts<10 AND lease_until<? LIMIT 20").bind(now).all<{id:string;chat_id:string;message:string}>();
  for (const job of jobs.results) {
    const claim = await db.prepare("UPDATE notification_jobs SET lease_until=?,attempts=attempts+1 WHERE id=? AND sent=0 AND lease_until<? RETURNING id").bind(now+60000,job.id,now).first();
    if (!claim) continue;
    try {
      await telegramCall("sendMessage",{chat_id:job.chat_id,text:job.message,disable_web_page_preview:true});
      await db.prepare("UPDATE notification_jobs SET sent=1 WHERE id=?").bind(job.id).run();
    } catch { /* Durable outbox retries on the next scheduled/admin run. */ }
  }
}
