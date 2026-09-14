"use client";
import { useEffect,useState } from "react";
export function QuantityInput({value,onChange,min=0,max=500,label,disabled=false}:{value:number;onChange:(n:number)=>void;min?:number;max?:number;label:string;disabled?:boolean}) {
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 function finish(){const n=Number(draft);if(!draft || !Number.isInteger(n) || n<min || n>max)setDraft(String(value));else onChange(n);}
 return <input aria-label={label} type="number" inputMode="numeric" min={min} max={max} step={1} disabled={disabled} value={draft} style={{width:"5rem",minWidth:0,textAlign:"center",padding:"6px",fontSize:"1rem"}} onChange={e=>{setDraft(e.target.value);const n=Number(e.target.value);if(e.target.value && Number.isInteger(n) && n>=min && n<=max)onChange(n);}} onBlur={finish} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();finish();}}}/>;
}