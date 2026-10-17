import { calendar_settings_list, event_overrides_list } from "@/db/queries";
import { get_calendar_email, get_guest_emails, is_organized_by_owner } from "@/lib/recall";
import { SCHEDULE_MODES } from "@/lib/settings";
import type { CalendarType } from "@/schemas/CalendarArtifactSchema";
import type { CalendarEventType } from "@/schemas/CalendarEventArtifactSchema";
import type { CalendarSettingsType, ScheduleModeType } from "@/schemas/CalendarSettingsSchema";

/**
 * Deciding whether an event should have a bot. With Calendar V2 this is up to the app, not Recall.
 * For each event, in order:
 * 1. No meeting link -> no bot.
 * 2. A per-meeting override (the user added or removed the bot by hand) wins.
 * 3. Otherwise the calendar's schedule mode decides.
 * https://docs.recall.ai/docs/scheduling-guide
 */

/** A per-meeting choice, made by adding or removing a bot by hand, that beats the calendar's schedule mode. */
export type MeetingOverride = "always" | "never";

/** Everything needed to decide for one calendar's events. */
export type SchedulingContext = {
    calendar: CalendarType,
    /** The app's settings for the calendar: its schedule mode and bot settings. */
    settings: CalendarSettingsType,
    /** Overrides by calendar event ID. */
    overrides: Map<string, MeetingOverride>,
};

/**
 * Load the app's settings and overrides for each calendar, keyed by calendar ID.
 */
export async function load_scheduling_contexts(args: { calendars: CalendarType[] }): Promise<Map<string, SchedulingContext>> {
    const { calendars } = args;
    const calendar_ids = calendars.map((calendar) => calendar.id);
    const [settings, overrides] = await Promise.all([
        calendar_settings_list({ calendar_ids }),
        event_overrides_list({ calendar_ids }),
    ]);

    return new Map(calendars.map((calendar) => [
        calendar.id,
        {
            calendar,
            settings: settings.get(calendar.id)!,
            overrides: new Map(overrides
                .filter((override) => override.calendar_id === calendar.id)
                .map((override) => [override.calendar_event_id, override.action])),
        },
    ]));
}

export async function load_scheduling_context(args: { calendar: CalendarType }): Promise<SchedulingContext> {
    const { calendar } = args;
    return (await load_scheduling_contexts({ calendars: [calendar] })).get(calendar.id)!;
}

function get_domain(email: string | null | undefined): string | undefined {
    return email?.split("@")[1]?.toLowerCase();
}

/**
 * Whether the calendar's schedule mode wants a bot on this event.
 */
function matches_schedule_mode(args: {
    schedule_mode: ScheduleModeType,
    calendar_event: CalendarEventType,
    calendar: CalendarType,
}): boolean {
    const { schedule_mode, calendar_event, calendar } = args;
    const owner_email = get_calendar_email(calendar);
    const own_domain = get_domain(owner_email);
    const guests = get_guest_emails(calendar_event, owner_email);
    const has_external_guests = !!own_domain && guests.some((email) => get_domain(email) !== own_domain);

    switch (schedule_mode) {
        case "none":
            return false;
        case "all":
            return true;
        case "organized":
            return is_organized_by_owner(calendar_event);
        case "external":
            return has_external_guests;
        case "internal":
            return guests.length > 0 && !has_external_guests;
    }
}

export type BotDecision = {
    wants_bot: boolean,
    /** What decided it. */
    decided_by: "no_link" | "override" | "schedule_mode",
    /** Shown in the UI and logged, e.g. "This calendar sends bots: When there are external guests." */
    reason: string,
};

/**
 * Whether an event should have a bot, and why.
 */
export function get_bot_decision(args: { calendar_event: CalendarEventType, context: SchedulingContext }): BotDecision {
    const { calendar_event, context } = args;

    if (!calendar_event.meeting_url) {
        return { wants_bot: false, decided_by: "no_link", reason: "No meeting link, so a bot can't join." };
    }

    const override = context.overrides.get(calendar_event.id);
    if (override) {
        return override === "always"
            ? { wants_bot: true, decided_by: "override", reason: "You added a bot to this meeting by hand." }
            : { wants_bot: false, decided_by: "override", reason: "You removed the bot from this meeting, so it's skipped." };
    }

    const { scheduleMode: schedule_mode } = context.settings;
    if (schedule_mode === "none") {
        return { wants_bot: false, decided_by: "schedule_mode", reason: "This calendar doesn't send bots automatically." };
    }
    const { label } = SCHEDULE_MODES[schedule_mode];
    return matches_schedule_mode({ schedule_mode, calendar_event, calendar: context.calendar })
        ? { wants_bot: true, decided_by: "schedule_mode", reason: `This calendar sends bots: ${label}.` }
        : { wants_bot: false, decided_by: "schedule_mode", reason: `Doesn't match this calendar's setting: ${label}.` };
}
