CREATE TABLE `auth_codes` (
	`phone` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `custom_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`comment` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_custom_requests_created_at` ON `custom_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `customer_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_sessions_token_hash_unique` ON `customer_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_customer_sessions_token` ON `customer_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`bonus_balance` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_unique` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_customers_phone` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `store_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vacancies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`robokassa_invoice_id` text,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`recipient_name` text DEFAULT '' NOT NULL,
	`recipient_phone` text DEFAULT '' NOT NULL,
	`fulfillment` text NOT NULL,
	`delivery_date` text NOT NULL,
	`delivery_time` text DEFAULT '' NOT NULL,
	`branch_id` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`delivery_price` integer DEFAULT 0 NOT NULL,
	`bonus_spent` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`payment_status` text DEFAULT 'not_required' NOT NULL,
	`bonus_awarded` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "order_number", "robokassa_invoice_id", "customer_id", "customer_name", "phone", "recipient_name", "recipient_phone", "fulfillment", "delivery_date", "delivery_time", "branch_id", "address", "comment", "subtotal", "delivery_price", "bonus_spent", "total", "status", "payment_status", "bonus_awarded", "created_at")
SELECT "id", "order_number", "robokassa_invoice_id", NULL, "customer_name", "phone", '', '', "fulfillment", "delivery_date", '', '', "address", "comment", "total", 0, 0, "total", "status", "payment_status", false, "created_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_robokassa_invoice_id_unique` ON `orders` (`robokassa_invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_phone` ON `orders` (`phone`);--> statement-breakpoint
ALTER TABLE `order_items` ADD `variant_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `extras_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `variants_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `hidden` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `popular` integer DEFAULT false NOT NULL;
