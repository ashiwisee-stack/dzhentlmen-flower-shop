"use client";
import { useState } from "react";
import { Send,Check,Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function TelegramLogin({onLogin}:{onLogin:()=>Promise<void>}) {
  const [consent,setConsent]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [challenge,setChallenge]=useState<{url:string;code:string;expires:number}|null>(null);
  async function action(kind:"start"|"check"|"cancel") {
    setLoading(true);setError("");
    try {
      const r=await fetch("/api/auth/telegram",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:kind,consent})}),d=await r.json();
      if(!r.ok)throw new Error(d.error);
      if(kind==="start")setChallenge(d);
      else if(kind==="cancel")setChallenge(null);
      else if(d.pending)setError("Пока ждём подтверждения. Откройте бота и нажмите кнопку отправки своего номера.");
      else await onLogin();
    }catch(e){setError(e instanceof Error?e.message:"Не удалось войти");}finally{setLoading(false);}
  }
  return <div className="auth-form telegram-login"><div className="auth-icon"><Send/></div><h3>Войти через Telegram</h3><p>Подтвердите свой номер в боте. История заказов и бонусы сохранятся в личном кабинете.</p>{!challenge?<><label className="check-row"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Даю <a href="/consent" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</a>. <a href="/privacy" target="_blank" rel="noopener noreferrer">Политика</a></span></label><Button disabled={!consent||loading} onClick={()=>void action("start")}>{loading?<Loader2 className="spin"/>:<Send/>}Продолжить через Telegram</Button></>:<><div className="tg-challenge"><small>Сверьте этот код в боте</small><strong>{challenge.code}</strong><p>Ссылка действует 10 минут. Подтверждайте вход только для своего устройства.</p></div><a className="tg-open" href={challenge.url} target="_blank" rel="noopener noreferrer"><Send/>Открыть бота</a><Button disabled={loading} onClick={()=>void action("check")}>{loading?<Loader2 className="spin"/>:<Check/>}Я подтвердил — войти</Button><button type="button" className="auth-back" disabled={loading} onClick={()=>void action("cancel")}>Отменить и начать заново</button></>}{error&&<p role="alert" className="tg-error">{error}</p>}<small>Заказ можно оформить и без входа.</small></div>;
}
