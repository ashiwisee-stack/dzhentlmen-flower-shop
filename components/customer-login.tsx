"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelegramLogin } from "@/components/telegram-login";
import { CallLogin } from "@/components/call-login";

export function CustomerLogin({ onLogin, methods }: { onLogin: () => Promise<void>; methods: { call: boolean; telegram: boolean } }) {
  if (!methods.telegram) return methods.call ? <CallLogin onLogin={onLogin} /> : <p role="status">Вход временно недоступен. Заказ можно оформить без входа.</p>;
  if (!methods.call) return <TelegramLogin onLogin={onLogin} />;
  return <Tabs defaultValue="call" className="customer-login">
    <TabsList aria-label="Способ входа"><TabsTrigger value="telegram">Telegram</TabsTrigger><TabsTrigger value="call">По звонку</TabsTrigger></TabsList>
    <TabsContent value="telegram"><TelegramLogin onLogin={onLogin} /></TabsContent>
    <TabsContent value="call"><CallLogin onLogin={onLogin} /></TabsContent>
  </Tabs>;
}
