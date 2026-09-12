export type OrderReference = { id: string; accessToken?: string; orderNumber?: string; total?: number };
const KEY = "dm_recent_orders";
let memory: OrderReference[] = [];

export function recentOrders(): OrderReference[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return memory;
    const saved: unknown = JSON.parse(raw);
    if (Array.isArray(saved)) memory = saved.filter(item => item && typeof item.id === "string" && (item.accessToken === undefined || typeof item.accessToken === "string")).slice(0, 10);
  } catch { /* Keep the current page usable when browser storage is unavailable. */ }
  return memory;
}

export function rememberOrder(order: OrderReference) {
  const previous = recentOrders();
  const found = previous.find(item => item.id === order.id);
  order = { ...found, ...order, accessToken: order.accessToken || found?.accessToken };
  memory = [order, ...previous.filter(item => item.id !== order.id)].slice(0, 10);
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Memory fallback. */ }
  try { sessionStorage.setItem("dm_payment", JSON.stringify(order)); } catch { /* Memory fallback. */ }
  window.dispatchEvent(new Event("dm-orders-changed"));
}

export async function openOrderPayment(order: OrderReference) {
  rememberOrder(order);
  const response = await fetch("/api/payment", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: order.id, accessToken: order.accessToken }), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || !data.url) throw new Error(data.error || "Не удалось открыть оплату. Заказ сохранён в «Мои заказы».");
  window.location.assign(data.url);
}
