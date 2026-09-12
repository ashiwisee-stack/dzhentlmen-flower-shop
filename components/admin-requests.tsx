"use client";
import { useEffect,useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
type Row={id:string;name:string;phone:string;comment:string;status:string;createdAt:string};
export function AdminRequests(){
  const [page,setPage]=useState(0),[rows,setRows]=useState<Row[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(false);
  async function load(){setBusy(true);try{const r=await fetch('/api/admin/data?page='+page),d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.requests);setMore(d.requestsMore);}catch{toast.error('Не удалось загрузить заявки');}finally{setBusy(false);}}
  useEffect(()=>{void load();},[page]);
  async function change(id:string,status:string){setBusy(true);try{const r=await fetch('/api/admin/data',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({entity:'request',id,status})});if(!r.ok)throw new Error();await load();}catch{toast.error('Статус не сохранён');}finally{setBusy(false);}}
  return <div><h2>Индивидуальные заявки</h2><p>Пожелания покупателей к нестандартным букетам.</p><div className="request-admin-list">{rows.map(r=><article key={r.id}><header><div><span>{new Date(r.createdAt).toLocaleString('ru-RU',{timeZone:'Asia/Yekaterinburg'})}</span><h3>{r.name||'Без имени'}</h3><a href={'tel:'+r.phone}>{r.phone}</a></div><select aria-label="Статус заявки" value={r.status} disabled={busy} onChange={e=>void change(r.id,e.target.value)}><option value="new">Новая</option><option value="contacted">Связались</option><option value="closed">Закрыта</option></select></header><p>{r.comment}</p></article>)}</div>{!rows.length&&<p>{busy?'Загрузка…':'Заявок пока нет'}</p>}<div className="map-actions"><Button variant="outline" disabled={!page||busy} onClick={()=>setPage(page-1)}>Назад</Button><span>Страница {page+1}</span><Button variant="outline" disabled={!more||busy} onClick={()=>setPage(page+1)}>Далее</Button></div></div>;
}
