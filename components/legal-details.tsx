import { readStoreData } from "@/lib/store-storage";
export async function LegalDetails() {
  const {settings:s}=await readStoreData();
  return <section><h2>Продавец и контакты</h2><p>{String(s.legalName)}</p><p>ИНН: {String(s.inn)} · ОГРНИП: {String(s.ogrnip)}</p>{Boolean(s.legalAddress)&&<p>Адрес: {String(s.legalAddress)}</p>}<p>Мастерские: Екатеринбург, ул. Крауля, 105/3; ул. Токарей, 33.</p><p>Телефон: <a href="tel:+79630492521">{String(s.phone)}</a></p><p>Email для обращений: <a href={`mailto:${s.contactEmail}`}>{String(s.contactEmail)}</a></p><details><summary>Банковские реквизиты</summary><p>Расчётный счёт: {String(s.bankAccount)}</p><p>{String(s.bankName)}</p><p>БИК: {String(s.bankBik)} · Корсчёт: {String(s.bankCorrespondent)}</p><p>ИНН банка: {String(s.bankInn)} · КПП банка: {String(s.bankKpp)}</p></details></section>;
}
