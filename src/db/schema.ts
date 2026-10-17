import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DEFAULT_CALENDAR_SETTINGS } from "../lib/settings";
import { ScheduleModeSchema } from "../schemas/CalendarSettingsSchema";

const DEFAULT_BOT_SETTINGS = DEFAULT_CALENDAR_SETTINGS.botSettings;

function created_at_column() {
    return integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
}

/**
 * This app's settings for each connected calendar. Recall is the source of truth for the calendar itself
 * (its email, status and events), so none of that is copied here. A calendar without a row uses the
 * default settings until the user saves their own.
 */
export const calendar_settings = sqliteTable("calendar_settings", {
    /** Recall calendar ID. */
    calendar_id: text("calendar_id").primaryKey(),
    /** Which of this calendar's meetings automatically get a bot. */
    schedule_mode: text("schedule_mode", { enum: ScheduleModeSchema.options }).notNull().default(DEFAULT_CALENDAR_SETTINGS.scheduleMode),
    /** Settings for bots this calendar's schedule mode sends. */
    bot_name: text("bot_name").notNull().default(DEFAULT_BOT_SETTINGS.botName),
    join_minutes_early: integer("join_minutes_early").notNull().default(DEFAULT_BOT_SETTINGS.joinMinutesEarly),
    chat_message: text("chat_message").notNull().default(DEFAULT_BOT_SETTINGS.chatMessage),
    /** Automatic-leave timeouts in seconds: https://docs.recall.ai/docs/automatic-leaving-behavior */
    waiting_room_timeout: integer("waiting_room_timeout").notNull().default(DEFAULT_BOT_SETTINGS.waitingRoomTimeout),
    noone_joined_timeout: integer("noone_joined_timeout").notNull().default(DEFAULT_BOT_SETTINGS.nooneJoinedTimeout),
    everyone_left_timeout: integer("everyone_left_timeout").notNull().default(DEFAULT_BOT_SETTINGS.everyoneLeftTimeout),
    created_at: created_at_column(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date()),
});

/**
 * A per-meeting decision that beats the calendar's schedule mode: "always send a bot" (added by hand) or
 * "never send a bot" (the user removed it).
 */
export const event_overrides = sqliteTable("event_overrides", {
    /** Recall calendar event ID. */
    calendar_event_id: text("calendar_event_id").primaryKey(),
    /** Recall calendar ID. Not a foreign key, since a calendar may not have a settings row. */
    calendar_id: text("calendar_id").notNull(),
    action: text("action", { enum: ["always", "never"] }).notNull(),
    created_at: created_at_column(),
});

/**
 * What the app did to a meeting's bot and why. Only changes are logged (not "nothing to do").
 */
export const bot_decisions = sqliteTable(
    "bot_decisions",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        /** Not a foreign key, so history survives deleting the calendar. */
        calendar_id: text("calendar_id").notNull(),
        calendar_event_id: text("calendar_event_id").notNull(),
        event_title: text("event_title"),
        event_start_time: text("event_start_time"),
        action: text("action", { enum: ["scheduled", "rescheduled", "removed"] }).notNull(),
        reason: text("reason").notNull(),
        /** What started the sync that made this change. */
        trigger: text("trigger", { enum: ["webhook", "schedule_mode_changed", "user"] }).notNull(),
        created_at: created_at_column(),
    },
    (table) => [index("bot_decisions_created_idx").on(table.created_at)],
);

export type BotDecisionRow = typeof bot_decisions.$inferSelect;
