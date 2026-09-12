import { env } from "cloudflare:workers";
export function smsReady() { return env.SMS_RU_SMS_ENABLED === "1" && Boolean(env.SMS_RU_API_ID); }
export function smsDemo(request: Request) {
  return env.SMS_DEV_MODE === "1" && ["localhost","127.0.0.1","terminal.local"].includes(new URL(request.url).hostname);
}
export async function sendCode(phone:string, code:string) {
  if (!smsReady()) throw new Error("Вход по СМС ещё не подключён. Заказ можно оформить без регистрации.");
  const body = new URLSearchParams({api_id:String(env.SMS_RU_API_ID),to:phone.replace(/\D/g,""),msg:`Код входа в Джентельмен: ${code}`,json:"1"});
  const response = await fetch("https://sms.ru/sms/send", {method:"POST",body,signal:AbortSignal.timeout(10000)});
  const data = await response.json() as {status_code?:number;sms?:Record<string,{status_code?:number}>};
  if (!response.ok || data.status_code !== 100 || data.sms?.[phone.replace(/\D/g,"")]?.status_code !== 100) throw new Error("Не удалось отправить СМС. Попробуйте позже.");
}
