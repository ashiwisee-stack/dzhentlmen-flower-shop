import { env } from "cloudflare:workers";
import { database } from "@/db";
import { normalizePhone,sha256 } from "@/lib/customer-auth";
import { telegramCall } from "@/lib/telegram";
export type TelegramMessage={chat:{id:number;type:string};text?:string;from?:{id:number;first_name?:string};contact?:{phone_number:string;user_id?:number};forward_origin?:unknown};
export async function handleTelegramLogin(m:TelegramMessage) {
  const db=database(),chat=String(m.chat.id),now=Date.now();
  const start=m.text?.match(/^\/start auth_([a-f0-9]{32})$/)?.[1];
  if(start) {
    const hash=await sha256(start);
    const row=await db.prepare("SELECT code FROM telegram_auth WHERE token=? AND expires>? AND customer_id IS NULL AND (chat_id IS NULL OR chat_id=?)").bind(hash,now,chat).first<{code:string}>();
    if(!row) {await telegramCall("sendMessage",{chat_id:chat,text:"Ссылка истекла или уже использована. Начните вход на сайте заново."});return true;}
    await db.batch([
      db.prepare("DELETE FROM telegram_auth WHERE chat_id=? AND token!=?").bind(chat,hash),
      db.prepare("UPDATE telegram_auth SET chat_id=? WHERE token=? AND customer_id IS NULL AND (chat_id IS NULL OR chat_id=?)").bind(chat,hash,chat),
    ]);
    await telegramCall("sendMessage",{chat_id:chat,text:`Вход в магазин «Джентельмен». Код на странице сайта должен быть ${row.code}.\nЕсли вы сами начали вход и код совпадает, нажмите «Подтвердить мой номер». Это разрешит вход на том устройстве, где вы открыли сайт.\nНе подтверждайте чужую просьбу войти.\nСогласие: ${env.PUBLIC_ORIGIN}/consent\nОтменить: /cancel`,reply_markup:{keyboard:[[{text:"Подтвердить мой номер",request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}});
    return true;
  }
  if(m.text==="/cancel") {await db.prepare("DELETE FROM telegram_auth WHERE chat_id=?").bind(chat).run();await telegramCall("sendMessage",{chat_id:chat,text:"Вход отменён.",reply_markup:{remove_keyboard:true}});return true;}
  if(!m.contact)return false;
  const pending=await db.prepare("SELECT token,consent_version FROM telegram_auth WHERE chat_id=? AND expires>? AND customer_id IS NULL").bind(chat,now).first<{token:string;consent_version:string}>();
  if(!pending)return true;
  const phone=normalizePhone(m.contact.phone_number);
  if(m.forward_origin || !m.from || m.contact.user_id!==m.from.id || m.from.id!==m.chat.id || !phone) {await telegramCall("sendMessage",{chat_id:chat,text:"Нужен ваш российский номер. Нажмите кнопку «Подтвердить мой номер»; пересланные контакты не принимаются."});return true;}
  const name=String(m.from.first_name||"Покупатель").slice(0,100),condition="token=? AND chat_id=? AND expires>? AND customer_id IS NULL";
  await db.batch([
    db.prepare(`INSERT INTO customers(id,name,phone) SELECT ?,?,? FROM telegram_auth WHERE ${condition} ON CONFLICT(phone) DO NOTHING`).bind(crypto.randomUUID(),name,phone,pending.token,chat,now),
    db.prepare(`INSERT INTO consent_events(id,subject,purpose,version) SELECT ?,?, 'telegram-login',consent_version FROM telegram_auth WHERE ${condition}`).bind(crypto.randomUUID(),phone,pending.token,chat,now),
    db.prepare(`UPDATE telegram_auth SET customer_id=(SELECT id FROM customers WHERE phone=?) WHERE ${condition}`).bind(phone,pending.token,chat,now),
  ]);
  await telegramCall("sendMessage",{chat_id:chat,text:"Номер подтверждён. Вернитесь в тот же браузер и нажмите «Я подтвердил — войти». Уведомления о заказах можно отдельно подключить в личном кабинете.",reply_markup:{remove_keyboard:true}});
  return true;
}
