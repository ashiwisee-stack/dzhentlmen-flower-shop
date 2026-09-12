CREATE TABLE `consent_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`purpose` text NOT NULL,
	`version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `telegram_auth` (
	`token` text PRIMARY KEY NOT NULL,
	`browser_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`chat_id` text,
	`customer_id` text,
	`code` text NOT NULL,
	`consent_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_telegram_auth_chat` ON `telegram_auth` (`chat_id`);
--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('legalName','"Индивидуальный предприниматель Аббасалиева Айтадж Савадхан кызы"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('inn','"665814896100"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('ogrnip','"325665800130472"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('contactEmail','"abbasalieva.aytadzh@mail.ru"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bankAccount','"40802810416750014015"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bankName','"УРАЛЬСКИЙ БАНК ПАО СБЕРБАНК"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bankBik','"046577674"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bankCorrespondent','"30101810500000000674"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bankInn','"7707083893"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bankKpp','"665843001"') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('deliveryBase','0') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('deliveryPerKm','50') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('deliveryIncludedKm','2') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bonusPercent','5') ON CONFLICT(key) DO UPDATE SET value=excluded.value;

--> statement-breakpoint
INSERT INTO store_settings(key,value) VALUES('bonusMaxSpendPercent','50') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
