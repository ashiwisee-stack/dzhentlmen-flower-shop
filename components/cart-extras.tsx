"use client";
import { QuantityInput } from "@/components/quantity-input";
import { useState } from "react";
import Image from "@/components/shop-image";
import { formatPrice,type Extra } from "@/lib/catalog";
export function CartExtras({extras,selected,onChange,flowers}:{extras:Extra[];selected:string[];onChange:(ids:string[])=>void;flowers:boolean}) {
  const [query,setQuery]=useState("");
  const options=extras.filter(e=>flowers?e.kind==="flower":e.kind!=="flower");
  if(!options.length)return null;
  function change(id:string,n:number){onChange([...selected.filter(x=>x!==id),...Array(Math.max(0,Math.min(500-selected.filter(x=>x!==id).length,n))).fill(id)]);}
  return <details className="cart-extra-editor" open={!flowers}><summary>{flowers?"Дополнительные товары":"С этим товаром ещё берут"}</summary><label className="flower-search"><span>{flowers?"Поиск товара":"Поиск дополнения"}</span><input type="search" placeholder={flowers?"Название товара":"Название"} value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="extra-options">{!options.some(e=>e.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))&&<p role="status">Ничего не найдено по этому названию.</p>}{options.filter(e=>e.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))).map(e=>{const count=selected.filter(id=>id===e.id).length;return <article key={e.id}>{e.image && <Image src={e.image} alt="" width={64} height={64}/>}<div><strong>{e.name}</strong><small>{formatPrice(e.price)} / шт. · {e.available===false?"Нет в наличии":"В наличии"}</small></div><div className="quantity"><button type="button" disabled={!count} aria-label={"Убрать "+e.name} onClick={()=>change(e.id,count-1)}>−</button><QuantityInput value={count} onChange={n=>change(e.id,n)} max={500-selected.filter(id=>id!==e.id).length} label={"Количество: "+e.name} disabled={e.available===false}/><button type="button" disabled={e.available===false || selected.length>=500} aria-label={"Добавить "+e.name} onClick={()=>change(e.id,count+1)}>+</button></div></article>;})}</div></details>;
}
