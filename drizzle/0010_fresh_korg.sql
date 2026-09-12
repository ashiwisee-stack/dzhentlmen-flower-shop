CREATE TABLE `call_auth` (
	`browser_hash` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`check_id` text,
	`call_phone` text,
	`expires` integer NOT NULL,
	`next_check_at` integer DEFAULT 0 NOT NULL,
	`consent_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `call_auth_phone_unique` ON `call_auth` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_call_auth_expires` ON `call_auth` (`expires`);