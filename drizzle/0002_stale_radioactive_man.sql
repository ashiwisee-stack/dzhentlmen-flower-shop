ALTER TABLE `orders` ADD `robokassa_invoice_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_robokassa_invoice_id_unique` ON `orders` (`robokassa_invoice_id`);