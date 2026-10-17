import { z } from "zod";
import { CalendarPlatformSchema, CalendarSchema, type CalendarType } from "../../schemas/CalendarArtifactSchema";
import { CalendarEventSchema } from "../../schemas/CalendarEventArtifactSchema";
import { RecallApiError, recall_fetch, recall_fetch_all_pages } from "./client";

/**
 * The Recall.ai Calendar V2 API: calendars, their events, and scheduling bots for those events.
 * See: https://docs.recall.ai/docs/calendar-v2-integration-guide
 */

/* -------------------------------------------------------------------------- */
/*                                  Calendars                                 */
/* -------------------------------------------------------------------------- */

/**
 * Create a calendar from a user's OAuth refresh token. Represents the primary calendar of the authorizing account.
 * Calendars are not deduplicated by Recall, so check `calendars_list` for an existing one first.
 * https://docs.recall.ai/reference/calendars_create
 */
export async function calendar_create(args: {
    platform: "google_calendar" | "microsoft_outlook",
    oauth_client_id: string,
    oauth_client_secret: string,
    oauth_refresh_token: string,
    oauth_email: string,
}) {
    const body = z.object({
        platform: CalendarPlatformSchema,
        oauth_client_id: z.string(),
        oauth_client_secret: z.string(),
        oauth_refresh_token: z.string(),
        oauth_email: z.string(),
    }).parse(args);

    return CalendarSchema.parse(await recall_fetch({ path: "/api/v2/calendars/", method: "POST", body }));
}

/**
 * List the calendars in the workspace, following pagination.
 * https://docs.recall.ai/reference/calendars_list
 */
export async function calendars_list(args: {
    platform?: "google_calendar" | "microsoft_outlook",
    email?: string,
} = {}) {
    const query = z.object({
        platform: CalendarPlatformSchema.optional(),
        email: z.string().optional(),
    }).parse(args);

    return CalendarSchema.array().parse(await recall_fetch_all_pages({ path: "/api/v2/calendars/", query }));
}

/**
 * Retrieve a calendar from Recall.
 * https://docs.recall.ai/reference/calendars_retrieve
 */
export async function calendar_retrieve(args: { calendar_id: string }) {
    const { calendar_id } = z.object({ calendar_id: z.string() }).parse(args);

    return CalendarSchema.parse(await recall_fetch({ path: `/api/v2/calendars/${calendar_id}/` }));
}

/**
 * Like calendar_retrieve, but returns null if the calendar was deleted. Recall still sends webhooks for a
 * deleted calendar, but it can't be retrieved any more.
 * https://docs.recall.ai/docs/calendar-v2-faq
 */
export async function calendar_find(args: { calendar_id: string }) {
    try {
        return await calendar_retrieve(args);
    } catch (error) {
        if (error instanceof RecallApiError && error.status === 404) return null;
        throw error;
    }
}

/**
 * Update a calendar's OAuth credentials, e.g. with a new refresh token after the user reconnects it.
 * https://docs.recall.ai/reference/calendars_partial_update
 */
export async function calendar_update(args: {
    calendar_id: string,
    oauth_client_id: string,
    oauth_client_secret: string,
    oauth_refresh_token: string,
}) {
    const { calendar_id, ...body } = z.object({
        calendar_id: z.string(),
        oauth_client_id: z.string(),
        oauth_client_secret: z.string(),
        oauth_refresh_token: z.string(),
    }).parse(args);

    return CalendarSchema.parse(await recall_fetch({ path: `/api/v2/calendars/${calendar_id}/`, method: "PATCH", body }));
}

/**
 * Delete a calendar. Recall unschedules its bots, and the calendar and its events can no longer be retrieved.
 * Recall still sends a calendar.update webhook for it.
 * https://docs.recall.ai/reference/calendars_destroy
 */
export async function calendar_delete(args: { calendar_id: string }) {
    const { calendar_id } = z.object({ calendar_id: z.string() }).parse(args);

    await recall_fetch({ path: `/api/v2/calendars/${calendar_id}/`, method: "DELETE" });
}

/**
 * Create the calendar in Recall.ai, or update the refresh token on an existing calendar for the same account.
 * Recall doesn't deduplicate calendars on creation, so this looks one up by platform and email first.
 * See: https://docs.recall.ai/docs/calendar-v2-integration-guide
 */
export async function calendar_connect(args: {
    platform: "google_calendar" | "microsoft_outlook",
    email: string,
    oauth_client_id: string,
    oauth_client_secret: string,
    oauth_refresh_token: string,
}): Promise<{ calendar: CalendarType, reconnected: boolean }> {
    const { platform, email, ...oauth } = args;

    const [existing_calendar] = await calendars_list({ platform, email });
    if (existing_calendar) {
        const calendar = await calendar_update({ calendar_id: existing_calendar.id, ...oauth });
        return { calendar, reconnected: true };
    }

    const calendar = await calendar_create({ platform, oauth_email: email, ...oauth });
    return { calendar, reconnected: false };
}

/**
 * The connected account's email. Recall says to use `platform_email`; it's briefly null right after the
 * calendar is created, so this falls back to `oauth_email`.
 * https://docs.recall.ai/docs/calendar-v2-faq
 */
export function get_calendar_email(calendar: CalendarType): string | null {
    return calendar.platform_email ?? calendar.oauth_email ?? null;
}

/**
 * A name to show for the calendar: its email, or its ID until the email is known.
 */
export function get_calendar_label(calendar: CalendarType): string {
    return get_calendar_email(calendar) ?? calendar.id;
}

/* -------------------------------------------------------------------------- */
/*                               Calendar events                              */
/* -------------------------------------------------------------------------- */

/**
 * List a calendar's events, following pagination.
 * After a calendar.sync_events webhook, pass `updated_at__gte: last_updated_ts` to get only changed events.
 * https://docs.recall.ai/reference/calendar_events_list
 */
export async function calendar_events_list(args: {
    calendar_id: string,
    updated_at__gte?: string,
    start_time__gte?: string,
    start_time__lte?: string,
    is_deleted?: boolean,
}) {
    const query = z.object({
        calendar_id: z.string(),
        updated_at__gte: z.string().optional(),
        start_time__gte: z.string().optional(),
        start_time__lte: z.string().optional(),
        is_deleted: z.boolean().optional(),
    }).parse(args);

    return CalendarEventSchema.array().parse(await recall_fetch_all_pages({ path: "/api/v2/calendar-events/", query }));
}

/**
 * Retrieve a calendar event from Recall.
 * https://docs.recall.ai/reference/calendar_events_retrieve
 */
export async function calendar_event_retrieve(args: { calendar_event_id: string }) {
    const { calendar_event_id } = z.object({ calendar_event_id: z.string() }).parse(args);

    return CalendarEventSchema.parse(await recall_fetch({ path: `/api/v2/calendar-events/${calendar_event_id}/` }));
}

/**
 * Schedule (or reschedule) a bot for a calendar event. Calling again replaces the previously scheduled bot.
 * `meeting_url` and `join_at` are filled in from the event unless set in `bot_config`.
 * Events with the same `deduplication_key` share a single bot.
 * https://docs.recall.ai/reference/calendar_events_bot_create
 */
export async function schedule_bot_for_calendar_event(args: {
    calendar_event_id: string,
    deduplication_key: string,
    /** Any properties supported by Create Bot: https://docs.recall.ai/reference/bot_create */
    bot_config: Record<string, unknown>,
}) {
    const { calendar_event_id, ...body } = z.object({
        calendar_event_id: z.string(),
        deduplication_key: z.string(),
        bot_config: z.record(z.unknown()),
    }).parse(args);

    return CalendarEventSchema.parse(await recall_fetch({
        path: `/api/v2/calendar-events/${calendar_event_id}/bot/`,
        method: "POST",
        body,
    }));
}

/**
 * Unschedule the bot for a calendar event. Not needed when the event itself is deleted.
 * https://docs.recall.ai/reference/calendar_events_bot_destroy
 */
export async function unschedule_bot_for_calendar_event(args: { calendar_event_id: string }) {
    const { calendar_event_id } = z.object({ calendar_event_id: z.string() }).parse(args);

    return CalendarEventSchema.parse(await recall_fetch({
        path: `/api/v2/calendar-events/${calendar_event_id}/bot/`,
        method: "DELETE",
    }));
}
