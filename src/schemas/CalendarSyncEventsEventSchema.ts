import { z } from "zod";

/**
 * Schema for the calendar.sync_events webhook event.
 * This is sent when events on a calendar are created, updated or deleted.
 * https://docs.recall.ai/docs/calendar-v2-webhooks
 */
export const CalendarSyncEventsEventSchema = z.object({
    event: z.literal("calendar.sync_events"),
    data: z.object({
        calendar_id: z.string(),
        last_updated_ts: z.string(), // iso 8601 formatted datetime
    }),
});

export type CalendarSyncEventsEventType = z.infer<typeof CalendarSyncEventsEventSchema>;
