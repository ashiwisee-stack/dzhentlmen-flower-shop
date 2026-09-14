import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  singleFlower: integer("single_flower", { mode: "boolean" }).notNull().default(false),
  flowerExtraId: text("flower_extra_id"),
  showRecommendations: integer("show_recommendations", {mode:"boolean"}).notNull().default(true),
  acceptsFlowers: integer("accepts_flowers", {mode:"boolean"}).notNull().default(true),
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  oldPrice: integer("old_price"),
  image: text("image").notNull(),
  imagesJson: text("images_json").notNull().default("[]"),
  variantsJson: text("variants_json").notNull().default("[]"),
  description: text("description").notNull().default(""),
  composition: text("composition").notNull().default(""),
  badge: text("badge"),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  popular: integer("popular", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_products_sort_order").on(table.sortOrder)]);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  bonusBalance: integer("bonus_balance").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_customers_phone").on(table.phone)]);

export const authCodes = sqliteTable("auth_codes", {
  phone: text("phone").primaryKey(),
  name: text("name").notNull().default(""),
  codeHash: text("code_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
});

export const callAuth = sqliteTable("call_auth", {
  browserHash: text("browser_hash").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  checkId: text("check_id"),
  callPhone: text("call_phone"),
  expires: integer("expires").notNull(),
  nextCheckAt: integer("next_check_at").notNull().default(0),
  consentVersion: text("consent_version").notNull(),
}, t => [index("idx_call_auth_expires").on(t.expires)]);

export const customerSessions = sqliteTable("customer_sessions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_customer_sessions_token").on(table.tokenHash)]);

export const storeSettings = sqliteTable("store_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const vacancies = sqliteTable("vacancies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customRequests = sqliteTable("custom_requests", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull(),
  comment: text("comment").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_custom_requests_created_at").on(table.createdAt)]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  requestKey: text("request_key").unique(),
  requestHash: text("request_hash").notNull().default(""),
  accessHash: text("access_hash").notNull().default(""),
  version: integer("version").notNull().default(0),
  bonusEarned: integer("bonus_earned").notNull().default(0),
  deliveryDetails: text("delivery_details").notNull().default("{}"),
  orderNumber: text("order_number").notNull().unique(),
  robokassaInvoiceId: text("robokassa_invoice_id").unique(),
  customerId: text("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  recipientName: text("recipient_name").notNull().default(""),
  recipientPhone: text("recipient_phone").notNull().default(""),
  fulfillment: text("fulfillment").notNull(),
  deliveryDate: text("delivery_date").notNull(),
  deliveryTime: text("delivery_time").notNull().default(""),
  branchId: text("branch_id").notNull().default(""),
  address: text("address").notNull().default(""),
  comment: text("comment").notNull().default(""),
  subtotal: integer("subtotal").notNull().default(0),
  deliveryPrice: integer("delivery_price").notNull().default(0),
  bonusSpent: integer("bonus_spent").notNull().default(0),
  total: integer("total").notNull(),
  status: text("status").notNull().default("new"),
  paymentStatus: text("payment_status").notNull().default("not_required"),
  bonusAwarded: integer("bonus_awarded", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_orders_created_at").on(table.createdAt),
  index("idx_orders_status").on(table.status),
  index("idx_orders_phone").on(table.phone),
]);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull().default(""),
  extrasJson: text("extras_json").notNull().default("[]"),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
}, (table) => [index("idx_order_items_order_id").on(table.orderId)]);

export const bonusOperations = sqliteTable("bonus_operations", {
  applied: integer("applied", { mode: "boolean" }).notNull().default(false),
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  delta: integer("delta").notNull(),
  kind: text("kind").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_bonus_customer").on(t.customerId)]);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull().default(0), expires: integer("expires").notNull(),
});
export const telegramLinks = sqliteTable("telegram_links", {
  token: text("token").primaryKey(), role: text("role").notNull(), customerId: text("customer_id"), expires: integer("expires").notNull(),
});
export const telegramSubscribers = sqliteTable("telegram_subscribers", {
  chatId: text("chat_id").primaryKey(), role: text("role").notNull(), customerId: text("customer_id"), name: text("name").notNull().default(""),
});
export const notificationJobs = sqliteTable("notification_jobs", {
  leaseUntil: integer("lease_until").notNull().default(0),
  id: text("id").primaryKey(), chatId: text("chat_id").notNull(), message: text("message").notNull(), attempts: integer("attempts").notNull().default(0), sent: integer("sent", {mode:"boolean"}).notNull().default(false),
});
export const refunds = sqliteTable("refunds", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().unique(), status: text("status").notNull().default("created"), response: text("response").notNull().default(""), createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const fiscalJobs = sqliteTable("fiscal_jobs", {
  id:text("id").primaryKey(),orderId:text("order_id").notNull().unique(),payload:text("payload").notNull(),status:text("status").notNull().default("new"),response:text("response").notNull().default(""),leaseUntil:integer("lease_until").notNull().default(0),
});

export const telegramAuth = sqliteTable("telegram_auth", {
  token:text("token").primaryKey(),browserHash:text("browser_hash").notNull(),expires:integer("expires").notNull(),
  chatId:text("chat_id"),customerId:text("customer_id"),code:text("code").notNull(),consentVersion:text("consent_version").notNull(),
},t=>[index("idx_telegram_auth_chat").on(t.chatId)]);
export const consentEvents = sqliteTable("consent_events", {
  id:text("id").primaryKey(),subject:text("subject").notNull(),purpose:text("purpose").notNull(),version:text("version").notNull(),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
