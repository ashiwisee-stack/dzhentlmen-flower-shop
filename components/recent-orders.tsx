"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPrice } from "@/lib/catalog";
import { openOrderPayment, recentOrders, type OrderReference } from "@/lib/recent-orders";

type SavedOrder = OrderReference & { status?: string; paymentStatus?: string; deliveryDate?: string; deliveryTime?: string; test?: boolean; unavailable?: boolean };
const states: Record<string, string> = { new: "Новый", confirmed: "Подтверждён", assembling: "Собираем", ready: "Готов", completed: "Выполнен", cancelled: "Отменён" };
const payments: Record<string, string> = { pending: "Ожидает оплаты", paid: "Оплачен", not_required: "Оплата при получении", refund_pending: "Возврат обрабатывается", refunded: "Средства возвращены" };

export function RecentOrders({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [open, setOpen] = useState(initiallyOpen);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const requestRevision = ++revision.current;
    const refs = recentOrders();
    if (!refs.length) return;
    setOrders(current => refs.map(ref => ({ ...current.find(order => order.id === ref.id), ...ref })));
    try {
      const response = await fetch("/api/payment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "list", orders: refs.map(({ id, accessToken }) => ({ id, accessToken })) }), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (requestRevision !== revision.current) return;
      if (!response.ok) throw new Error(data.error || "Не удалось обновить статусы");
      setOrders(refs.map(ref => ({ ...ref, ...data.orders.find((order: SavedOrder) => order.id === ref.id), unavailable: !data.orders.some((order: SavedOrder) => order.id === ref.id) })));
      setError("");
    } catch (failure) { if (requestRevision === revision.current) setError(failure instanceof Error ? failure.message : "Статусы временно недоступны"); }
  }, []);
  useEffect(() => {
    const update = () => { void refresh(); };
    update();
    window.addEventListener("dm-orders-changed", update);
    window.addEventListener("focus", update);
    const timer = setInterval(() => { if (!document.hidden) update(); }, 60000);
    return () => { revision.current++; clearInterval(timer); window.removeEventListener("dm-orders-changed", update); window.removeEventListener("focus", update); };
  }, [refresh]);
  if (!orders.length) return null;
  async function pay(order: SavedOrder) {
    setBusy(order.id);
    try { await openOrderPayment(order); } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Не удалось открыть оплату"); } finally { setBusy(""); }
  }
  return <>
    <aside className="recent-order-banner" aria-label="Мои заказы"><div><strong>Мои заказы · {orders.length}</strong><span>{orders[0].orderNumber || "Ваш заказ сохранён"}{orders[0].paymentStatus ? " · " + payments[orders[0].paymentStatus] : ""}</span></div><Button variant="outline" onClick={() => { setOpen(true); void refresh(); }}>Посмотреть заказ</Button></aside>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="recent-orders-dialog"><DialogHeader><DialogTitle>Мои заказы</DialogTitle><DialogDescription>Заказы этой вкладки доступны без регистрации, в том числе после обновления страницы.</DialogDescription></DialogHeader>
      <Button variant="outline" onClick={() => void refresh()}>Обновить статусы</Button>
      {error && <p role="alert" className="form-error">{error}. Сохранённые номера заказов остаются ниже.</p>}
      <div className="recent-orders-list">{orders.map(order => <article key={order.id}><div><strong>{order.orderNumber || "Заказ"}</strong>{order.total !== undefined && <strong>{formatPrice(order.total)}</strong>}</div>
        <p>{order.unavailable ? "Для этого заказа войдите в свой аккаунт или уточните статус у магазина." : states[order.status || ""] || "Получаем статус…"}</p>
        {order.paymentStatus && <p>{payments[order.paymentStatus] || order.paymentStatus}</p>}
        {order.deliveryDate && <p>{order.deliveryDate} · {order.deliveryTime} (Екатеринбург)</p>}
        {order.test && <small>Тестовый платёж: деньги не списываются.</small>}
        {!order.unavailable && order.paymentStatus === "pending" && order.status !== "cancelled" && <Button disabled={!!busy} onClick={() => void pay(order)}>{busy === order.id ? "Открываем оплату…" : "Оплатить заказ"}</Button>}
      </article>)}</div>
    </DialogContent></Dialog>
  </>;
}
