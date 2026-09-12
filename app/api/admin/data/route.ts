import { listProducts } from "@/lib/product-storage";
import { settleBonuses } from "@/lib/bonuses";
import { desc, eq, max } from "drizzle-orm";
import { database, getDb } from "@/db";
import { categories, customRequests, customers, storeSettings, vacancies } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-auth";
import { readStoreData } from "@/lib/store-storage";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import { settingsSchema } from "@/lib/settings-validation";
import { sameOrigin } from "@/lib/security";
import { paymentReady,paymentTest } from "@/lib/payments";
import { smsReady } from "@/lib/sms";
import { telegramReady, flushNotifications } from "@/lib/telegram";
import { env } from "cloudflare:workers";

export async function GET(request:Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    await listProducts(true);
    const db = getDb();
    const page=Math.max(0,Math.floor(Number(new URL(request.url).searchParams.get("page"))||0));
    const [store, requestRows, customerRows] = await Promise.all([
      readStoreData(),
      db.select().from(customRequests).orderBy(desc(customRequests.createdAt)).limit(51).offset(page*50),
      db.select().from(customers).orderBy(desc(customers.createdAt)).limit(51).offset(page*50),
    ]);
    const totals=await database().prepare("SELECT (SELECT COUNT(*) FROM orders WHERE status='new') AS newOrders,(SELECT COUNT(*) FROM customers) AS customers,(SELECT COUNT(*) FROM custom_requests WHERE status='new') AS requests,(SELECT COALESCE(SUM(total),0) FROM orders WHERE status='completed') AS turnover").first();
    return Response.json({ ...store, totals, requests: requestRows.slice(0,50), customers: customerRows.slice(0,50),requestsMore:requestRows.length>50,hasMore:requestRows.length>50||customerRows.length>50,integrations:{paymentTest:paymentTest(),sms:smsReady(),telegram:telegramReady(),payment:paymentReady(),geocoder:!!env.GEOCODER_URL || env.PHOTON_URL!=="disabled",router:!!env.ROUTER_URL} });
  } catch (error) {
    console.error("admin:data", error);
    return Response.json({ error: "Не удалось загрузить данные" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    sameOrigin(request);
    const payload = await request.json() as Record<string, unknown>;
    const entity = String(payload.entity ?? "");
    const action = String(payload.action ?? "update");
    const db = getDb();
    if (entity === "settings") {
      const values = settingsSchema.parse({...DEFAULT_SETTINGS,...((await readStoreData()).settings),...(payload.values as object)});
      await database().batch(Object.entries(values).map(([key,value])=>database().prepare("INSERT INTO store_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key,JSON.stringify(value),new Date().toISOString())));
    } else if (entity === "category") {
      const name=String(payload.name || "").trim();
      const raw=database();
      const current=await raw.prepare("SELECT name FROM categories WHERE id=?").bind(Number(payload.id)||0).first<{name:string}>();
      if(action==="delete") {
        if(!current)throw new Error("Раздел не найден");
        const used=await raw.prepare("SELECT id FROM products WHERE category=? LIMIT 1").bind(current.name).first();
        if(used)throw new Error("Сначала перенесите товары в другой раздел или скройте раздел");
        await raw.prepare("DELETE FROM categories WHERE id=?").bind(payload.id).run();
      } else {
        if(!name || name.length>100)throw new Error("Укажите название раздела до 100 символов");
        const duplicate=await raw.prepare("SELECT id FROM categories WHERE name=? AND id!=?").bind(name,Number(payload.id)||0).first();
        if(duplicate)throw new Error("Такой раздел уже существует");
        if(action==="create") await raw.prepare("INSERT INTO categories(name,slug,sort_order,visible) VALUES(?,?,?,1)").bind(name,"category-"+crypto.randomUUID(),Number(payload.sortOrder)||0).run();
        else {
          if(!current)throw new Error("Раздел не найден");
          await raw.batch([raw.prepare("UPDATE categories SET name=?,visible=?,sort_order=? WHERE id=?").bind(name,payload.visible===false?0:1,Number(payload.sortOrder)||0,payload.id),raw.prepare("UPDATE products SET category=? WHERE category=?").bind(name,current.name)]);
        }
      }
    } else if (entity === "vacancy") {
      if(action!=="delete" && (!String(payload.title??"").trim() || String(payload.title??"").length>200 || !String(payload.description??"").trim() || String(payload.description??"").length>10000))throw new Error("Заполните название и описание вакансии (до 200 и 10 000 символов)");
      if (action === "delete") await db.delete(vacancies).where(eq(vacancies.id, Number(payload.id)));
      else if (action === "create") {
        const [{ value: lastOrder }] = await db.select({ value: max(vacancies.sortOrder) }).from(vacancies);
        await db.insert(vacancies).values({ title: String(payload.title ?? "").trim(), description: String(payload.description ?? "").trim(), active: true, sortOrder: (lastOrder ?? -1) + 1 });
      } else await db.update(vacancies).set({ title: String(payload.title ?? "").trim(), description: String(payload.description ?? "").trim(), active: payload.active !== false }).where(eq(vacancies.id, Number(payload.id)));
    } else if (entity === "request") {
      if(!["new","contacted","closed"].includes(String(payload.status)))throw new Error("Некорректный статус");
      await db.update(customRequests).set({ status: String(payload.status ?? "new") }).where(eq(customRequests.id, String(payload.id ?? "")));
    } else if (entity === "customer") {
      const balance=Number(payload.bonusBalance);
      if(!Number.isInteger(balance)||balance<0||balance>1000000)throw new Error("Некорректное количество бонусов");
      await database().batch([database().prepare("INSERT INTO bonus_operations(id,customer_id,delta,kind,note) SELECT ?,id,?-bonus_balance,'admin','Корректировка администратором' FROM customers WHERE id=?").bind(crypto.randomUUID(),balance,String(payload.id)),...settleBonuses(String(payload.id))]);
    } else throw new Error("Неизвестный раздел");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить" }, { status: 400 });
  }
}
