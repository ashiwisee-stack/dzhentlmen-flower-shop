"use client";
import { useState } from "react";
import { authMode,setAuthMode } from "@/lib/customer-session-client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelegramLogin } from "@/components/telegram-login";
import { CallLogin } from "@/components/call-login";

function LoginMethods({ onLogin, methods }: { onLogin: () => Promise<void>; methods: { call: boolean; telegram: boolean } }) {
  if (!methods.telegram) return methods.call ? <CallLogin onLogin={onLogin} /> : <p role="status">Вход временно недоступен. Заказ можно оформить без входа.</p>;
  if (!methods.call) return <TelegramLogin onLogin={onLogin} />;
  return <Tabs defaultValue="call" className="customer-login">
    <TabsList aria-label="Способ входа"><TabsTrigger value="telegram">Telegram</TabsTrigger><TabsTrigger value="call">По звонку</TabsTrigger></TabsList>
    <TabsContent value="telegram"><TelegramLogin onLogin={onLogin} /></TabsContent>
    <TabsContent value="call"><CallLogin onLogin={onLogin} /></TabsContent>
  </Tabs>;
}

export function CustomerLogin(props:{onLogin:()=>Promise<void>;methods:{call:boolean;telegram:boolean}}) {
 const [mode,setMode]=useState<"cookie"|"token">(authMode);
 return <div><div role="group" aria-label="Сохранение входа" style={{display:"flex",gap:8,flexWrap:"wrap"}}>{(["token","cookie"] as const).map(value=><Button key={value} type="button" variant={mode===value?"default":"outline"} aria-pressed={mode===value} onClick={()=>{setAuthMode(value);setMode(value);}}>{value==="token"?"Без cookie":"Запомнить вход"}</Button>)}</div><p>{mode==="token"?"Cookie для входа не используются. Сессия хранится только в этой вкладке до её закрытия.":"Используется защищённая cookie, чтобы сохранить вход на устройстве."}</p><LoginMethods key={mode} {...props}/></div>;
}
