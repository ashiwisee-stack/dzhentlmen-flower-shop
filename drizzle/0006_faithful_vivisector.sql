CREATE TABLE `fiscal_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fiscal_jobs_order_id_unique` ON `fiscal_jobs` (`order_id`);--> statement-breakpoint
ALTER TABLE `products` ADD `accepts_flowers` integer DEFAULT true NOT NULL;