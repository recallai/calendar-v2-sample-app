import crypto from "crypto";
import { DEFAULT_BOT_SETTINGS } from "../bot-settings";
import { getRecordingRule, RECORDING_RULE_METADATA_KEY, RECORDING_RULES, type BotSource, type RecordingRule } from "../recording-rules";
import { getBot, getBotSettings, getBotSource, getUpcomingBot, isBotInSync, scheduleBot } from "./bot";
import { deleteBotFromCalendarEvent, listCalendarEvents, updateCalendar, type Calendar, type CalendarEvent } from "./calendar";

/**
 * Recording rules: Calendar V2's app-managed scheduling. Recall syncs each calendar's events and sends
 * calendar.sync_events webhooks; this app decides which events get a bot.
 * https://docs.recall.ai/docs/calendar-integration, https://docs.recall.ai/docs/scheduling-guide
 *
 * Rules are stored in the calendar's own `metadata` in Recall, so the app needs no database. Calendar
 * metadata only takes string values (max 500 characters) and keys (max 40 characters), and updating it
 * replaces the whole object, so each item gets its own key:
 * - `recording_rule`: the calendar's rule
 * - `series_<hash>`: iCalUID of a recurring series set to always record
 * - `skip_<event id>`: a meeting the user removed the bot from, so the rule doesn't add it back
 */

const SERIES_PREFIX = "series_";
const SKIP_PREFIX = "skip_";

export type CalendarRules = {
    rule: RecordingRule;
    /** iCalUIDs of recurring series that always get a bot. */
    recordedSeries: Set<string>;
    /** Event IDs the user opted out of, so rules don't re-add a bot they removed. */
    skippedEvents: Set<string>;
};

/** Short, stable metadata key for a series. iCalUIDs can be over 100 characters. */
function seriesKey(icalUid: string): string {
    return SERIES_PREFIX + crypto.createHash("sha256").update(icalUid).digest("hex").slice(0, 24);
}

/** Event IDs are UUIDs; dropping the dashes keeps the key under the 40-character limit. */
function skipKey(eventId: string): string {
    return SKIP_PREFIX + eventId.replaceAll("-", "");
}

export function getCalendarRules(calendar: Calendar): CalendarRules {
    const metadata = (calendar.metadata ?? {}) as Record<string, string>;
    const rules: CalendarRules = { rule: getRecordingRule(metadata), recordedSeries: new Set(), skippedEvents: new Set() };
    for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith(SERIES_PREFIX)) rules.recordedSeries.add(value);
        if (key.startsWith(SKIP_PREFIX)) rules.skippedEvents.add(value);
    }
    return rules;
}

/**
 * Save the rules to the calendar's metadata, keeping any metadata keys this app doesn't own.
 * https://docs.recall.ai/reference/calendars_partial_update
 */
export async function saveCalendarRules(calendar: Calendar, rules: CalendarRules): Promise<Calendar> {
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries((calendar.metadata ?? {}) as Record<string, string>)) {
        const isOwnedKey = key === RECORDING_RULE_METADATA_KEY || key.startsWith(SERIES_PREFIX) || key.startsWith(SKIP_PREFIX);
        if (!isOwnedKey) metadata[key] = value;
    }
    metadata[RECORDING_RULE_METADATA_KEY] = rules.rule;
    for (const icalUid of rules.recordedSeries) metadata[seriesKey(icalUid)] = icalUid;
    for (const eventId of rules.skippedEvents) metadata[skipKey(eventId)] = eventId;

    return updateCalendar(calendar.id, { metadata });
}

/* -------------------------------------------------------------------------- */
/*                         Reading the provider's raw data                    */
/* -------------------------------------------------------------------------- */

/**
 * Attendees and the calendar owner's response from the raw event: Google Calendar's `attendees[].email`
 * and `responseStatus`, or Outlook's `attendees[].emailAddress.address` and `responseStatus.response`.
 * https://docs.recall.ai/docs/calendar-event-platform-data
 */
type RawEvent = {
    attendees?: Array<{
        email?: string;
        self?: boolean;
        resource?: boolean;
        responseStatus?: string;
        emailAddress?: { address?: string };
    }>;
    organizer?: { email?: string; self?: boolean; emailAddress?: { address?: string } };
    responseStatus?: { response?: string };
    isOrganizer?: boolean;
    recurringEventId?: string;
    seriesMasterId?: string | null;
    type?: string;
};

function getRaw(event: CalendarEvent): RawEvent {
    return (event.raw ?? {}) as RawEvent;
}

function getDomain(email: string | undefined): string | undefined {
    return email?.split("@")[1]?.toLowerCase();
}

/** Whether anyone invited (or the organizer) has an email domain other than the calendar owner's. */
function hasExternalGuests(event: CalendarEvent, calendarEmail: string | undefined): boolean {
    const ownDomain = getDomain(calendarEmail);
    if (!ownDomain) return false;
    const raw = getRaw(event);
    const emails = [
        ...(raw.attendees ?? []).filter((attendee) => !attendee.resource).map((attendee) => attendee.email ?? attendee.emailAddress?.address),
        raw.organizer?.email ?? raw.organizer?.emailAddress?.address,
    ];
    return emails.some((email) => {
        const domain = getDomain(email);
        return domain !== undefined && domain !== ownDomain;
    });
}

/** Whether the calendar owner organizes the meeting or has accepted it. */
function isAccepted(event: CalendarEvent): boolean {
    const raw = getRaw(event);
    if (event.platform === "microsoft_outlook") {
        const response = raw.responseStatus?.response;
        return raw.isOrganizer === true || response === "organizer" || response === "accepted";
    }
    const self = raw.attendees?.find((attendee) => attendee.self);
    if (self) return self.responseStatus === "accepted";
    // Google omits attendees for events with no guests, which the owner created themselves.
    return raw.organizer?.self === true || !raw.attendees?.length;
}

/** Whether the event is one occurrence of a recurring series (Google `recurringEventId`, Outlook `seriesMasterId`). */
export function isRecurringEvent(event: CalendarEvent): boolean {
    const raw = getRaw(event);
    return !!raw.recurringEventId || !!raw.seriesMasterId || raw.type === "occurrence";
}

/* -------------------------------------------------------------------------- */
/*                                 Decisions                                  */
/* -------------------------------------------------------------------------- */

export type RecordingDecision = {
    record: boolean;
    /** Which kind of automatic bot this would be, when `record` is true. */
    source: Exclude<BotSource, "manual"> | null;
    /** Shown in the UI to explain why a meeting does or doesn't get a bot automatically. */
    reason: string;
};

/**
 * Whether the calendar's rules want a bot on this event. Manually added bots are separate: they're
 * kept regardless of what this returns.
 */
export function getRecordingDecision(event: CalendarEvent, calendar: Calendar, rules: CalendarRules): RecordingDecision {
    if (!event.meeting_url) {
        return { record: false, source: null, reason: "No meeting link, so a bot can't join." };
    }
    if (rules.skippedEvents.has(event.id)) {
        return { record: false, source: null, reason: "You removed the bot from this meeting, so rules skip it." };
    }
    if (rules.recordedSeries.has(event.ical_uid)) {
        return { record: true, source: "series", reason: "This recurring series is set to always record." };
    }

    if (rules.rule === "manual") {
        return { record: false, source: null, reason: "This calendar only gets bots you add yourself." };
    }

    const calendarEmail = calendar.platform_email ?? calendar.oauth_email;
    const matches =
        rules.rule === "all" ||
        (rules.rule === "external" && hasExternalGuests(event, calendarEmail)) ||
        (rules.rule === "accepted" && isAccepted(event));

    return matches
        ? { record: true, source: "rule", reason: `Matches this calendar's rule: ${RECORDING_RULES[rules.rule].label}.` }
        : { record: false, source: null, reason: `Doesn't match this calendar's rule: ${RECORDING_RULES[rules.rule].label}.` };
}

export type ReconcileAction = "scheduled" | "rescheduled" | "removed" | "unchanged";

/**
 * Make an event's bot match the calendar's rules and the event's latest time and meeting link.
 * - Rule or series bots are added when the rules match, and removed when they stop matching.
 * - Manually added bots are always kept.
 * - Any bot is moved when its meeting moves, keeping its settings, and removed if the meeting loses its link.
 * Deleted events are skipped: Recall unschedules their bots automatically.
 */
export async function reconcileEvent(
    event: CalendarEvent,
    calendar: Calendar,
    rules: CalendarRules,
    now = new Date(),
): Promise<ReconcileAction> {
    if (event.is_deleted || new Date(event.start_time) <= now) {
        return "unchanged";
    }

    const decision = getRecordingDecision(event, calendar, rules);
    const scheduledBot = getUpcomingBot(event, now);

    if (!scheduledBot) {
        if (!decision.record || !decision.source) return "unchanged";
        await scheduleBot(event, DEFAULT_BOT_SETTINGS, decision.source);
        return "scheduled";
    }

    const bot = await getBot(scheduledBot.bot_id);
    const source = getBotSource(bot);

    if (!event.meeting_url || (source !== "manual" && !decision.record)) {
        await deleteBotFromCalendarEvent(event.id);
        return "removed";
    }

    if (!isBotInSync(scheduledBot, event)) {
        await scheduleBot(event, getBotSettings(bot), source);
        return "rescheduled";
    }
    return "unchanged";
}

export type ReconcileSummary = Record<ReconcileAction | "failed", number>;

/**
 * Reconcile events one at a time, soonest first: the scheduling guide recommends chronological order,
 * and sequential requests avoid 409s from parallel changes to the same bot.
 */
export async function reconcileEvents(
    events: CalendarEvent[],
    calendar: Calendar,
    rules: CalendarRules,
): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = { scheduled: 0, rescheduled: 0, removed: 0, unchanged: 0, failed: 0 };
    const sorted = [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    for (const event of sorted) {
        try {
            summary[await reconcileEvent(event, calendar, rules)]++;
        } catch (error) {
            summary.failed++;
            console.error(`Failed to reconcile calendar_event_id=${event.id}:`, error instanceof Error ? error.message : error);
        }
    }
    return summary;
}

/**
 * Apply a calendar's rules to all of its upcoming events, e.g. right after the rule changes.
 * Recall keeps events for the next 28 days, which is as far ahead as bots need scheduling.
 */
export async function applyRulesToUpcomingEvents(calendar: Calendar, rules: CalendarRules): Promise<ReconcileSummary> {
    const events = await listCalendarEvents({
        calendar_id: calendar.id,
        is_deleted: false,
        start_time__gte: new Date().toISOString(),
    });
    return reconcileEvents(events, calendar, rules);
}

export function formatReconcileSummary(summary: ReconcileSummary): string {
    return Object.entries(summary)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
}
