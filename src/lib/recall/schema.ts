import { z } from "zod"

/**
 * Calendar V2 webhook events.
 * See: https://docs.recall.ai/docs/calendar-v2-webhooks
 */
const CalendarUpdateEventSchema = z.object({
    event: z.literal("calendar.update"),
    data: z.object({
        calendar_id: z.string(),
    }),
});

const CalendarSyncEventsEventSchema = z.object({
    event: z.literal("calendar.sync_events"),
    data: z.object({
        calendar_id: z.string(),
        last_updated_ts: z.string(),
    }),
});

export const WebhookSchema = z.discriminatedUnion("event", [
    CalendarUpdateEventSchema,
    CalendarSyncEventsEventSchema,
]);

export type CalendarUpdateEvent = z.infer<typeof CalendarUpdateEventSchema>["data"]
export type CalendarSyncEvent = z.infer<typeof CalendarSyncEventsEventSchema>["data"]
