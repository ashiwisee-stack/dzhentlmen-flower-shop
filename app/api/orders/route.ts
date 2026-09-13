import { catalogExtras } from "@/lib/flower-catalog";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { database, getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-auth";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import { getCustomer, normalizePhone, sha256 } from "@/lib/customer-auth";
import { verifyQuote } from "@/lib/delivery";
import { listProducts } from "@/lib/product-storage";
import { readStoreData } from "@/lib/store-storage";
import { canTransition, validateSlot } from "@/lib/shop-rules";
import { limitRequest, sameOrigin } from "@/lib/security";
import { CONSENT_VERSION } from "@/lib/consent";
import { fiscalSettings, paymentReady, paymentTest } from "@/lib/payments";
import { enqueueFinalReceipt } from "@/lib/fiscal";
import { spendBonuses, orderBonuses } from "@/lib/bonuses";
import { notificationStatement } from "@/lib/telegram";

export async function POST(request:Request) {
  try {
    await limitRequest(request,"orders",30,3600);
    const p=await request.json();
    const customer=await getCustomer();
    const requestKey=String(p.requestKey || "");
    if(!/^[a-f0-9-]{36}$/.test(requestKey)) throw new Error("Обновите форму оформления заказа");
    const requestHash=await sha256(JSON.stringify(p)+":"+(customer?.id||"guest"));
    const existing=await getDb().select().from(orders).where(eq(orders.requestKey,requestKey)).limit(1);
    if(existing[0]) {
      if(existing[0].requestHash!==requestHash) return Response.json({error:"Состав запроса изменился. Начните оформление заново."},{status:409});
      return Response.json({orderNumber:existing[0].orderNumber,total:existing[0].total,id:existing[0].id,paymentRequired:existing[0].paymentStatus==="pending"});
    }
    const customerName=String(p.customerName || customer?.name || "").trim(),phone=normalizePhone(String(p.phone || customer?.phone || ""));
    const fulfillment=p.fulfillment;
    if(customerName.length<2 || customerName.length>100 || !phone || !["pickup","delivery"].includes(fulfillment)) throw new Error("Проверьте имя, телефон и способ получения");
    if(p.consent!==true) throw new Error("Подтвердите согласие на обработку данных");
    if(p.offerAccepted!==true) throw new Error("Примите публичную оферту");
    const paymentMethod = p.paymentMethod ?? (paymentReady() ? "online" : "on_receipt");
    if (!["online", "on_receipt"].includes(paymentMethod)) throw new Error("Выберите способ оплаты");
    if (paymentMethod === "online" && !paymentReady()) throw new Error("Онлайн-оплата временно недоступна. Выберите оплату при получении.");
    const onlinePayment = paymentMethod === "online";
    const catalog=await listProducts();
    const store=await readStoreData(),settings={...DEFAULT_SETTINGS,...store.settings};
    validateSlot(String(p.deliveryDate),String(p.deliveryTime),fulfillment,settings);
    if(fulfillment==="pickup" && !["kraulya","tokarey"].includes(p.branchId)) throw new Error("Выберите магазин");
    const extras=catalogExtras(settings.extras,catalog,store.categories);
    if(!Array.isArray(p.items) || !p.items.length || p.items.length>50) throw new Error("Проверьте состав корзины");
    const resolved=p.items.map((i:{productId:number;variantId:string;quantity:number;extras:string[]})=>{
      const product=catalog.find(x=>x.id===Number(i.productId)),variant=product?.variants.find(x=>x.id===i.variantId);
      if(!product?.available || product.hidden || !store.categories.some(c=>c.name===product.category && c.visible) || !variant?.available || !Number.isInteger(i.quantity) || i.quantity<1 || i.quantity>20) throw new Error("Один из товаров недоступен. Обновите корзину.");
      if(!Array.isArray(i.extras) || i.extras.length>50) throw new Error("Слишком много дополнений");
      const selected=i.extras.map(id=>{
        const extra=extras.find(e=>e.id===id);
        if(!extra || extra.available===false) throw new Error("Одно из дополнений больше недоступно");
        if(extra.kind==="flower" && product.acceptsFlowers===false) throw new Error("Цветы можно добавлять только к букетам и композициям");
        return extra;
      });
      return {product,variant,quantity:i.quantity,selected,price:variant.price+selected.reduce((sum,e)=>sum+e.price,0)};
    });
    const subtotal=resolved.reduce((sum:{valueOf():number}|number,i:{price:number;quantity:number})=>Number(sum)+i.price*i.quantity,0) as number;
    if(!Number.isSafeInteger(subtotal) || subtotal<settings.minOrder || subtotal>10000000) throw new Error("Проверьте сумму заказа. Минимум "+settings.minOrder+" ₽.");
    const bonusSpent=Number(p.bonusSpend||0),maxBonus=customer?Math.max(0,Math.min(customer.bonusBalance,Math.floor(subtotal*settings.bonusMaxSpendPercent/100))):0;
    if(!Number.isInteger(bonusSpent) || bonusSpent<0 || bonusSpent>maxBonus) throw new Error("Бонусный баланс изменился. Обновите сумму списания.");
    const address=String(p.address||"").trim();
    const quote=fulfillment==="delivery"?await verifyQuote(String(p.deliveryToken||""),address):null;
    const deliveryPrice=quote?.price||0,total=subtotal+deliveryPrice-bonusSpent;
    if(Number(p.expectedTotal)!==total) throw new Error("Цена изменилась. Обновите корзину и подтвердите новую сумму.");
    const id=crypto.randomUUID(),orderNumber="ДМ-"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
    const accessToken=String(p.accessToken||"");
    if(!/^[a-f0-9-]{36}$/.test(accessToken)) throw new Error("Обновите форму заказа");
    const recipientName=p.otherRecipient?String(p.recipientName||"").trim().slice(0,100):"";
    const recipientPhone=p.otherRecipient?normalizePhone(String(p.recipientPhone||"")):"";
    if(p.otherRecipient && (!recipientName || !recipientPhone)) throw new Error("Укажите имя и телефон получателя");
    const details={apartment:String(p.apartment||"").slice(0,30),entrance:String(p.entrance||"").slice(0,30),floor:String(p.floor||"").slice(0,10),intercom:String(p.intercom||"").slice(0,30),coordinates:quote?.coordinates,method:quote?.method,consentAt:new Date().toISOString(),consentVersion:CONSENT_VERSION,offerVersion:CONSENT_VERSION,paymentTest:paymentTest(),fiscal:fiscalSettings()};
    Object.assign(details, { paymentMethod });
    const invoice=onlinePayment?String(BigInt("0x"+crypto.randomUUID().replaceAll("-","").slice(0,15))):null;
    const paymentStatus=onlinePayment?"pending":"not_required";
    const db=database();
    const insert=db.prepare("INSERT INTO orders(id,order_number,request_key,request_hash,access_hash,customer_id,customer_name,phone,recipient_name,recipient_phone,fulfillment,delivery_date,delivery_time,branch_id,address,comment,subtotal,delivery_price,bonus_spent,bonus_earned,total,payment_status,robokassa_invoice_id,delivery_details) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM bonus_operations WHERE id=? AND customer_id=?)").bind(
      id,orderNumber,requestKey,requestHash,await sha256(accessToken),customer?.id||null,customerName,phone,recipientName,recipientPhone,fulfillment,p.deliveryDate,p.deliveryTime,quote?.branch.id||p.branchId,fulfillment==="delivery"?address:"",String(p.comment||"").slice(0,2000),subtotal,deliveryPrice,bonusSpent,Math.floor((subtotal-bonusSpent)*settings.bonusPercent/100),total,paymentStatus,invoice,JSON.stringify(details),bonusSpent,"spend:"+id,customer?.id||null);
    try {
      await db.batch([...(customer && bonusSpent?spendBonuses(customer.id,id,bonusSpent,orderNumber):[]),insert,...resolved.map((i:{product:{id:number;name:string};variant:{name:string};selected:unknown[];price:number;quantity:number})=>db.prepare("INSERT INTO order_items(order_id,product_id,product_name,variant_name,extras_json,price,quantity) VALUES(?,?,?,?,?,?,?)").bind(id,i.product.id,i.product.name,i.variant.name,JSON.stringify(i.selected),i.price,i.quantity)),notificationStatement("new:"+id,"Новый заказ "+orderNumber+" · "+total+" ₽. Подробности в кабинете.",customer?.id||null)]);
    } catch(error) {
      const [retry]=await getDb().select().from(orders).where(eq(orders.requestKey,requestKey)).limit(1);
      if(retry?.requestHash===requestHash) return Response.json({orderNumber:retry.orderNumber,total:retry.total,id:retry.id,paymentRequired:retry.paymentStatus==="pending"});
      if(String(error).includes("INSUFFICIENT_BONUS")) throw new Error("Бонусы уже использованы в другом заказе. Обновите корзину.");
      throw error;
    }
    return Response.json({orderNumber,total,id,paymentRequired:onlinePayment},{status:201});
  } catch(error) { console.error("order:create",error instanceof Error?error.name:"error"); return Response.json({error:error instanceof Error && !/D1_|SQLITE|constraint/i.test(error.message)?error.message:"Не удалось сохранить заказ. Данные не потеряны — попробуйте ещё раз."},{status:400}); }
}
export async function GET(request:Request) {
  const auth=await requireAdminApi();if(!auth.ok)return auth.response;
  const u=new URL(request.url),q=u.searchParams.get("q")||"",status=u.searchParams.get("status")||"",customerId=u.searchParams.get("customer")||"";
  const page=Math.max(0,Math.floor(Number(u.searchParams.get("page"))||0));
  const rows=await getDb().select().from(orders).where(and(status?eq(orders.status,status):undefined,customerId?eq(orders.customerId,customerId):undefined,q?or(like(orders.phone,"%"+q+"%"),like(orders.orderNumber,"%"+q+"%")):undefined)).orderBy(desc(orders.createdAt)).limit(51).offset(page*50);
  const ids=rows.slice(0,50).map(o=>o.id),items=ids.length?await getDb().select().from(orderItems).where(inArray(orderItems.orderId,ids)):[];
  return Response.json({hasMore:rows.length>50,orders:rows.slice(0,50).map(o=>({...o,accessHash:undefined,requestHash:undefined,requestKey:undefined,items:items.filter(i=>i.orderId===o.id)}))});
}
export async function PATCH(request:Request) {
  const auth=await requireAdminApi();if(!auth.ok)return auth.response;
  try {
    sameOrigin(request); const p=await request.json();
    const [current]=await getDb().select().from(orders).where(eq(orders.id,String(p.id))).limit(1);
    if(!current) throw new Error("Заказ не найден");
    const target=String(p.status||current.status);
    if(!canTransition(current.status,target)) throw new Error("Такое изменение статуса недоступно");
    if(target==="cancelled" && ["paid","refund_pending"].includes(current.paymentStatus)) throw new Error("Для оплаченного заказа сначала выполните возврат");
    if(target==="completed" && !["paid","not_required"].includes(current.paymentStatus)) throw new Error("Сначала подтвердите оплату");
    let payment=current.paymentStatus;
    if(p.paymentStatus && p.paymentStatus!==payment) {
      if(current.robokassaInvoiceId || !["not_required","paid"].includes(p.paymentStatus)) throw new Error("Статус онлайн-оплаты меняется только по подтверждению Робокассы");
      payment=p.paymentStatus;
    }
    const db=database();
    const result=await db.batch([db.prepare("UPDATE orders SET status=?,payment_status=?,version=version+1 WHERE id=? AND version=? RETURNING id").bind(target,payment,current.id,Number(p.version)),db.prepare("INSERT OR IGNORE INTO notification_jobs(id,chat_id,message) SELECT ? || ':' || chat_id,chat_id,? FROM telegram_subscribers WHERE (role='admin' OR (role='customer' AND customer_id=?)) AND EXISTS(SELECT 1 FROM orders WHERE id=? AND version=? AND status=?)").bind("status:"+current.id+":"+target,"Заказ "+current.orderNumber+": "+target,current.customerId,current.id,Number(p.version)+1,target),...orderBonuses(current.id,current.customerId,target,Number(p.version)+1)]);
    if(!result[0].results.length) return Response.json({error:"Заказ уже изменился. Обновите список."},{status:409});
    if(target==="completed")try{await enqueueFinalReceipt(current.id);}catch{/* scheduled reconciliation will retry */}
    return Response.json({ok:true});
  } catch(error){return Response.json({error:error instanceof Error?error.message:"Не удалось обновить"},{status:400});}
}
