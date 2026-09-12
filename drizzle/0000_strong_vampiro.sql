CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`fulfillment` text NOT NULL,
	`delivery_date` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`old_price` integer,
	`image` text NOT NULL,
	`images_json` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`composition` text DEFAULT '' NOT NULL,
	`badge` text,
	`available` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);