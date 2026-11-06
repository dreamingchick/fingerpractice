CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`started` integer NOT NULL,
	`finished` integer,
	`nickname` text,
	`reaction` integer,
	`day` text
);
--> statement-breakpoint
CREATE INDEX `attempts_player` ON `attempts` (`player`,`started`);--> statement-breakpoint
CREATE INDEX `attempts_day` ON `attempts` (`day`,`reaction`);