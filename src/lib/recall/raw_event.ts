import type { CalendarEventType } from "../../schemas/CalendarEventArtifactSchema";

/**
 * Reading a calendar event's `raw` field: the event exactly as the calendar provider returned it.
 * Recall normalizes the times and meeting link, but anything else (title, guests, organizer) has to be
 * read from `raw`, which looks different for Google Calendar and Microsoft Outlook.
 * https://docs.recall.ai/docs/calendar-event-platform-data
 */

/**
 * The Google Calendar event fields this app reads.
 * https://developers.google.com/calendar/api/v3/reference/events
 */
type GoogleRawEvent = {
    summary?: string;
    /** Left out when the event has no guests. */
    attendees?: Array<{ email?: string; self?: boolean; resource?: boolean }>;
    organizer?: { email?: string; self?: boolean };
};

/**
 * The Microsoft Graph event fields this app reads.
 * https://learn.microsoft.com/en-us/graph/api/resources/event
 */
type OutlookRawEvent = {
    subject?: string;
    attendees?: Array<{ type?: "required" | "optional" | "resource"; emailAddress?: { address?: string } }>;
    organizer?: { emailAddress?: { address?: string } };
    isOrganizer?: boolean;
};

function is_outlook(calendar_event: CalendarEventType): boolean {
    return calendar_event.platform === "microsoft_outlook";
}

function google_raw(calendar_event: CalendarEventType): GoogleRawEvent {
    return (calendar_event.raw ?? {}) as GoogleRawEvent;
}

function outlook_raw(calendar_event: CalendarEventType): OutlookRawEvent {
    return (calendar_event.raw ?? {}) as OutlookRawEvent;
}

/** The event's title: `summary` on Google Calendar, `subject` on Outlook. */
export function get_event_title(calendar_event: CalendarEventType): string {
    const title = is_outlook(calendar_event) ? outlook_raw(calendar_event).subject : google_raw(calendar_event).summary;
    return title?.trim() || "(No title)";
}

/** Whether the calendar's owner organized the event. */
export function is_organized_by_owner(calendar_event: CalendarEventType): boolean {
    if (is_outlook(calendar_event)) {
        return outlook_raw(calendar_event).isOrganizer === true;
    }
    const raw = google_raw(calendar_event);
    // Google leaves out `organizer` and `attendees` on events the owner made without inviting anyone.
    return raw.organizer?.self === true || (!raw.organizer && !raw.attendees?.length);
}

/**
 * Lowercased email addresses of everyone on the event except the calendar's owner: its guests (not
 * meeting rooms) and its organizer. The guest list can be missing if the organizer hid it.
 */
export function get_guest_emails(calendar_event: CalendarEventType, owner_email: string | null): string[] {
    let emails: Array<string | undefined>;
    if (is_outlook(calendar_event)) {
        const raw = outlook_raw(calendar_event);
        emails = [
            ...(raw.attendees ?? []).filter((attendee) => attendee.type !== "resource").map((attendee) => attendee.emailAddress?.address),
            raw.organizer?.emailAddress?.address,
        ];
    } else {
        const raw = google_raw(calendar_event);
        emails = [
            ...(raw.attendees ?? []).filter((attendee) => !attendee.resource && !attendee.self).map((attendee) => attendee.email),
            raw.organizer?.self ? undefined : raw.organizer?.email,
        ];
    }

    const owner = owner_email?.toLowerCase();
    const others = emails.map((email) => email?.toLowerCase()).filter((email): email is string => !!email && email !== owner);
    return [...new Set(others)];
}
