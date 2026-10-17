CREATE TABLE `bot_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`calendar_id` text NOT NULL,
	`calendar_event_id` text NOT NULL,
	`event_title` text,
	`event_start_time` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`trigger` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bot_decisions_created_idx` ON `bot_decisions` (`created_at`);--> statement-breakpoint
CREATE TABLE `calendar_settings` (
	`calendar_id` text PRIMARY KEY NOT NULL,
	`schedule_mode` text DEFAULT 'none' NOT NULL,
	`bot_name` text DEFAULT 'Recall Notetaker' NOT NULL,
	`join_minutes_early` integer DEFAULT 0 NOT NULL,
	`chat_message` text DEFAULT '' NOT NULL,
	`waiting_room_timeout` integer DEFAULT 1200 NOT NULL,
	`noone_joined_timeout` integer DEFAULT 1200 NOT NULL,
	`everyone_left_timeout` integer DEFAULT 2 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_overrides` (
	`calendar_event_id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL
);
