import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
export function paymentTest() { return env.ROBOKASSA_TEST !== "0"; }
export async function paymentHash(value:string) { const algorithm=String(env.ROBOKASSA_HASH_ALGORITHM || "SHA256").toLowerCase(); if(!["md5","sha256"].includes(algorithm)) throw new Error("Неподдерживаемый алгоритм Робокассы"); return createHash(algorithm).update(value,"utf8").digest("hex"); }
export function paymentReady() { return env.ROBOKASSA_ENABLED === "1" && !!env.ROBOKASSA_LOGIN && !!env.ROBOKASSA_PASSWORD1 && !!env.ROBOKASSA_PASSWORD2 && (paymentTest() || (!!env.ROBOKASSA_TAX && !!env.ROBOKASSA_SNO && ["full_payment","full_prepayment"].includes(String(env.ROBOKASSA_PAYMENT_METHOD)))) && !!env.PUBLIC_ORIGIN; }
export function receiptItems(items:{productName:string;variantName:string;price:number;quantity:number}[],bonus:number,delivery:number,tax:string,method:string) {
  const subtotal=items.reduce((s,i)=>s+i.price*i.quantity,0);
  let remaining=bonus*100;
  const rows=items.map((i,index)=>{
    const gross=i.price*i.quantity*100;
    const discount=index===items.length-1?remaining:Math.floor(bonus*100*gross/(subtotal*100)); remaining-=discount;
    return {name:(i.productName+" "+i.variantName).slice(0,128),quantity:i.quantity,sum:(gross-discount)/100,tax,payment_method:method,payment_object:"commodity"};
  });
  if(delivery) rows.push({name:"Доставка",quantity:1,sum:delivery,tax,payment_method:method,payment_object:"service"});
  return rows;
}
export async function paymentUrl(order:{robokassaInvoiceId:string|null;total:number;orderNumber:string},receipt:unknown) {
  if(!paymentReady() || !order.robokassaInvoiceId) throw new Error("Онлайн-оплата ещё не подключена");
  const sum=order.total.toFixed(2),encoded=paymentTest()?null:encodeURIComponent(JSON.stringify(receipt));
  const signature=await paymentHash([env.ROBOKASSA_LOGIN,sum,order.robokassaInvoiceId,...(encoded?[encoded]:[]),env.ROBOKASSA_PASSWORD1].join(":"));
  const url=new URL("https://auth.robokassa.ru/Merchant/Index.aspx");
  url.search=new URLSearchParams({MerchantLogin:String(env.ROBOKASSA_LOGIN),OutSum:sum,InvId:order.robokassaInvoiceId,Description:order.orderNumber,...(encoded?{Receipt:encoded}:{}),SignatureValue:signature,Culture:"ru",IsTest:env.ROBOKASSA_TEST==="0"?"0":"1"}).toString();
  return url.href;
}
export function fiscalSettings() {return {tax:String(env.ROBOKASSA_TAX||"none"),sno:String(env.ROBOKASSA_SNO||""),method:String(env.ROBOKASSA_PAYMENT_METHOD||"")};}
export function refundReceiptItems(rows:ReturnType<typeof receiptItems>) {
  // Split a discounted line into at most two unit prices to preserve kopeks.
  return rows.flatMap(i=>{
    const total=Math.round(i.sum*100),unit=Math.floor(total/i.quantity),higher=total-unit*i.quantity;
    const row=(quantity:number,cost:number)=>({Name:i.name,Quantity:quantity,Cost:cost/100,Tax:i.tax,PaymentMethod:i.payment_method,PaymentObject:i.payment_object});
    return [...(i.quantity>higher?[row(i.quantity-higher,unit)]:[]),...(higher?[row(higher,unit+1)]:[])];
  });
}
export async function refundJwt(payload:unknown) {
  if(!env.ROBOKASSA_PASSWORD3) throw new Error("Для возвратов требуется Пароль №3 Робокассы");
  const b64=(s:string)=>btoa(unescape(encodeURIComponent(s))).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
  const value=b64(JSON.stringify({alg:"HS256",typ:"JWT"}))+"."+b64(JSON.stringify(payload));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(env.ROBOKASSA_PASSWORD3)),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
  return value+"."+btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
}
