import { z } from "zod";

/**
 * A bot scheduled for a calendar event. `start_time` is the event start the bot was scheduled for, not
 * the bot's `join_at`.
 * https://docs.recall.ai/docs/scheduling-guide
 */
export const CalendarEventBotSchema = z.object({
    bot_id: z.string(),
    deduplication_key: z.string(),
    start_time: z.string(), // iso 8601 formatted datetime
    meeting_url: z.string().nullable(),
});

export type CalendarEventBotType = z.infer<typeof CalendarEventBotSchema>;

/**
 * An event on a connected calendar. All-day events aren't returned, since bots don't join them.
 * https://docs.recall.ai/reference/calendar_events_retrieve
 */
export const CalendarEventSchema = z.object({
    id: z.string(),
    calendar_id: z.string(),
    start_time: z.string(), // iso 8601 formatted datetime
    end_time: z.string(), // iso 8601 formatted datetime
    /** The event as the provider returned it (Google Calendar or Microsoft Graph). Read it with raw_event.ts. */
    raw: z.unknown(),
    platform: z.string(),
    /** e.g. "zoom" or "google_meet", or null when no meeting link was found. */
    meeting_platform: z.string().nullable(),
    meeting_url: z.string().nullable(),
    is_deleted: z.boolean(),
    /** Bots scheduled for this event. Can hold several entries if the same event is reused for later meetings. */
    bots: CalendarEventBotSchema.array(),
    created_at: z.string(),
    updated_at: z.string(),
});

export type CalendarEventType = z.infer<typeof CalendarEventSchema>;
