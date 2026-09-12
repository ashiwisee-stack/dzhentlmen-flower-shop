import { handleTelegramLogin, type TelegramMessage } from "@/lib/telegram-login";
import { database } from "@/db";
import { sha256 } from "@/lib/customer-auth";
import { safeEqual } from "@/lib/security";
import { telegramCall, telegramReady, webhookSecret } from "@/lib/telegram";
export async function POST(request:Request) {
  if (!telegramReady() || !safeEqual(request.headers.get("x-telegram-bot-api-secret-token") || "",await webhookSecret())) return new Response("Forbidden",{status:403});
  const data=await request.json() as {message?:TelegramMessage};
  const m=data.message;
  if (!m || m.chat.type!=="private") return Response.json({ok:true});
  if(await handleTelegramLogin(m)) return Response.json({ok:true});
  const db=database(),chat=String(m.chat.id);
  if (m.text==="/stop") { await db.prepare("DELETE FROM telegram_subscribers WHERE chat_id=?").bind(chat).run(); return Response.json({ok:true}); }
  const token=m.text?.match(/^\/start ([a-f0-9]{32})$/)?.[1];
  if (!token) return Response.json({ok:true});
  const hash=await sha256(token),now=Date.now();
  await db.batch([
    db.prepare("INSERT INTO telegram_subscribers(chat_id,role,customer_id,name) SELECT ?,role,customer_id,? FROM telegram_links WHERE token=? AND expires>? ON CONFLICT(chat_id) DO UPDATE SET role=excluded.role,customer_id=excluded.customer_id,name=excluded.name WHERE telegram_subscribers.role!='admin' OR excluded.role='admin'").bind(chat,String(m.from?.first_name || "Получатель").slice(0,100),hash,now),
    db.prepare("DELETE FROM telegram_links WHERE token=?").bind(hash),
  ]);
  // Only send confirmation for connected chats. Never expose order/contact details in public chats.
  if (await db.prepare("SELECT chat_id FROM telegram_subscribers WHERE chat_id=?").bind(chat).first()) await telegramCall("sendMessage",{chat_id:chat,text:"Уведомления подключены. Отключить: /stop"});
  return Response.json({ok:true});
}
