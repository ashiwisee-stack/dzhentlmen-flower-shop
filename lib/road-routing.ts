import { env } from "cloudflare:workers";
import { database } from "@/db";
import { sha256 } from "@/lib/customer-auth";
import { BRANCHES } from "@/lib/catalog";

type Point = [number, number];
const unavailable = "Не удалось рассчитать маршрут по дорогам. Повторите расчёт чуть позже или выберите самовывоз.";
function validDistances(value:unknown): value is (number|null)[] {
  return Array.isArray(value) && value.length===BRANCHES.length && value.every(n=>n===null || typeof n==="number" && Number.isFinite(n) && n>=0);
}
export async function roadDistances(destination:Point):Promise<(number|null)[]> {
  if (!env.ROUTER_URL) throw new Error("Расчёт по дорогам не настроен. Выберите самовывоз или свяжитесь с магазином.");
  const root = new URL(String(env.ROUTER_URL).replace(/\/?$/, "/"));
  // One matrix request compares both origins in the store → customer direction.
  const points = [...BRANCHES.map(b=>b.coordinates), destination];
  const url = new URL("table/v1/driving/"+points.map(p=>p.slice().reverse().join(",")).join(";"), root);
  url.search = new URLSearchParams({sources:BRANCHES.map((_,i)=>i).join(";"),destinations:String(BRANCHES.length),annotations:"distance",radiuses:points.map(()=>"300").join(";")}).toString();
  const cache = (globalThis.caches as CacheStorage & {default?:Cache} | undefined)?.default;
  const cacheKey = new Request(new URL("/api/delivery/route-cache/"+await sha256(url.href), String(env.PUBLIC_ORIGIN || "https://shop.example.test")));
  try {
    const cached = await cache?.match(cacheKey);
    if (cached) { const distances:unknown=await cached.json(); if(validDistances(distances)) return distances; }
  } catch { /* A cache failure does not prevent a fresh route. */ }
  if (["routing.openstreetmap.de", "router.project-osrm.org"].includes(root.hostname)) {
    // Shared across Worker isolates: public FOSSGIS service permits at most 1 request/s.
    const now = Date.now();
    const claim = await database().prepare("INSERT INTO rate_limits(key,count,expires) VALUES('road-provider-slot',?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires=excluded.expires WHERE rate_limits.count<=? RETURNING key").bind(now+1100,Math.floor(now/1000)+3600,now).first();
    if (!claim) throw new Error("Расчёт маршрутов занят. Повторите через пару секунд.");
  }
  let distances:(number|null)[];
  try {
    const response = await fetch(url, {headers:{"user-agent":"DzhentlmenFlowers/1.0 ("+String(env.PUBLIC_ORIGIN || "flower-shop")+")",accept:"application/json"},signal:AbortSignal.timeout(10000),redirect:"manual"});
    const data = await response.json() as {code?:string;distances?:unknown[][]};
    if (!response.ok || data.code!=="Ok" || !Array.isArray(data.distances)) throw new Error(unavailable);
    const meters = data.distances.map(row=>Array.isArray(row) && row.length===1 ? row[0] : undefined);
    if (!validDistances(meters) || !meters.some(n=>n!==null)) throw new Error(unavailable);
    distances = meters.map(n=>n===null?null:n/1000);
  } catch { throw new Error(unavailable); }
  try { await cache?.put(cacheKey, Response.json(distances, {headers:{"cache-control":"public, max-age=900"}})); } catch { /* Optional cache. */ }
  return distances;
}
