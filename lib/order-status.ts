export const ORDER_STATUSES:Record<string,string>={new:"Новый",confirmed:"Подтверждён",completed:"Выдан",cancelled:"Отменён"};
export function normalizeOrderStatus(value:string){return ["assembling","ready"].includes(value)?"confirmed":value;}
export function orderStatusLabel(value:string){const key=normalizeOrderStatus(value);return ORDER_STATUSES[key] || (key.startsWith("custom:")?key.slice(7):key);}
export function validOrderStatus(value:string){return Object.hasOwn(ORDER_STATUSES,value) || /^custom:[^<>\r\n]{1,40}$/.test(value);}
