import { tokenAuth,challengeToken } from "@/lib/auth-transport";
import { env } from "cloudflare:workers";
import { database } from "@/db";
import { makeCustomerCookie,sha256 } from "@/lib/customer-auth";
import { limitRequest,randomCode } from "@/lib/security";
import { telegramReady,telegramCall } from "@/lib/telegram";
import { CONSENT_VERSION } from "@/lib/consent";
const COOKIE="dm_tg_challenge";
function challengeCookie(value:string,request:Request,clear=false) {
  return `${COOKIE}=${value}; Path=/api/auth/telegram; HttpOnly; SameSite=Strict; Max-Age=${clear?0:600}${new URL(request.url).protocol==="https:"?"; Secure":""}`;
}
export async function POST(request:Request) {
  try {
    const p=await request.json() as {action?:string;consent?:boolean};
    await limitRequest(request,p.action==="start"?"tg-start":"tg-poll",p.action==="start"?10:180,600);
    if(!telegramReady()) throw new Error("Вход через Telegram ещё не подключён");
    const db=database(),now=Date.now();
    const cookie=challengeToken(request,COOKIE);
    if(p.action==="start") {
      if(p.consent!==true) throw new Error("Подтвердите согласие на обработку данных");
      const bot=env.TELEGRAM_BOT_USERNAME?{username:env.TELEGRAM_BOT_USERNAME}:await telegramCall("getMe",{});
      const token=crypto.randomUUID().replaceAll("-",""),browser=crypto.randomUUID()+crypto.randomUUID(),code=randomCode();
      await db.batch([
        db.prepare("DELETE FROM telegram_auth WHERE expires<? OR browser_hash=?").bind(now,cookie?await sha256(cookie):""),
        db.prepare("INSERT INTO telegram_auth(token,browser_hash,expires,code,consent_version) VALUES(?,?,?,?,?)").bind(await sha256(token),await sha256(browser),now+600000,code,CONSENT_VERSION),
      ]);
      return Response.json({url:`https://t.me/${bot.username}?start=auth_${token}`,code,expires:now+600000,...(tokenAuth(request)?{challengeToken:browser}:{})},{headers:tokenAuth(request)?{"cache-control":"no-store"}:{"set-cookie":challengeCookie(browser,request),"cache-control":"no-store"}});
    }
    if(!cookie) throw new Error("Начните вход заново в этом браузере");
    const hash=await sha256(cookie);
    if(p.action==="cancel") {await db.prepare("DELETE FROM telegram_auth WHERE browser_hash=?").bind(hash).run();return Response.json({ok:true,clearChallenge:true},{headers:tokenAuth(request)?{"cache-control":"no-store"}:{"set-cookie":challengeCookie("",request,true),"cache-control":"no-store"}});}
    if(p.action!=="check") throw new Error("Неизвестное действие");
    const challenge=await db.prepare("SELECT token,customer_id FROM telegram_auth WHERE browser_hash=? AND expires>?").bind(hash,now).first<{token:string;customer_id:string|null}>();
    if(!challenge) throw new Error("Ссылка для входа истекла. Начните заново.");
    if(!challenge.customer_id) return Response.json({pending:true},{headers:{"cache-control":"no-store"}});
    const session=crypto.randomUUID()+crypto.randomUUID();
    const results=await db.batch([
      db.prepare("INSERT INTO customer_sessions(id,customer_id,token_hash,expires_at) SELECT ?,customer_id,?,? FROM telegram_auth WHERE token=? AND browser_hash=? AND expires>? AND customer_id IS NOT NULL RETURNING customer_id").bind(crypto.randomUUID(),await sha256(session),new Date(now+2592000000).toISOString(),challenge.token,hash,now),
      db.prepare("DELETE FROM telegram_auth WHERE token=? AND browser_hash=?").bind(challenge.token,hash),
    ]);
    if(!results[0].results.length) throw new Error("Вход уже завершён. Обновите страницу.");
    const headers=new Headers({"cache-control":"no-store"});if(!tokenAuth(request)){headers.append("set-cookie",makeCustomerCookie(session,request));headers.append("set-cookie",challengeCookie("",request,true));}
    return Response.json({ok:true,clearChallenge:true,...(tokenAuth(request)?{authToken:session}:{})},{headers});
  } catch(e) {return Response.json({error:e instanceof Error?e.message:"Не удалось войти"},{status:400,headers:{"cache-control":"no-store"}});}
}
