import { orderBonuses } from "@/lib/bonuses";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { database,getDb } from "@/db";
import { orders,orderItems } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-auth";
import { paymentHash } from "@/lib/payments";
import { sameOrigin } from "@/lib/security";
import { receiptItems,refundReceiptItems,refundJwt } from "@/lib/payments";
export async function POST(request:Request) {
  const auth=await requireAdminApi();if(!auth.ok)return auth.response;
  try {
    sameOrigin(request);const p=await request.json() as {id?:string;action?:string};
    const [order]=await getDb().select().from(orders).where(eq(orders.id,String(p.id))).limit(1);
    if(order && JSON.parse(order.deliveryDetails).paymentTest===true) throw new Error("Тестовый заказ: реальные деньги не списывались, возврат не требуется");
    if(!order || !order.robokassaInvoiceId) throw new Error("Нет онлайн-платежа для возврата");
    const db=database();
    const existing=await db.prepare("SELECT id,status,response FROM refunds WHERE order_id=?").bind(order.id).first<{id:string;status:string;response:string}>();
    if(p.action==="check") {
      if(!existing) throw new Error("Возврат не запрашивался");
      const requestId=JSON.parse(existing.response||"{}").requestId;
      if(!requestId) throw new Error("Результат запроса неизвестен. Проверьте операцию в кабинете Робокассы; повторная отправка заблокирована.");
      const response=await fetch("https://services.robokassa.ru/RefundService/Refund/GetState?id="+encodeURIComponent(requestId),{signal:AbortSignal.timeout(10000)});
      const state=await response.json() as {label?:string;amount?:number};
      if(!response.ok) throw new Error("Не удалось проверить возврат");
      if(state.label==="finished" && Number(state.amount)===order.total) await db.batch([
        db.prepare("UPDATE refunds SET status='finished' WHERE order_id=?").bind(order.id),
        db.prepare("UPDATE orders SET payment_status='refunded',status='cancelled',version=version+1 WHERE id=? AND payment_status='refund_pending'").bind(order.id),
        ...orderBonuses(order.id,order.customerId,"cancelled"),
      ]);
      return Response.json({ok:true,status:state.label||"unknown"});
    }
    if(existing) throw new Error("Возврат уже запрошен. Нажмите «Проверить возврат».");
    if(order.paymentStatus!=="paid") throw new Error("Возврат доступен только для оплаченного заказа");
    if(!env.ROBOKASSA_PASSWORD3) throw new Error("Не настроен Пароль №3 Робокассы");
    if(env.ROBOKASSA_TEST!=="0") throw new Error("API возврата работает с реальными операциями. Тестовые платежи не возвращаются этим методом.");
    const url=new URL("https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt");
    url.search=new URLSearchParams({MerchantLogin:String(env.ROBOKASSA_LOGIN),InvoiceID:order.robokassaInvoiceId,Signature:await paymentHash(env.ROBOKASSA_LOGIN+":"+order.robokassaInvoiceId+":"+env.ROBOKASSA_PASSWORD2)}).toString();
    const check=await fetch(url,{signal:AbortSignal.timeout(10000)}),xml=await check.text();
    const opKey=xml.match(/<OpKey>([^<]+)<\/OpKey>/)?.[1];
    if(!check.ok || !/<Result>\s*<Code>0<\/Code>/.test(xml) || !opKey) throw new Error("Не удалось подтвердить операцию в Робокассе");
    const items=await getDb().select().from(orderItems).where(eq(orderItems.orderId,order.id)),fiscal=JSON.parse(order.deliveryDetails).fiscal;
    const invoiceItems=refundReceiptItems(receiptItems(items,order.bonusSpent,order.deliveryPrice,fiscal.tax,order.status==="completed"?"full_payment":fiscal.method));
    const jwt=await refundJwt({OpKey:opKey,InvoiceItems:invoiceItems});
    const claimed=await db.batch([
      db.prepare("INSERT INTO refunds(id,order_id,status) VALUES(?,?,'sending')").bind(crypto.randomUUID(),order.id),
      db.prepare("UPDATE orders SET payment_status='refund_pending',version=version+1 WHERE id=? AND payment_status='paid'").bind(order.id),
    ]);
    if(!claimed[1].meta.changes) throw new Error("Статус платежа изменился");
    // Do not retry an ambiguous financial request: provider has no documented idempotency key.
    const response=await fetch("https://services.robokassa.ru/RefundService/Refund/Create",{method:"POST",headers:{"content-type":"application/json"},body:jwt,signal:AbortSignal.timeout(15000)});
    const data=await response.json() as {success?:boolean;requestId?:string;message?:string};
    await db.prepare("UPDATE refunds SET status=?,response=? WHERE order_id=?").bind(data.success?"processing":"rejected",JSON.stringify(data),order.id).run();
    if(!response.ok || !data.success) throw new Error("Робокасса не подтвердила возврат. Проверьте операцию в её кабинете.");
    return Response.json({ok:true,status:"processing"});
  } catch(e){return Response.json({error:e instanceof Error?e.message:"Не удалось выполнить возврат"},{status:400});}
}
