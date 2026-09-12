"use client";
import Image from "@/components/shop-image";
import { useState } from "react";
import { Dialog,DialogContent,DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function ProductGallery({images,name}:{images:string[];name:string}) {
  const [index,setIndex]=useState(0),[zoom,setZoom]=useState(false);
  const safe=images.length?images:["/products/lilac-roses.webp"];
  return <div className="product-gallery"><button className="gallery-main" type="button" onClick={()=>setZoom(true)} aria-label="Увеличить фотографию"><Image src={safe[index]||safe[0]} alt={name} fill sizes="(max-width:700px) 90vw, 480px" /></button><div className="gallery-thumbs">{safe.map((url,i)=><button type="button" key={url+i} className={i===index?"selected":""} onClick={()=>setIndex(i)} aria-label={"Фото "+(i+1)}><Image src={url} alt="" width={72} height={72}/></button>)}</div><Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="gallery-zoom"><DialogTitle>{name} — {index+1}/{safe.length}</DialogTitle><div className="zoom-photo" onTouchStart={e=>{e.currentTarget.dataset.start=String(e.touches[0].clientX);}} onTouchEnd={e=>{const delta=e.changedTouches[0].clientX-Number(e.currentTarget.dataset.start);if(Math.abs(delta)>50)setIndex((index+(delta<0?1:safe.length-1))%safe.length);}}><Image src={safe[index]||safe[0]} alt={name} fill sizes="90vw" /></div>{safe.length>1 && <div className="map-actions"><Button variant="outline" onClick={()=>setIndex((index+safe.length-1)%safe.length)}>Предыдущее</Button><Button variant="outline" onClick={()=>setIndex((index+1)%safe.length)}>Следующее</Button></div>}</DialogContent></Dialog></div>;
}
