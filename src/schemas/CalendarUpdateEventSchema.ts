import { z } from "zod";

/**
 * Schema for the calendar.update webhook event.
 * This is sent when a calendar's data changes, e.g. its status becomes "disconnected", or it's deleted.
 * https://docs.recall.ai/docs/calendar-v2-webhooks
 */
export const CalendarUpdateEventSchema = z.object({
    event: z.literal("calendar.update"),
    data: z.object({
        calendar_id: z.string(),
    }),
});

export type CalendarUpdateEventType = z.infer<typeof CalendarUpdateEventSchema>;
