ALTER TABLE `calendars` ADD `schedule_mode` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `calendars` ADD `waiting_room_timeout` integer DEFAULT 1200 NOT NULL;--> statement-breakpoint
ALTER TABLE `calendars` ADD `noone_joined_timeout` integer DEFAULT 1200 NOT NULL;--> statement-breakpoint
ALTER TABLE `calendars` ADD `everyone_left_timeout` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
-- Carry each calendar's old dispatch rules over as a schedule mode, using its first enabled rule.
-- Only "send a bot" rules for any meeting or external guests map exactly onto a mode; anything else
-- falls back to the default ("none").
UPDATE `calendars` SET `schedule_mode` = COALESCE((
    SELECT CASE `condition` WHEN 'all' THEN 'all' WHEN 'external_guests' THEN 'external' END
    FROM `dispatch_rules`
    WHERE `dispatch_rules`.`calendar_id` = `calendars`.`id` AND `enabled` = 1 AND `action` = 'dispatch'
    ORDER BY `position`, `id`
    LIMIT 1
), 'none');--> statement-breakpoint
DROP TABLE `dispatch_rules`;--> statement-breakpoint
ALTER TABLE `bot_decisions` DROP COLUMN `rule_id`;
