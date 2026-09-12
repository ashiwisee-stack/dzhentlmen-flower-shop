import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { database,getDb } from "@/db";
import { orderItems,orders } from "@/db/schema";
import { sha256 } from "@/lib/customer-auth";
import { paymentReady,paymentTest,receiptItems } from "@/lib/payments";
async function fiscalRequest(method:"Attach"|"Status",payload:unknown) {
  const body=btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/=+$/g,"");
  const signature=btoa(await sha256(body+String(env.ROBOKASSA_PASSWORD1))).replace(/=+$/g,"");
  const r=await fetch("https://ws.roboxchange.com/RoboFiscal/Receipt/"+method,{method:"POST",body:body+"."+signature,headers:{"content-type":"text/plain"},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error("Сервис чеков недоступен");
  return r.json() as Promise<{ResultCode?:string|number;Code?:string;Statuses?:{Code:string}[]}>;
}
export async function enqueueFinalReceipt(id:string) {
  if(!paymentReady() || paymentTest())return;
  const [order]=await getDb().select().from(orders).where(eq(orders.id,id)).limit(1);
  if(!order || order.status!=="completed" || !order.robokassaInvoiceId || order.paymentStatus!=="paid")return;
  const details=JSON.parse(order.deliveryDetails);
  if(details.paymentTest===true)return;
  const fiscal=details.fiscal;
  if(!fiscal || fiscal.method==="full_payment")return;
  const items=await getDb().select().from(orderItems).where(eq(orderItems.orderId,id));
  const receiptId=String(BigInt(order.robokassaInvoiceId)+BigInt("1152921504606846976"));
  const payload={merchantId:String(env.ROBOKASSA_LOGIN),id:receiptId,originId:order.robokassaInvoiceId,operation:"sell",sno:fiscal.sno,url:String(env.PUBLIC_ORIGIN),total:order.total,items:receiptItems(items,order.bonusSpent,order.deliveryPrice,fiscal.tax,"full_payment"),client:{phone:order.phone.replace(/\D/g,"")},payments:[{type:2,sum:order.total}]};
  await database().prepare("INSERT OR IGNORE INTO fiscal_jobs(id,order_id,payload) VALUES(?,?,?)").bind(receiptId,id,JSON.stringify(payload)).run();
}
export async function processReceipts() {
  if(!paymentReady() || paymentTest())return;
  const db=database();
  // Repair an interrupted handoff between completing an order and queuing its receipt.
  const completed=await db.prepare("SELECT id FROM orders WHERE status='completed' AND payment_status='paid' AND robokassa_invoice_id IS NOT NULL AND json_extract(delivery_details,'$.fiscal.method')='full_prepayment' AND id NOT IN(SELECT order_id FROM fiscal_jobs) LIMIT 10").all<{id:string}>();
  for(const order of completed.results)await enqueueFinalReceipt(order.id);
  const jobs=await db.prepare("SELECT id,payload,status FROM fiscal_jobs WHERE status IN('new','pending') AND lease_until<? LIMIT 10").bind(Date.now()).all<{id:string;payload:string;status:string}>();
  for(const job of jobs.results) {
    const claimed=await db.prepare("UPDATE fiscal_jobs SET status='pending',lease_until=? WHERE id=? AND status=? AND lease_until<? RETURNING id").bind(Date.now()+60000,job.id,job.status,Date.now()).first();
    if(!claimed)continue;
    try {
      const response=job.status==="new"?await fiscalRequest("Attach",JSON.parse(job.payload)):await fiscalRequest("Status",{merchantId:String(env.ROBOKASSA_LOGIN),id:job.id});
      const done=String(response.ResultCode)==="2" || response.Statuses?.some(s=>s.Code==="Done");
      const failed=["3","1000"].includes(String(response.ResultCode)) || ["1000","1001"].includes(String(response.Code)) || response.Statuses?.some(s=>["Fail","NotProvided"].includes(s.Code));
      await db.prepare("UPDATE fiscal_jobs SET status=?,response=? WHERE id=?").bind(done?"done":failed?"error":"pending",JSON.stringify(response),job.id).run();
    } catch { /* Ambiguous attach: check this same receipt ID later; never create another. */ }
  }
}
