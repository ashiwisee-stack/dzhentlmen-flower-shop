"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelegramLogin } from "@/components/telegram-login";
import { CallLogin } from "@/components/call-login";

export function CustomerLogin({ onLogin }: { onLogin: () => Promise<void> }) {
  return <Tabs defaultValue="telegram" className="customer-login">
    <TabsList aria-label="Способ входа"><TabsTrigger value="telegram">Telegram</TabsTrigger><TabsTrigger value="call">По звонку</TabsTrigger></TabsList>
    <TabsContent value="telegram"><TelegramLogin onLogin={onLogin} /></TabsContent>
    <TabsContent value="call"><CallLogin onLogin={onLogin} /></TabsContent>
  </Tabs>;
}
