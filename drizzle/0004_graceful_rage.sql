CREATE TABLE `bonus_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint

CREATE INDEX `idx_bonus_customer` ON `bonus_operations` (`customer_id`);
--> statement-breakpoint

CREATE TABLE `notification_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`message` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent` integer DEFAULT false NOT NULL
);

--> statement-breakpoint

CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);

--> statement-breakpoint

CREATE TABLE `telegram_links` (
	`token` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`customer_id` text,
	`expires` integer NOT NULL
);

--> statement-breakpoint

CREATE TABLE `telegram_subscribers` (
	`chat_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`customer_id` text,
	`name` text DEFAULT '' NOT NULL
);

--> statement-breakpoint

ALTER TABLE `orders` ADD `request_key` text;
--> statement-breakpoint

ALTER TABLE `orders` ADD `request_hash` text DEFAULT '' NOT NULL;
--> statement-breakpoint

ALTER TABLE `orders` ADD `access_hash` text DEFAULT '' NOT NULL;
--> statement-breakpoint

ALTER TABLE `orders` ADD `version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

ALTER TABLE `orders` ADD `bonus_earned` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

ALTER TABLE `orders` ADD `delivery_details` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX `orders_request_key_unique` ON `orders` (`request_key`);
