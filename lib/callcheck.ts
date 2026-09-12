import { env } from "cloudflare:workers";

export function callcheckReady() {
  return env.SMS_RU_CALLCHECK_ENABLED === "1" && Boolean(env.SMS_RU_API_ID);
}

// Never expose provider responses or credentials to the browser/logs.
async function callcheck(action: "add" | "status", fields: Record<string, string>) {
  if (!callcheckReady()) throw new Error("Вход по звонку пока не подключён. Воспользуйтесь Telegram или оформите заказ без входа.");
  let response: Response;
  try {
    response = await fetch(`https://sms.ru/callcheck/${action}`, {
      method: "POST", body: new URLSearchParams({ api_id: String(env.SMS_RU_API_ID), json: "1", ...fields }),
      // Workers supports manual/follow only. Reject 3xx below without forwarding credentials.
      signal: AbortSignal.timeout(12000), redirect: "manual",
    });
  } catch { throw new Error("SMS.RU не ответил. Повторите проверку позже; новую попытку входа сразу создавать не нужно."); }
  if (!response.ok) throw new Error("Сервис подтверждения временно недоступен.");
  let data: Record<string, unknown>;
  try { data = await response.json() as Record<string, unknown>; }
  catch { throw new Error("Сервис подтверждения вернул непонятный ответ."); }
  if (!data || data.status !== "OK" || Number(data.status_code) !== 100) {
    throw new Error("SMS.RU не принял запрос. Попробуйте позже или войдите через Telegram.");
  }
  return data;
}

export async function createCallcheck(phone: string) {
  const data = await callcheck("add", { phone: phone.replace(/\D/g, "") });
  const checkId = String(data.check_id || ""), callPhone = String(data.call_phone || "");
  if (!/^[\w-]{1,100}$/.test(checkId) || !/^7\d{10}$/.test(callPhone)) throw new Error("Сервис не вернул номер для звонка. Начните заново через пять минут.");
  return { checkId, callPhone: "+" + callPhone };
}

export async function checkCallcheck(checkId: string): Promise<"pending" | "confirmed" | "expired"> {
  const data = await callcheck("status", { check_id: checkId });
  switch (Number(data.check_status)) {
    case 400: return "pending";
    case 401: return "confirmed";
    case 402: return "expired";
    default: throw new Error("Не удалось определить статус звонка. Повторите проверку позже.");
  }
}
