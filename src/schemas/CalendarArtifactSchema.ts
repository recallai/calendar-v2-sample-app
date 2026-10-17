import { z } from "zod";

export const CalendarPlatformSchema = z.enum(["google_calendar", "microsoft_outlook"]);

export type CalendarPlatformType = z.infer<typeof CalendarPlatformSchema>;

/**
 * A calendar connected in Recall. The OAuth client secret and refresh token are left out, so they
 * aren't passed around the app.
 * https://docs.recall.ai/reference/calendars_retrieve
 */
export const CalendarSchema = z.object({
    id: z.string(),
    platform: CalendarPlatformSchema,
    /** The connected account's email. Briefly null right after the calendar is created. */
    platform_email: z.string().nullable(),
    /** The email of the account that authorized the connection. May be missing, or differ from platform_email. */
    oauth_email: z.string().nullish(),
    status: z.enum(["connecting", "connected", "disconnected"]),
    /** Details of each status change, such as the provider's error when a calendar disconnects. */
    status_changes: z.record(z.unknown()).array(),
    created_at: z.string(),
    updated_at: z.string(),
});

export type CalendarType = z.infer<typeof CalendarSchema>;
