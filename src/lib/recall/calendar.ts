import { fetchAllPages, recallFetch, withQuery } from "./client"

/**
 * Server-only helpers for the Recall.ai Calendar V2 API.
 * See: https://docs.recall.ai/docs/calendar-v2-integration-guide
 */

export type CalendarPlatform = "google_calendar" | "microsoft_outlook";
export type CalendarStatus = "connecting" | "connected" | "disconnected";

export type Calendar = {
    id: string;
    metadata?: Record<string, unknown> | null;
    oauth_client_id: string;
    oauth_client_secret?: string | null;
    oauth_refresh_token: string;
    platform: CalendarPlatform;
    webhook_url?: string;
    oauth_email?: string;
    platform_email: string | null;
    status: CalendarStatus;
    status_changes: Array<Record<string, unknown>>;
    created_at: string;
    updated_at: string;
};

export type CalendarEvent = {
    id: string;
    start_time: string;
    end_time: string;
    calendar_id: string;
    /** Raw event from the provider (Google Calendar or Microsoft Graph event resource). */
    raw: unknown;
    platform: string;
    platform_id: string;
    ical_uid: string;
    /** e.g. "zoom", "google_meet", or null when no meeting link was found. */
    meeting_platform: string | null;
    meeting_url: string | null;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
    /** Bots scheduled for this event. Can hold several entries if the same event is reused for later meetings. */
    bots: CalendarEventBot[];
};

/**
 * A bot linked to a calendar event. `start_time` is the event's start time, not the bot's `join_at`.
 * https://docs.recall.ai/docs/scheduling-guide
 */
export type CalendarEventBot = {
    bot_id: string;
    deduplication_key: string;
    start_time: string;
    meeting_url: string;
};

/**
 * Event title from the provider's raw data: `summary` for Google Calendar, `subject` for Outlook.
 * https://docs.recall.ai/docs/calendar-event-platform-data
 */
export function getCalendarEventTitle(event: Pick<CalendarEvent, "raw">): string {
    const raw = (event.raw ?? {}) as { summary?: unknown; subject?: unknown };
    const title = typeof raw.summary === "string" ? raw.summary : typeof raw.subject === "string" ? raw.subject : "";
    return title.trim() || "(No title)";
}


/* -------------------------------------------------------------------------- */
/*                                  Calendars                                 */
/* -------------------------------------------------------------------------- */

/**
 * Create a calendar from a user's OAuth refresh token. Represents the primary calendar of the authorizing account.
 * Calendars are not deduplicated by Recall, so check `listCalendars` for an existing one first.
 * https://docs.recall.ai/reference/calendars_create
 */
export async function createCalendar(args: {
    platform: CalendarPlatform;
    oauth_client_id: string;
    oauth_client_secret: string;
    oauth_refresh_token: string;
    oauth_email?: string;
    webhook_url?: string;
    metadata?: Record<string, unknown>;
}): Promise<Calendar> {
    return recallFetch<Calendar>("/api/v2/calendars/", { method: "POST", body: args });
}

/**
 * List all calendars in the workspace, following pagination.
 * https://docs.recall.ai/reference/calendars_list
 */
export async function listCalendars(filters: {
    email?: string;
    platform?: CalendarPlatform;
    status?: CalendarStatus;
    created_at__gte?: string;
} = {}): Promise<Calendar[]> {
    return fetchAllPages<Calendar>(withQuery("/api/v2/calendars/", filters));
}

/**
 * https://docs.recall.ai/reference/calendars_retrieve
 */
export async function getCalendar(calendarId: string): Promise<Calendar> {
    return recallFetch<Calendar>(`/api/v2/calendars/${encodeURIComponent(calendarId)}/`);
}

/**
 * Update a calendar, e.g. with a new refresh token after the user reconnects a disconnected calendar.
 * https://docs.recall.ai/reference/calendars_partial_update
 */
export async function updateCalendar(
    calendarId: string,
    updates: Partial<{
        platform: CalendarPlatform;
        oauth_client_id: string;
        oauth_client_secret: string;
        oauth_refresh_token: string;
        oauth_email: string;
        webhook_url: string;
        metadata: Record<string, unknown>;
    }>,
): Promise<Calendar> {
    return recallFetch<Calendar>(`/api/v2/calendars/${encodeURIComponent(calendarId)}/`, {
        method: "PATCH",
        body: updates,
    });
}

/**
 * Delete (disconnect) a calendar. Recall does not send a calendar.update webhook for this.
 * https://docs.recall.ai/reference/calendars_destroy
 */
export async function deleteCalendar(calendarId: string): Promise<void> {
    await recallFetch<void>(`/api/v2/calendars/${encodeURIComponent(calendarId)}/`, { method: "DELETE" });
}

/* -------------------------------------------------------------------------- */
/*                               Calendar events                              */
/* -------------------------------------------------------------------------- */

/**
 * List all events for a calendar, following pagination.
 * After a calendar.sync_events webhook, pass `updated_at__gte: last_updated_ts` to get only changed events.
 * https://docs.recall.ai/reference/calendar_events_list
 */
export async function listCalendarEvents(filters: {
    calendar_id: string;
    updated_at__gte?: string;
    start_time?: string;
    start_time__gte?: string;
    start_time__lte?: string;
    is_deleted?: boolean;
    ical_uid?: string;
}): Promise<CalendarEvent[]> {
    return fetchAllPages<CalendarEvent>(withQuery("/api/v2/calendar-events/", filters));
}


/**
 * https://docs.recall.ai/reference/calendar_events_retrieve
 */
export async function getCalendarEvent(calendarEventId: string): Promise<CalendarEvent> {
    return recallFetch<CalendarEvent>(`/api/v2/calendar-events/${encodeURIComponent(calendarEventId)}/`);
}

/**
 * Schedule (or reschedule) a bot for a calendar event. Calling again overrides the previously scheduled bot.
 * `meeting_url` and `join_at` are filled in from the event unless set in `bot_config`.
 * Use the same `deduplication_key` across events that should share a single bot.
 * https://docs.recall.ai/reference/calendar_events_bot_create
 */
export async function scheduleBotForCalendarEvent(
    calendarEventId: string,
    args: {
        deduplication_key: string;
        /** Any properties supported by Create Bot: https://docs.recall.ai/reference/bot_create */
        bot_config: Record<string, unknown>;
    },
): Promise<CalendarEvent> {
    return recallFetch<CalendarEvent>(`/api/v2/calendar-events/${encodeURIComponent(calendarEventId)}/bot/`, {
        method: "POST",
        body: args,
    });
}

/**
 * Remove the scheduled bot from a calendar event. Not needed when the event itself is deleted.
 * https://docs.recall.ai/reference/calendar_events_bot_destroy
 */
export async function deleteBotFromCalendarEvent(calendarEventId: string): Promise<CalendarEvent> {
    return recallFetch<CalendarEvent>(`/api/v2/calendar-events/${encodeURIComponent(calendarEventId)}/bot/`, {
        method: "DELETE",
    });
}

/**
 * Create the calendar in Recall.ai, or update the refresh token on an existing calendar for the same account.
 * Recall doesn't deduplicate calendars on creation, so this looks one up by platform + email first.
 * See: https://docs.recall.ai/docs/calendar-v2-integration-guide
 */
export async function connectCalendar(args: {
    platform: CalendarPlatform;
    email: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}): Promise<{ calendar: Calendar; reconnected: boolean }> {
    const [existing] = await listCalendars({ platform: args.platform, email: args.email });
    if (existing) {
        const calendar = await updateCalendar(existing.id, {
            oauth_client_id: args.clientId,
            oauth_client_secret: args.clientSecret,
            oauth_refresh_token: args.refreshToken,
        });
        return { calendar, reconnected: true };
    }

    const calendar = await createCalendar({
        platform: args.platform,
        oauth_client_id: args.clientId,
        oauth_client_secret: args.clientSecret,
        oauth_refresh_token: args.refreshToken,
        oauth_email: args.email,
    });
    return { calendar, reconnected: false };
}
