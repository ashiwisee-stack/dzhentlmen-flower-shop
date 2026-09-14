import { tokenAuth,sessionToken } from "@/lib/auth-transport";
import { desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { database, getDb } from "@/db";
import { customers, orderItems, orders } from "@/db/schema";
import { authSecret, clearCustomerCookie, getCustomer, makeCustomerCookie, normalizePhone, sha256 } from "@/lib/customer-auth";
import { limitRequest, randomCode, sameOrigin } from "@/lib/security";
import { sendCode, smsDemo, smsReady } from "@/lib/sms";

export async function GET(request: Request) {
  try {
    const customer = await getCustomer();
    if (!customer) return Response.json({customer:null,orders:[],smsReady:smsReady() || smsDemo(request)},{headers:{"cache-control":"no-store"}});
    const page = Math.max(0, Math.floor(Number(new URL(request.url).searchParams.get("page")) || 0));
    const db = getDb();
    const rows = await db.select().from(orders).where(eq(orders.customerId,customer.id)).orderBy(desc(orders.createdAt)).limit(21).offset(page*20);
    const ids = rows.slice(0,20).map(o=>o.id);
    const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId,ids)) : [];
    const ledger = await database().prepare("SELECT delta,kind,note,created_at FROM bonus_operations WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50").bind(customer.id).all();
    return Response.json({customer,hasMore:rows.length>20,ledger:ledger.results,orders:rows.slice(0,20).map(o=>({...o,accessHash:undefined,requestHash:undefined,requestKey:undefined,items:items.filter(i=>i.orderId===o.id)}))},{headers:{"cache-control":"no-store"}});
  } catch { return Response.json({error:"Не удалось загрузить личный кабинет"},{status:503}); }
}
export async function POST(request: Request) {
  try {
    await limitRequest(request,"auth",30,3600);
    const p = await request.json() as {action?:string;phone?:string;name?:string;code?:string};
    const phone = normalizePhone(String(p.phone || ""));
    if (!phone) throw new Error("Введите российский номер телефона");
    const db = database();
    const now = new Date().toISOString();
    if (p.action === "request-code") {
      if (!smsReady() && !smsDemo(request)) throw new Error("Вход по СМС ещё не подключён. Можно оформить заказ без регистрации.");
      await limitRequest(request,"sms-phone",1,60,phone);
      await limitRequest(request,"sms-phone-day",10,86400,phone);
      const existing = await db.prepare("SELECT id FROM customers WHERE phone = ?").bind(phone).first();
      const name = String(p.name || "").trim().slice(0,100);
      if (!existing && name.length < 2) throw new Error("Для регистрации укажите имя");
      const code = randomCode(), hash = await sha256(phone+":"+code+":"+authSecret());
      await db.prepare("INSERT INTO auth_codes(phone,name,code_hash,expires_at,attempts) VALUES(?,?,?,?,0) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0").bind(phone,name,hash,new Date(Date.now()+600000).toISOString()).run();
      try { if (!smsDemo(request)) await sendCode(phone,code); }
      catch (error) { await db.prepare("DELETE FROM auth_codes WHERE phone=? AND code_hash=?").bind(phone,hash).run(); throw error; }
      return Response.json({ok:true,devCode:smsDemo(request)?code:undefined});
    }
    if (p.action !== "verify-code") throw new Error("Неизвестное действие");
    const hash = await sha256(phone+":"+String(p.code || "")+":"+authSecret());
    const customerId = crypto.randomUUID(), token = crypto.randomUUID()+crypto.randomUUID();
    // Consume exactly one valid code and create the account/session in one atomic D1 batch.
    const result = await db.batch([
      db.prepare("INSERT INTO customers(id,name,phone) SELECT ?,CASE WHEN name='' THEN 'Покупатель' ELSE name END,phone FROM auth_codes WHERE phone=? AND code_hash=? AND expires_at>? AND attempts<5 ON CONFLICT(phone) DO NOTHING").bind(customerId,phone,hash,now),
      db.prepare("INSERT INTO customer_sessions(id,customer_id,token_hash,expires_at) SELECT ?,c.id,?,? FROM customers c JOIN auth_codes a ON a.phone=c.phone WHERE a.phone=? AND a.code_hash=? AND a.expires_at>? AND a.attempts<5 RETURNING customer_id").bind(crypto.randomUUID(),await sha256(token),new Date(Date.now()+2592000000).toISOString(),phone,hash,now),
      db.prepare("DELETE FROM auth_codes WHERE phone=? AND code_hash=? AND expires_at>? AND attempts<5").bind(phone,hash,now),
      db.prepare("UPDATE auth_codes SET attempts=attempts+1 WHERE phone=? AND code_hash!=?").bind(phone,hash),
    ]);
    if (!result[1].results.length) throw new Error("Неверный или истёкший код. Запросите новый, если пять попыток исчерпаны.");
    const [customer] = await getDb().select().from(customers).where(eq(customers.phone,phone));
    return Response.json({customer,...(tokenAuth(request)?{authToken:token}:{})},{headers:tokenAuth(request)?{"cache-control":"no-store"}:{"set-cookie":makeCustomerCookie(token,request),"cache-control":"no-store"}});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:"Не удалось войти"},{status:400}); }
}
export async function DELETE(request: Request) {
  sameOrigin(request);
  const token=sessionToken(await headers());
  if (token) await database().prepare("DELETE FROM customer_sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return Response.json({ok:true},{headers:tokenAuth(request)?{"cache-control":"no-store"}:{"set-cookie":clearCustomerCookie(),"cache-control":"no-store"}});
}
