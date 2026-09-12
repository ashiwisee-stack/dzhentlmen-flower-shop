import { asc } from "drizzle-orm";
import { database, getDb } from "@/db";
import { categories, storeSettings, vacancies } from "@/db/schema";
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "@/lib/catalog";

export async function ensureStoreDefaults() {
  const db = getDb();
  if(await database().prepare("SELECT key FROM store_settings WHERE key='_initialized'").first())return;
  const categoryRows = await db.select().from(categories).limit(1);
  if (!categoryRows.length) {
    await db.insert(categories).values(DEFAULT_CATEGORIES).onConflictDoNothing();
  }
  const settingRows = await db.select().from(storeSettings).limit(1);
  if (!settingRows.length) {
    await db.insert(storeSettings).values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
    }))).onConflictDoNothing();
  }
  const vacancyRows = await db.select().from(vacancies).limit(1);
  if (!vacancyRows.length) {
    await db.insert(vacancies).values({
      title: "Флорист",
      description: "Ищем внимательного флориста с чувством цвета. График и условия обсудим лично.",
      active: true,
      sortOrder: 0,
    });
  }
  await database().prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('_initialized','true')").run();
}

export async function readStoreData() {
  await ensureStoreDefaults();
  const db = getDb();
  const [categoryRows, settingRows, vacancyRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(storeSettings),
    db.select().from(vacancies).orderBy(asc(vacancies.sortOrder)),
  ]);
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of settingRows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  }
  return { categories: categoryRows, settings, vacancies: vacancyRows };
}
