"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { RecentOrders } from "@/components/recent-orders";
import { openOrderPayment, recentOrders, type OrderReference } from "@/lib/recent-orders";

export default function PaymentPage() {
  const [message, setMessage] = useState("Проверяем подтверждение оплаты…");
  const [pending, setPending] = useState<OrderReference | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      let saved: OrderReference | null = null;
      try { saved = JSON.parse(sessionStorage.getItem("dm_payment") || "null"); } catch {}
      saved ||= recentOrders()[0] || null;
      if (!saved) { setMessage("Выберите заказ в личном кабинете или уточните статус у магазина."); return; }
      const response = await fetch("/api/payment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...saved, action: "status" }), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось проверить статус");
      setPending(data.paymentStatus === "pending" && data.status !== "cancelled" ? saved : null);
      const labels: Record<string, string> = { pending: "Ожидаем подтверждения оплаты. Если вы уже оплатили заказ, обновите статус через несколько секунд.", refunded: "Средства возвращены.", refund_pending: "Возврат обрабатывается.", not_required: "Заказ принят с оплатой при получении." };
      setMessage(`${data.orderNumber}: ` + (data.paymentStatus === "paid" ? (data.test ? "Тестовая оплата подтверждена. Деньги не списывались." : "Оплата подтверждена. Спасибо за заказ!") : data.status === "cancelled" ? "Заказ отменён." : labels[data.paymentStatus] || data.paymentStatus));
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Не удалось проверить статус. Попробуйте ещё раз."); }
    finally { inFlight.current = false; setBusy(false); }
  }, []);
  useEffect(() => { void check(); }, [check]);
  useEffect(() => {
    if (!pending) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void check();
      if (++attempts >= 12) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [pending?.id, check]);
  async function retryPayment() {
    if (!pending) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await openOrderPayment(pending); } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Оплата временно недоступна."); } finally { inFlight.current = false; setBusy(false); }
  }
  return <main className="legal-page payment-page"><h1>Оплата заказа</h1><p role="status">{message}</p><div className="map-actions"><Button disabled={busy} onClick={() => void check()}>{busy ? "Проверяем…" : "Обновить статус"}</Button>{pending && <Button variant="outline" disabled={busy} onClick={() => void retryPayment()}>Перейти к оплате</Button>}</div><p><Link href="/">Вернуться в магазин</Link></p><RecentOrders /><Toaster position="top-center" richColors /></main>;
}
