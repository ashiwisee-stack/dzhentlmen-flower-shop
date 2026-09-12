import { env } from "cloudflare:workers";
import { database } from "@/db";
import { getAdminIdentity } from "@/lib/admin-auth";
import { getCustomer, sha256 } from "@/lib/customer-auth";
import { sameOrigin, safeEqual } from "@/lib/security";
import { flushNotifications, telegramCall, telegramReady, webhookSecret } from "@/lib/telegram";

export async function GET() {
  const admin = await getAdminIdentity();
  if (!admin) return Response.json({ready:telegramReady()});
  const subscribers = await database().prepare("SELECT chat_id,name FROM telegram_subscribers WHERE role='admin'").all();
  return Response.json({ready:telegramReady(),subscribers:subscribers.results});
}
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    const admin=await getAdminIdentity(),customer=await getCustomer();
    if (!admin && !customer) return Response.json({error:"Сначала войдите"},{status:401});
    const p=await request.json() as {action?:string;chatId?:string};
    if (p.action==="remove" && admin) { await database().prepare("DELETE FROM telegram_subscribers WHERE chat_id=? AND role='admin'").bind(p.chatId).run(); return Response.json({ok:true}); }
    if (!telegramReady()) throw new Error("Добавьте токен Telegram и адрес сайта в настройках сервера");
    if (p.action==="retry" && admin) { await flushNotifications(); return Response.json({ok:true}); }
    if (admin) await telegramCall("setWebhook",{url:new URL("/api/telegram/webhook",String(env.PUBLIC_ORIGIN)).href,secret_token:await webhookSecret(),allowed_updates:["message"]});
    const bot=await telegramCall("getMe",{});
    const token=crypto.randomUUID().replaceAll("-","");
    await database().prepare("DELETE FROM telegram_links WHERE expires<?").bind(Date.now()).run();
    await database().prepare("INSERT INTO telegram_links(token,role,customer_id,expires) VALUES(?,?,?,?)").bind(await sha256(token),admin?"admin":"customer",admin?null:customer!.id,Date.now()+600000).run();
    return Response.json({url:`https://t.me/${bot.username}?start=${token}`});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:"Ошибка подключения"},{status:400}); }
}
