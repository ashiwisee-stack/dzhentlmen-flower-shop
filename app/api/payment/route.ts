import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders,orderItems } from "@/db/schema";
import { getCustomer,sha256 } from "@/lib/customer-auth";
import { limitRequest } from "@/lib/security";
import { paymentUrl,receiptItems,paymentTest } from "@/lib/payments";
export async function POST(request:Request) {
  try {
    const p=await request.json() as {id?:string;accessToken?:string;action?:string;orders?:{id:string;accessToken?:string}[]};
    await limitRequest(request,p.action === "list" || p.action === "status" ? "payment-status" : "payment",p.action === "list" || p.action === "status" ? 180 : 30,3600);
    if (p.action === "list") {
      if (!Array.isArray(p.orders) || p.orders.length > 10) throw new Error("Некорректный список заказов");
      const customer = await getCustomer();
      const visible = [];
      for (const ref of p.orders) {
        if (!ref || typeof ref.id !== "string" || ref.id.length > 100) continue;
        const [order] = await getDb().select().from(orders).where(eq(orders.id,ref.id)).limit(1);
        if (!order || !(customer && order.customerId === customer.id) && (typeof ref.accessToken !== "string" || await sha256(ref.accessToken) !== order.accessHash)) continue;
        visible.push({id:order.id,orderNumber:order.orderNumber,total:order.total,status:order.status,paymentStatus:order.paymentStatus,deliveryDate:order.deliveryDate,deliveryTime:order.deliveryTime,test:!!order.robokassaInvoiceId && JSON.parse(order.deliveryDetails).paymentTest===true});
      }
      return Response.json({orders:visible},{headers:{"cache-control":"no-store"}});
    }
    const [order]=await getDb().select().from(orders).where(eq(orders.id,String(p.id))).limit(1);
    const customer=await getCustomer();
    if(!order || !(customer && customer.id===order.customerId) && (!p.accessToken || await sha256(p.accessToken)!==order.accessHash)) return Response.json({error:"Заказ недоступен"},{status:404});
    if(p.action==="status") return Response.json({orderNumber:order.orderNumber,total:order.total,paymentStatus:order.paymentStatus,status:order.status,test:JSON.parse(order.deliveryDetails).paymentTest===true});
    if(order.paymentStatus!=="pending" || order.status==="cancelled") throw new Error("Этот заказ не ожидает оплаты");
    const items=await getDb().select().from(orderItems).where(eq(orderItems.orderId,order.id));
    const details=JSON.parse(order.deliveryDetails);
    if(typeof details.paymentTest==="boolean" && details.paymentTest!==paymentTest()) throw new Error("Режим оплаты изменился. Оформите новый заказ.");
    const fiscal=details.fiscal;
    return Response.json({url:await paymentUrl(order,{sno:fiscal.sno,items:receiptItems(items,order.bonusSpent,order.deliveryPrice,fiscal.tax,fiscal.method)})});
  } catch(e){return Response.json({error:e instanceof Error?e.message:"Не удалось перейти к оплате"},{status:400});}
}
