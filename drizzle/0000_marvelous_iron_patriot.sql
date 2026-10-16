CREATE TABLE `bot_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`calendar_id` text NOT NULL,
	`calendar_event_id` text NOT NULL,
	`event_title` text,
	`event_start_time` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`rule_id` integer,
	`trigger` text NOT NULL,
	`webhook_event_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bot_decisions_created_idx` ON `bot_decisions` (`created_at`);--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`email` text,
	`status` text NOT NULL,
	`bot_name` text DEFAULT 'Recall Notetaker' NOT NULL,
	`join_minutes_early` integer DEFAULT 0 NOT NULL,
	`chat_message` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dispatch_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`calendar_id` text NOT NULL,
	`position` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`condition` text NOT NULL,
	`value` text,
	`label` text,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dispatch_rules_calendar_idx` ON `dispatch_rules` (`calendar_id`,`position`);--> statement-breakpoint
CREATE TABLE `event_overrides` (
	`calendar_event_id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`calendar_id` text,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`summary` text,
	`error` text,
	`received_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE INDEX `webhook_events_received_idx` ON `webhook_events` (`received_at`);