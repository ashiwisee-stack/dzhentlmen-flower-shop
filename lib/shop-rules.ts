export function validateSlot(date: string, time: string, fulfillment: string, settings: {leadTimeHours:number;deliveryOpen:string;deliveryClose:string}, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Выберите корректные дату и время");
  const instant = Date.parse(`${date}T${time}:00+05:00`);
  if (!Number.isFinite(instant) || new Date(instant + 5 * 3600000).toISOString().slice(0,16) !== `${date}T${time}`) throw new Error("Такой даты не существует");
  if (instant < now + settings.leadTimeHours * 3600000) throw new Error(`Заказ нужен минимум за ${settings.leadTimeHours} часа`);
  if (instant > now + 366 * 86400000) throw new Error("Выберите дату в пределах года");
  if (fulfillment === "delivery") {
    const minutes = (s:string) => Number(s.slice(0,2))*60 + Number(s.slice(3));
    const start = minutes(settings.deliveryOpen), end = settings.deliveryClose === "00:00" ? 1440 : minutes(settings.deliveryClose), value = minutes(time);
    const allowed = start < end ? value >= start && value < end : value >= start || value < end;
    if (!allowed) throw new Error(`Доставка доступна ${settings.deliveryOpen}–${settings.deliveryClose}`);
  }
}
export function canTransition(from: string, to: string) {
  const transitions: Record<string,string[]> = {new:["confirmed","cancelled"],confirmed:["assembling","cancelled"],assembling:["ready","cancelled"],ready:["completed","cancelled"],completed:[],cancelled:[]};
  return from === to || !!transitions[from]?.includes(to);
}
