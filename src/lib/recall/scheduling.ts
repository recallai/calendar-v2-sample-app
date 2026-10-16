import { listEventOverrides, logBotDecision, upsertCalendar } from "@/db/queries";
import type { CalendarRow } from "@/db/schema";
import type { BotSettings } from "@/lib/bot-settings";
import { SCHEDULE_MODES, type MeetingOverride, type ScheduleMode } from "@/lib/schedule-modes";
import { getBot, getBotSettings, getBotSource, getUpcomingBot, isBotInSync, scheduleBot } from "./bot";
import {
    deleteBotFromCalendarEvent,
    getCalendarEventTitle,
    listCalendarEvents,
    type Calendar,
    type CalendarEvent,
} from "./calendar";

/**
 * Calendar V2's app-managed scheduling: Recall syncs each calendar's events and sends calendar.sync_events
 * webhooks; this app decides which events get a bot, based on the calendar's schedule mode.
 * https://docs.recall.ai/docs/calendar-integration, https://docs.recall.ai/docs/scheduling-guide
 *
 * For each event, in order:
 * 1. No meeting link -> no bot.
 * 2. A per-meeting override (added or removed by hand) wins.
 * 3. Otherwise the calendar's schedule mode decides.
 */

/** Everything needed to make decisions for one calendar's events. */
export type DispatchContext = {
    calendar: Calendar;
    settings: CalendarRow;
    overrides: Map<string, MeetingOverride>;
};

export async function loadDispatchContexts(calendars: Calendar[]): Promise<Map<string, DispatchContext>> {
    const rows = await Promise.all(calendars.map(upsertCalendar));
    const overrides = await listEventOverrides(calendars.map((calendar) => calendar.id));

    return new Map(
        calendars.map((calendar, index) => [
            calendar.id,
            {
                calendar,
                settings: rows[index],
                overrides: new Map(
                    overrides
                        .filter((override) => override.calendarId === calendar.id)
                        .map((override) => [override.calendarEventId, override.action]),
                ),
            },
        ]),
    );
}

export async function loadDispatchContext(calendar: Calendar): Promise<DispatchContext> {
    return (await loadDispatchContexts([calendar])).get(calendar.id)!;
}

/** The calendar's settings for bots its schedule mode sends. */
export function getCalendarBotSettings(settings: CalendarRow): BotSettings {
    return {
        botName: settings.botName,
        joinMinutesEarly: settings.joinMinutesEarly,
        chatMessage: settings.chatMessage,
        waitingRoomTimeout: settings.waitingRoomTimeout,
        nooneJoinedTimeout: settings.nooneJoinedTimeout,
        everyoneLeftTimeout: settings.everyoneLeftTimeout,
    };
}

/* -------------------------------------------------------------------------- */
/*                         Reading the provider's raw data                    */
/* -------------------------------------------------------------------------- */

/**
 * Attendees and organizer from the raw event: Google Calendar's `attendees[].email` and `organizer.self`,
 * or Outlook's `attendees[].emailAddress.address` and `isOrganizer`.
 * https://docs.recall.ai/docs/calendar-event-platform-data
 */
type RawEvent = {
    attendees?: Array<{ email?: string; self?: boolean; resource?: boolean; emailAddress?: { address?: string } }>;
    organizer?: { email?: string; self?: boolean; emailAddress?: { address?: string } };
    responseStatus?: { response?: string };
    isOrganizer?: boolean;
};

function getRaw(event: CalendarEvent): RawEvent {
    return (event.raw ?? {}) as RawEvent;
}

function getDomain(email: string | undefined): string | undefined {
    return email?.split("@")[1]?.toLowerCase();
}

/**
 * Email addresses of everyone else on the meeting: invitees (not meeting rooms, not the calendar owner)
 * and the organizer if it's someone else.
 */
function getOtherParticipantEmails(event: CalendarEvent, calendarEmail: string | undefined): string[] {
    const raw = getRaw(event);
    const own = calendarEmail?.toLowerCase();
    const emails = [
        ...(raw.attendees ?? [])
            .filter((attendee) => !attendee.resource && !attendee.self)
            .map((attendee) => attendee.email ?? attendee.emailAddress?.address),
        raw.organizer?.self ? undefined : (raw.organizer?.email ?? raw.organizer?.emailAddress?.address),
    ];
    return [...new Set(emails.map((email) => email?.toLowerCase()).filter((email): email is string => !!email && email !== own))];
}

/** Whether the calendar owner organized the meeting. */
function isOrganizer(event: CalendarEvent): boolean {
    const raw = getRaw(event);
    if (event.platform === "microsoft_outlook") {
        return raw.isOrganizer === true || raw.responseStatus?.response === "organizer";
    }
    // Google omits attendees and organizer details for events with no guests, which the owner created.
    return raw.organizer?.self === true || (!raw.organizer && !raw.attendees?.length);
}

/** Whether the calendar's schedule mode wants a bot on this meeting. */
function matchesScheduleMode(mode: ScheduleMode, event: CalendarEvent, calendar: Calendar): boolean {
    const calendarEmail = calendar.platform_email ?? calendar.oauth_email;
    const ownDomain = getDomain(calendarEmail);
    const others = getOtherParticipantEmails(event, calendarEmail);
    const hasExternal = !!ownDomain && others.some((email) => getDomain(email) !== ownDomain);

    switch (mode) {
        case "none":
            return false;
        case "all":
            return true;
        case "organized":
            return isOrganizer(event);
        case "external":
            return hasExternal;
        case "internal":
            return others.length > 0 && !hasExternal;
    }
}

/* -------------------------------------------------------------------------- */
/*                                 Decisions                                  */
/* -------------------------------------------------------------------------- */

export type DispatchDecision = {
    dispatch: boolean;
    /** What decided it. */
    via: "no_link" | "override" | "mode";
    /** Shown in the UI and logged, e.g. "This calendar sends bots: When there are external guests." */
    reason: string;
};

export function getDispatchDecision(event: CalendarEvent, context: DispatchContext): DispatchDecision {
    if (!event.meeting_url) {
        return { dispatch: false, via: "no_link", reason: "No meeting link, so a bot can't join." };
    }

    const override = context.overrides.get(event.id);
    if (override) {
        return override === "dispatch"
            ? { dispatch: true, via: "override", reason: "You added a bot to this meeting by hand." }
            : { dispatch: false, via: "override", reason: "You removed the bot from this meeting, so it's skipped." };
    }

    const mode = context.settings.scheduleMode;
    if (mode === "none") {
        return { dispatch: false, via: "mode", reason: "This calendar doesn't send bots automatically." };
    }
    const label = SCHEDULE_MODES[mode].label;
    return matchesScheduleMode(mode, event, context.calendar)
        ? { dispatch: true, via: "mode", reason: `This calendar sends bots: ${label}.` }
        : { dispatch: false, via: "mode", reason: `Doesn't match this calendar's setting: ${label}.` };
}

export type ReconcileAction = "scheduled" | "rescheduled" | "removed" | "unchanged";
export type DecisionTrigger = "webhook" | "rules_changed" | "user";

/**
 * Make an event's bot match the dispatch decision and the event's latest time and meeting link,
 * and log any change.
 * - Add a bot when the decision says to and there isn't one.
 * - Remove a bot when the decision says not to. Bots added by hand are only removed by a "never" override
 *   (or losing the meeting link), so changing the mode never takes away a bot the user added themselves.
 * - Move a bot whose meeting moved, keeping its settings.
 * Deleted or already-started events are left alone; Recall unschedules bots for deleted events itself.
 */
export async function reconcileEvent(
    event: CalendarEvent,
    context: DispatchContext,
    trigger: DecisionTrigger,
    webhookEventId: string | null = null,
    now = new Date(),
): Promise<ReconcileAction> {
    if (event.is_deleted || new Date(event.start_time) <= now) {
        return "unchanged";
    }

    const decision = getDispatchDecision(event, context);
    const scheduledBot = getUpcomingBot(event, now);
    const log = (action: Exclude<ReconcileAction, "unchanged">, reason = decision.reason) =>
        logBotDecision({
            calendarId: context.calendar.id,
            calendarEventId: event.id,
            eventTitle: getCalendarEventTitle(event),
            eventStartTime: event.start_time,
            action,
            reason,
            trigger,
            webhookEventId,
        });

    if (!scheduledBot) {
        if (!decision.dispatch) return "unchanged";
        const source = decision.via === "override" ? "manual" : "rule";
        await scheduleBot(event, getCalendarBotSettings(context.settings), source);
        await log("scheduled");
        return "scheduled";
    }

    const bot = await getBot(scheduledBot.bot_id);
    const source = getBotSource(bot);
    const shouldRemove =
        !decision.dispatch && (decision.via === "override" || decision.via === "no_link" || source === "rule");

    if (shouldRemove) {
        await deleteBotFromCalendarEvent(event.id);
        await log("removed");
        return "removed";
    }

    if (!isBotInSync(scheduledBot, event)) {
        await scheduleBot(event, getBotSettings(bot), source);
        await log("rescheduled", "The meeting moved, so its bot was moved too.");
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
    context: DispatchContext,
    trigger: DecisionTrigger,
    webhookEventId: string | null = null,
): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = { scheduled: 0, rescheduled: 0, removed: 0, unchanged: 0, failed: 0 };
    const sorted = [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    for (const event of sorted) {
        try {
            summary[await reconcileEvent(event, context, trigger, webhookEventId)]++;
        } catch (error) {
            summary.failed++;
            console.error(`Failed to reconcile calendar_event_id=${event.id}:`, error instanceof Error ? error.message : error);
        }
    }
    return summary;
}

/**
 * Apply a calendar's schedule mode to all of its upcoming events, e.g. right after the mode changes.
 * Recall keeps events for the next 28 days, which is as far ahead as bots need scheduling.
 */
export async function applyScheduleToUpcomingEvents(
    calendar: Calendar,
    trigger: DecisionTrigger = "rules_changed",
): Promise<ReconcileSummary> {
    const [context, events] = await Promise.all([
        loadDispatchContext(calendar),
        listCalendarEvents({ calendar_id: calendar.id, is_deleted: false, start_time__gte: new Date().toISOString() }),
    ]);
    return reconcileEvents(events, context, trigger);
}

export function formatReconcileSummary(summary: ReconcileSummary): string {
    return Object.entries(summary)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
}
