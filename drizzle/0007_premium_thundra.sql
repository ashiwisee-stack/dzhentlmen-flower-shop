ALTER TABLE `bonus_operations` ADD `applied` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE bonus_operations SET applied=1;
--> statement-breakpoint
DROP TRIGGER IF EXISTS bonus_check;
--> statement-breakpoint
DROP TRIGGER IF EXISTS bonus_apply;
--> statement-breakpoint
DROP TRIGGER IF EXISTS order_bonus_spend;
--> statement-breakpoint
DROP TRIGGER IF EXISTS order_bonus_earn;
--> statement-breakpoint
DROP TRIGGER IF EXISTS order_bonus_cancel;
