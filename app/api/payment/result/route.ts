import { orderBonuses } from "@/lib/bonuses";
import { env } from "cloudflare:workers";
import { database } from "@/db";
import { paymentHash, paymentReady, paymentTest } from "@/lib/payments";
import { safeEqual } from "@/lib/security";
import { notificationStatement } from "@/lib/telegram";
async function result(request:Request) {
  try {
    if(!paymentReady()) return new Response("Not configured",{status:503});
    const p=request.method==="GET"?new URL(request.url).searchParams:new URLSearchParams(await request.text());
    const sum=p.get("OutSum")||"",invoice=p.get("InvId")||"",sig=(p.get("SignatureValue")||"").toLowerCase();
    if(!/^\d+(\.\d{1,6})?$/.test(sum) || !/^\d+$/.test(invoice)) return new Response("Invalid",{status:400});
    // No Shp parameters are sent by this integration; reject unexpected ones.
    if([...p.keys()].some(k=>k.toLowerCase().startsWith("shp_"))) return new Response("Invalid",{status:400});
    if(!safeEqual(await paymentHash(sum+":"+invoice+":"+String(env.ROBOKASSA_PASSWORD2)),sig)) return new Response("Invalid signature",{status:403});
    const db=database(),order=await db.prepare("SELECT id,order_number,total,payment_status,customer_id,delivery_details,status FROM orders WHERE robokassa_invoice_id=?").bind(invoice).first<{id:string;order_number:string;total:number;payment_status:string;customer_id:string|null;delivery_details:string;status:string}>();
    if(order) {const test=JSON.parse(order.delivery_details).paymentTest;if(typeof test==="boolean" && test!==paymentTest())return new Response("Payment mode mismatch",{status:400});}
    if(!order || Number(sum)!==order.total) return new Response("Invalid amount",{status:400});
    if(order.payment_status==="pending") await db.batch([
      db.prepare("UPDATE orders SET payment_status='paid',version=version+1 WHERE id=? AND payment_status='pending'").bind(order.id),
      ...orderBonuses(order.id,order.customer_id,null),
      notificationStatement("paid:"+order.id,"Оплата заказа "+order.order_number+" подтверждена.",order.customer_id),
    ]);
    return new Response("OK"+invoice);
  } catch {return new Response("Retry later",{status:503});}
}
export const POST=result;
export const GET=result;
