import { roadDistances } from "@/lib/road-routing";
import { env } from "cloudflare:workers";
import { BRANCHES, DEFAULT_SETTINGS } from "@/lib/catalog";
import { readStoreData } from "@/lib/store-storage";
import { authSecret } from "@/lib/customer-auth";
import { safeEqual } from "@/lib/security";
import { splitAddress, uniqueAddresses, type AddressResult } from "@/lib/address-results";
export type Coordinates = [number,number];
export function inZone(point:Coordinates, polygon:number[][]) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [yi,xi]=polygon[i], [yj,xj]=polygon[j], [y,x]=point;
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export async function findAddresses(query:string) {
  const {settings}=await readStoreData();
  const zone=settings.deliveryZone as number[][];
  const search = /екатеринбург/i.test(query) ? query : "Екатеринбург, " + query;
  const parts = splitAddress(query);
  let rows:AddressResult[];
  if (env.GEOCODER_URL) {
    const url=new URL("search",String(env.GEOCODER_URL).replace(/\/?$/,"/"));
    url.search=new URLSearchParams({q:search,format:"jsonv2",limit:"8",addressdetails:"1",countrycodes:"ru"}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error("Поиск адресов временно недоступен. Выберите точку на карте.");
    const data=await response.json() as {display_name:string;lat:string;lon:string;address?:{house_number?:string}}[];
    rows=data.map(row=>({label:row.display_name,coordinates:[Number(row.lat),Number(row.lon)],precision:row.address?.house_number?"house":"street",houseNumber:row.address?.house_number}));
  } else {
    // Explicit searches only. Public Photon permits reasonable use but has no SLA.
    // Operators may configure their own Photon or the existing Nominatim adapter.
    if(env.PHOTON_URL === "disabled") throw new Error("Поиск адресов отключён. Укажите адрес и отметьте дом на карте.");
    const url=new URL(parts.houseNumber ? "structured" : "api",String(env.PHOTON_URL || "https://photon.komoot.io/").replace(/\/?$/,"/"));
    const lat=zone.map(point=>point[0]),lon=zone.map(point=>point[1]);
    const parameters = new URLSearchParams({limit:"12",bbox:[Math.min(...lon),Math.min(...lat),Math.max(...lon),Math.max(...lat)].join(","),lat:"56.835",lon:"60.59"});
    if (parts.houseNumber) { parameters.set("city", "Екатеринбург"); parameters.set("street", parts.street); parameters.set("housenumber", parts.houseNumber); }
    else parameters.set("q", search);
    url.search=parameters.toString();
    const response=await fetch(url,{headers:{"accept-language":"ru"},signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error("Поиск адресов временно недоступен. Попробуйте позже или отметьте дом на карте.");
    const data=await response.json() as {features?:{geometry:{coordinates:number[]};properties:Record<string,string>}[]};
    rows=(data.features || []).map(feature=>{
      const p=feature.properties;
      const street=[p.street||p.name,p.housenumber].filter(Boolean).join(", ");
      return {label:[p.city||p.town||"Екатеринбург",street].filter(Boolean).join(", "),coordinates:[feature.geometry.coordinates[1],feature.geometry.coordinates[0]],precision:p.housenumber?"house":"street",houseNumber:p.housenumber};
    });
  }
  return uniqueAddresses(rows.filter(row=>row.label && row.coordinates.every(Number.isFinite) && inZone(row.coordinates,zone)), parts.houseNumber);
}
function directKm(a:Coordinates,b:Coordinates) {
  const rad=(n:number)=>n*Math.PI/180;
  const h=Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
async function signature(value:string) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(authSecret()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,"0")).join("");
}
export async function quoteDelivery(address:string,point?:Coordinates) {
  const destination=point || (await findAddresses(address)).find(row=>row.precision === "house")?.coordinates;
  if (!destination || destination.length!==2 || !destination.every(Number.isFinite) || Math.abs(destination[0])>90 || Math.abs(destination[1])>180) throw new Error("Выберите адрес или точку доставки");
  const store=await readStoreData(),s={...DEFAULT_SETTINGS,...store.settings};
  if(!inZone(destination,s.deliveryZone)) throw new Error("Адрес находится за пределами зоны доставки");
  const distances=s.deliveryMode==="road"?await roadDistances(destination):BRANCHES.map(branch=>directKm(branch.coordinates,destination)*1.28);
  const candidates=BRANCHES.flatMap((branch,index)=>distances[index]===null?[]:[{branch,km:distances[index]!}]);
  if(!candidates.length) throw new Error("К этому дому не найден автомобильный маршрут. Уточните точку на карте.");
  const nearest=candidates.sort((a,b)=>a.km-b.km)[0];
  const distanceKm=Number(nearest.km.toFixed(1));
  const price=Math.round(s.deliveryBase+Math.max(0,distanceKm-s.deliveryIncludedKm)*s.deliveryPerKm);
  const quote={address:address.trim(),coordinates:destination,distanceKm,price,branch:nearest.branch,method:s.deliveryMode==="road"?"road":"estimate",tariff:{base:s.deliveryBase,perKm:s.deliveryPerKm,includedKm:s.deliveryIncludedKm},expires:Date.now()+15*60000};
  const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(quote))));
  return {...quote,token:encoded+"."+await signature(encoded)};
}
export async function verifyQuote(token:string,address:string) {
  const [value,sig]=token.split(".");
  if(!value || !sig || !safeEqual(await signature(value),sig)) throw new Error("Рассчитайте доставку заново");
  const quote=JSON.parse(decodeURIComponent(escape(atob(value)))) as Awaited<ReturnType<typeof quoteDelivery>>;
  if(quote.expires<Date.now() || quote.address!==address.trim()) throw new Error("Расчёт доставки устарел. Рассчитайте заново.");
  const store=await readStoreData();
  if(!inZone(quote.coordinates,store.settings.deliveryZone as number[][])) throw new Error("Этот адрес больше не входит в зону доставки");
  const s={...DEFAULT_SETTINGS,...store.settings};
  if (!quote.tariff || quote.tariff.base!==s.deliveryBase || quote.tariff.perKm!==s.deliveryPerKm || quote.tariff.includedKm!==s.deliveryIncludedKm || quote.method!==(s.deliveryMode==="road"?"road":"estimate")) throw new Error("Тариф доставки изменился. Обновите стоимость доставки.");
  return quote;
}
