"use client";
import { useCallback,useEffect,useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { ORDER_STATUSES,normalizeOrderStatus,orderStatusLabel } from "@/lib/order-status";
import { BRANCHES,formatPrice,type Extra } from "@/lib/catalog";
import { ConfirmAction } from "@/components/confirm-action";

const payments:Record<string,string>={not_required:"Не оплачено",pending:"Не оплачено",paid:"Оплачено",refund_pending:"Возврат обрабатывается",refunded:"Возвращён"};
type Order={id:string;version:number;orderNumber:string;customerName:string;phone:string;recipientName:string;recipientPhone:string;fulfillment:string;branchId:string;address:string;deliveryDate:string;deliveryTime:string;deliveryDetails:string;comment:string;subtotal:number;deliveryPrice:number;bonusSpent:number;total:number;status:string;paymentStatus:string;robokassaInvoiceId:string|null;items:{id:number;productName:string;variantName:string;quantity:number;price:number;extrasJson:string}[]};
export function AdminOrders({customerId}:{customerId?:string}) {
  const [statuses,setStatuses]=useState(ORDER_STATUSES),[customName,setCustomName]=useState("");
  const [rows,setRows]=useState<Order[]>([]),[page,setPage]=useState(0),[more,setMore]=useState(false),[query,setQuery]=useState(""),[status,setStatus]=useState("all"),[loading,setLoading]=useState(false),[selected,setSelected]=useState<Order|null>(null),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);try {const u=new URLSearchParams({page:String(page),q:query,status:status==="all"?"":status,customer:customerId||""});
      const r=await fetch("/api/orders?"+u),d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.orders);setStatuses(d.statuses||ORDER_STATUSES);setMore(d.hasMore);
    }catch(e){toast.error(e instanceof Error?e.message:"Не удалось загрузить заказы");}finally{setLoading(false);}
  },[page,query,status,customerId]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),250);return()=>clearTimeout(timer);},[load]);
  const refresh=useCallback(async(id:string)=>{
    const r=await fetch("/api/orders?"+new URLSearchParams({id}),{cache:"no-store",signal:AbortSignal.timeout(12000)}),d=await r.json();
    if(!r.ok||!d.orders?.[0])throw new Error("Не удалось обновить заказ");
    setSelected(current=>current?.id===id && current.version<=d.orders[0].version?d.orders[0]:current);
  },[]);
  useEffect(()=>{if(!selected?.robokassaInvoiceId||selected.paymentStatus!=="pending"||busy)return;let locked=false;const timer=setInterval(()=>{if(locked||document.visibilityState!=="visible")return;locked=true;void refresh(selected.id).catch(()=>{}).finally(()=>{locked=false;});},15000);return()=>clearInterval(timer);},[selected?.id,selected?.paymentStatus,selected?.robokassaInvoiceId,busy,refresh]);
  async function addStatus(){const name=customName.trim();if(!name)return;setBusy(true);try{const existing=Object.keys(statuses).filter(k=>k.startsWith("custom:")).map(k=>k.slice(7));const r=await fetch("/api/admin/data",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({entity:"settings",values:{customOrderStatuses:[...existing,name]}})}),d=await r.json();if(!r.ok)throw new Error(d.error);setCustomName("");await load();}catch(e){toast.error(e instanceof Error?e.message:"Не удалось добавить статус");}finally{setBusy(false);}}
  async function update(order:Order,values:Record<string,unknown>) {
    setBusy(true);try {const r=await fetch("/api/orders",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:order.id,version:order.version,...values})}),d=await r.json();if(!r.ok)throw new Error(d.error);toast.success("Заказ обновлён");await refresh(order.id);await load();}catch(e){toast.error(e instanceof Error?e.message:"Не удалось сохранить");await refresh(order.id).catch(()=>{});}finally{setBusy(false);}
  }
  async function refund(order:Order,action:string) {
    setBusy(true);try {const r=await fetch("/api/payment/refund",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:order.id,action})}),d=await r.json();if(!r.ok)throw new Error(d.error);toast.success(d.status==="finished"?"Возврат подтверждён":"Статус возврата: "+d.status);await refresh(order.id);await load();}catch(e){toast.error(e instanceof Error?e.message:"Не удалось выполнить возврат");}finally{setBusy(false);}
  }
  let details:Record<string,unknown>={};try{details=JSON.parse(selected?.deliveryDetails||"{}");}catch{}
  return <div><div className="admin-section-head"><h2>Заказы</h2><Button variant="outline" onClick={()=>void load()}>Обновить</Button></div><div className="admin-filter-row"><input aria-label="Поиск заказов" placeholder="Номер заказа или телефон" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><div style={{display:"flex",flexWrap:"wrap",gap:8}} role="group" aria-label="Фильтр заказов">{Object.entries({all:"Все",...statuses}).map(([v,n])=><Button key={v} type="button" variant={status===v?"default":"outline"} aria-pressed={status===v} onClick={()=>{setStatus(v);setPage(0);}}>{n}</Button>)}</div></div>
    {loading?<p role="status">Загружаем…</p>:!rows.length?<p>Заказов не найдено.</p>:<div className="order-list">{rows.map(o=><button key={o.id} className="order-card order-open" onClick={()=>setSelected(o)}><div className="order-card-head"><strong>{o.orderNumber}</strong><strong>{formatPrice(o.total)}</strong></div><h3>{o.customerName}</h3><p>{o.phone} · {o.deliveryDate} {o.deliveryTime}</p><p>{orderStatusLabel(o.status)} · {payments[o.paymentStatus]}</p><span>Открыть заказ →</span></button>)}</div>}
    <div className="map-actions"><Button variant="outline" disabled={!page||loading} onClick={()=>setPage(page-1)}>Назад</Button><span>Страница {page+1}</span><Button variant="outline" disabled={!more||loading} onClick={()=>setPage(page+1)}>Далее</Button></div>
    <Dialog open={!!selected} onOpenChange={open=>!open&&setSelected(null)}><DialogContent className="order-detail-dialog"><DialogHeader><DialogTitle>{selected?.orderNumber}</DialogTitle><DialogDescription>Состав, контакты, получение и оплата.</DialogDescription></DialogHeader>{selected && <div className="order-detail"><>{selected.robokassaInvoiceId && details.paymentTest===true&&<p className="test-payment-note">Тестовый заказ. Деньги не списывались; реальная доставка и возврат не требуются.</p>}</><h3>Покупатель</h3><p>{selected.customerName} · <a href={"tel:"+selected.phone}>{selected.phone}</a></p>{selected.recipientName && <><h3>Получатель</h3><p>{selected.recipientName} · <a href={"tel:"+selected.recipientPhone}>{selected.recipientPhone}</a></p></>}<h3>{selected.fulfillment==="pickup"?"Самовывоз":"Доставка"}</h3><p>{selected.deliveryDate} · {selected.deliveryTime} (Екатеринбург)</p><p>{selected.fulfillment==="pickup"?BRANCHES.find(b=>b.id===selected.branchId)?.address:selected.address}</p>{selected.fulfillment==="delivery" && (["apartment","entrance","floor","intercom"] as const).map((k,i)=>details[k]?<p key={k}>{["Квартира / офис","Подъезд","Этаж","Домофон"][i]}: {String(details[k])}</p>:null)}
      {selected.fulfillment==="delivery" && typeof details.distanceKm==="number" && <p>Расстояние: {details.distanceKm} км · {details.method==="road"?"по автомобильным дорогам":"приблизительно, по прямой × 1,28"}</p>}<h3>Состав заказа</h3>{selected.items.map(i=><article key={i.id} className="order-item-detail"><strong>{i.productName} · {i.variantName} × {i.quantity}</strong><span>{formatPrice(i.price*i.quantity)}</span><small>{extrasText(i.extrasJson)}</small></article>)}<p>Товары: {formatPrice(selected.subtotal)} · Доставка: {formatPrice(selected.deliveryPrice)} · Бонусы: −{formatPrice(selected.bonusSpent)}</p><h3>Итого: {formatPrice(selected.total)}</h3>{selected.status==="completed" && selected.robokassaInvoiceId && <Button variant="outline" onClick={async()=>{try{await fetch("/api/admin/fiscal",{method:"POST"});const r=await fetch("/api/admin/fiscal?order="+selected.id),d=await r.json();toast.info(d.receipt?"Итоговый чек: "+({new:"в очереди",pending:"ожидает подтверждения",done:"зарегистрирован",error:"ошибка, проверьте кабинет Робокассы"}[d.receipt.status as "new"]||d.receipt.status):"Итоговый чек ещё не создан или не требуется для этого способа расчёта");}catch{toast.error("Не удалось проверить чек");}}}>Проверить итоговый чек</Button>}{selected.comment&&<p className="order-comment">{selected.comment}</p>}<p>Способ оплаты: {selected.robokassaInvoiceId?"Онлайн через Робокассу":"При получении"}</p><p>Статус оплаты: <strong>{payments[selected.paymentStatus]}</strong></p>
      <h3>Статус заказа</h3><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}} role="group" aria-label="Статус заказа">{Object.entries(statuses).map(([v,n])=>{
 const active=normalizeOrderStatus(selected.status)===v;
 if(v==="completed" && !selected.robokassaInvoiceId && selected.paymentStatus==="not_required")return <IssueOrder key={v} order={selected} disabled={busy} onConfirm={received=>update(selected,{status:v,paymentReceived:received})}/>;
 return <Button key={v} disabled={busy||active} variant={active?"default":"outline"} aria-pressed={active} onClick={()=>void update(selected,{status:v})}>{n}</Button>;
})}</div>

{selected.robokassaInvoiceId && selected.paymentStatus==="pending" && <small>Подтверждение оплаты обновляется автоматически.</small>}
<details><summary>Добавить свой статус</summary><input maxLength={40} value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Например, Передан курьеру"/><Button type="button" disabled={busy||!customName.trim()} onClick={()=>void addStatus()}>Добавить статус</Button></details>
      {selected.robokassaInvoiceId && selected.paymentStatus==="paid" && <ConfirmAction disabled={busy} label="Вернуть всю сумму через Робокассу" description={"Будет запрошен возврат "+formatPrice(selected.total)+". Повторный запрос заблокирован до проверки результата."} onConfirm={()=>void refund(selected,"create")}/>}
      {selected.paymentStatus==="refund_pending" && <Button disabled={busy} variant="outline" onClick={()=>void refund(selected,"check")}>Проверить возврат</Button>}
    </div>}</DialogContent></Dialog>
  </div>;
}
function extrasText(raw:string) {try {const extras=JSON.parse(raw) as Extra[];const counts=new Map<string,{name:string;count:number}>();for(const e of extras){const old=counts.get(e.id);counts.set(e.id,{name:e.name,count:(old?.count||0)+1});}return [...counts.values()].map(e=>e.name+" × "+e.count).join("; ");}catch{return "";}}

function IssueOrder({order,disabled,onConfirm}:{order:Order;disabled:boolean;onConfirm:(received:boolean)=>Promise<void>}) {
 const [open,setOpen]=useState(false),[received,setReceived]=useState(false);
 return <><Button type="button" variant="outline" disabled={disabled} onClick={()=>{setReceived(false);setOpen(true);}}>Выдан</Button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Выдача заказа</DialogTitle><DialogDescription>{order.orderNumber} · К оплате {formatPrice(order.total)}</DialogDescription></DialogHeader>
 <label className="check-row"><input type="checkbox" checked={received} onChange={e=>setReceived(e.target.checked)}/>Деньги получены</label>
 <p>{received?"Заказ будет выдан, оплата подтверждена.":"Заказ будет выдан со статусом «Не оплачено»."}</p>
 <Button disabled={disabled} onClick={async()=>{await onConfirm(received);setOpen(false);}}>Подтвердить выдачу</Button></DialogContent></Dialog></>;
}
