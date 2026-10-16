import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { DEFAULT_BOT_SETTINGS } from "../lib/bot-settings";
import { DEFAULT_SCHEDULE_MODE, SCHEDULE_MODE_KEYS } from "../lib/schedule-modes";
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

/**
 * Local copy of each calendar connected in Recall, plus this app's settings for it.
 * Recall stays the source of truth for the calendar's status and its events.
 */
export const calendars = sqliteTable("calendars", {
    /** Recall calendar ID. */
    id: text("id").primaryKey(),
    platform: text("platform", { enum: ["google_calendar", "microsoft_outlook"] }).notNull(),
    email: text("email"),
    status: text("status", { enum: ["connecting", "connected", "disconnected"] }).notNull(),
    /** Which of this calendar's meetings automatically get a bot. */
    scheduleMode: text("schedule_mode", { enum: SCHEDULE_MODE_KEYS }).notNull().default(DEFAULT_SCHEDULE_MODE),
    /** Settings for bots this app dispatches automatically to this calendar's meetings. */
    botName: text("bot_name").notNull().default(DEFAULT_BOT_SETTINGS.botName),
    joinMinutesEarly: integer("join_minutes_early").notNull().default(DEFAULT_BOT_SETTINGS.joinMinutesEarly),
    chatMessage: text("chat_message").notNull().default(DEFAULT_BOT_SETTINGS.chatMessage),
    /** Automatic-leave timeouts in seconds: https://docs.recall.ai/docs/automatic-leaving-behavior */
    waitingRoomTimeout: integer("waiting_room_timeout").notNull().default(DEFAULT_BOT_SETTINGS.waitingRoomTimeout),
    nooneJoinedTimeout: integer("noone_joined_timeout").notNull().default(DEFAULT_BOT_SETTINGS.nooneJoinedTimeout),
    everyoneLeftTimeout: integer("everyone_left_timeout").notNull().default(DEFAULT_BOT_SETTINGS.everyoneLeftTimeout),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date()),
});

/**
 * A per-meeting decision that beats the calendar's schedule mode: "always send a bot" (added by hand) or
 * "never send a bot" (the user removed it).
 */
export const eventOverrides = sqliteTable("event_overrides", {
    /** Recall calendar event ID. */
    calendarEventId: text("calendar_event_id").primaryKey(),
    calendarId: text("calendar_id")
        .notNull()
        .references(() => calendars.id, { onDelete: "cascade" }),
    action: text("action", { enum: ["dispatch", "skip"] }).notNull(),
    createdAt: createdAt(),
});

/**
 * Every verified webhook from Recall. The message ID is the primary key, so redelivered (retried)
 * messages are only processed once.
 */
export const webhookEvents = sqliteTable(
    "webhook_events",
    {
        /** The `webhook-id` / `svix-id` header. */
        id: text("id").primaryKey(),
        event: text("event").notNull(),
        calendarId: text("calendar_id"),
        payload: text("payload").notNull(),
        status: text("status", { enum: ["received", "processed", "failed", "ignored"] }).notNull(),
        /** e.g. "events=12 scheduled=2 removed=1". */
        summary: text("summary"),
        error: text("error"),
        receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
        processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    },
    (table) => [index("webhook_events_received_idx").on(table.receivedAt)],
);

/**
 * What the app did to a meeting's bot and why. Only changes are logged (not "nothing to do").
 */
export const botDecisions = sqliteTable(
    "bot_decisions",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        /** Not a foreign key, so history survives deleting the calendar. */
        calendarId: text("calendar_id").notNull(),
        calendarEventId: text("calendar_event_id").notNull(),
        eventTitle: text("event_title"),
        eventStartTime: text("event_start_time"),
        action: text("action", { enum: ["scheduled", "rescheduled", "removed"] }).notNull(),
        reason: text("reason").notNull(),
        /** What caused the decision. "rules_changed" means the calendar's schedule mode or bot settings changed. */
        trigger: text("trigger", { enum: ["webhook", "rules_changed", "user"] }).notNull(),
        webhookEventId: text("webhook_event_id"),
        createdAt: createdAt(),
    },
    (table) => [index("bot_decisions_created_idx").on(table.createdAt)],
);

export type CalendarRow = typeof calendars.$inferSelect;
export type WebhookEventRow = typeof webhookEvents.$inferSelect;
export type BotDecisionRow = typeof botDecisions.$inferSelect;
