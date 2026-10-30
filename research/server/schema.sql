CREATE TABLE `challenge_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`created` integer NOT NULL,
	`command` text NOT NULL,
	`note` text NOT NULL,
	`amount` integer NOT NULL,
	`supplier` text NOT NULL,
	`invoice` text NOT NULL,
	`request` text NOT NULL,
	`code` text NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `challenge_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempt_session` ON `challenge_attempts` (`session`);--> statement-breakpoint
CREATE TABLE `challenge_budgets` (
	`day` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `challenge_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_created` ON `challenge_sessions` (`created`);