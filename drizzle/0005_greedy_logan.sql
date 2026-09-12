CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refunds_order_id_unique` ON `refunds` (`order_id`);--> statement-breakpoint
ALTER TABLE `notification_jobs` ADD `lease_until` integer DEFAULT 0 NOT NULL;