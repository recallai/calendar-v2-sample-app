import { clearEventOverride, logBotDecision, setEventOverride } from "@/db/queries";
import type { BotSettings } from "@/lib/bot-settings";
import {
    deleteBotFromCalendarEvent,
    getCalendar,
    getCalendarEvent,
    getCalendarEventTitle,
    getDispatchDecision,
    getUpcomingBot,
    loadDispatchContext,
    reconcileEvent,
    scheduleBot,
    type CalendarEvent,
} from "@/lib/recall";
import { ServiceError } from "./errors";

/**
 * Per-meeting choices made by hand. They're stored as overrides, which beat the calendar's schedule mode.
 */

function decisionFor(event: CalendarEvent) {
    return {
        calendarId: event.calendar_id,
        calendarEventId: event.id,
        eventTitle: getCalendarEventTitle(event),
        eventStartTime: event.start_time,
        trigger: "user" as const,
    };
}

/**
 * Add a bot to a meeting, or update the existing bot's settings. Scheduling again replaces the previous
 * bot config, so the same call handles both. The meeting is marked "always send a bot", so the calendar's
 * schedule mode won't remove it.
 * https://docs.recall.ai/reference/calendar_events_bot_create
 */
export async function addOrUpdateMeetingBot(eventId: string, settings: BotSettings): Promise<void> {
    // Re-fetch so the bot is scheduled against the event's latest start time and meeting link.
    const event = await getCalendarEvent(eventId);
    if (event.is_deleted) throw new ServiceError("This meeting was removed from the calendar.");
    if (!event.meeting_url) throw new ServiceError("This meeting doesn't have a meeting link.");
    if (new Date(event.start_time) <= new Date()) throw new ServiceError("This meeting has already started.");

    const hadBot = !!getUpcomingBot(event);
    await scheduleBot(event, settings, "manual");
    await setEventOverride(event.id, event.calendar_id, "dispatch");
    await logBotDecision({
        ...decisionFor(event),
        action: hadBot ? "rescheduled" : "scheduled",
        reason: hadBot ? "You changed this meeting's bot settings." : "You added a bot to this meeting by hand.",
    });
    console.log(`Bot saved for calendar_event_id=${eventId}`);
}

/**
 * Remove the bot from a meeting and mark it "never send a bot", so the schedule mode doesn't add it back. If the bot
 * is shared with other calendars' copies of the meeting (deduplication), it still joins for them.
 * https://docs.recall.ai/reference/calendar_events_bot_destroy
 */
export async function removeMeetingBot(eventId: string): Promise<void> {
    const event = await getCalendarEvent(eventId);
    if (getUpcomingBot(event)) {
        await deleteBotFromCalendarEvent(eventId);
        await logBotDecision({ ...decisionFor(event), action: "removed", reason: "You removed the bot from this meeting." });
    }
    await setEventOverride(event.id, event.calendar_id, "skip");
    console.log(`Bot removed from calendar_event_id=${eventId}`);
}

/**
 * Drop a meeting's "always" / "never" override so the calendar's schedule mode decides again.
 */
export async function resetMeetingToRules(eventId: string): Promise<void> {
    const event = await getCalendarEvent(eventId);
    await clearEventOverride(event.id);
    const context = await loadDispatchContext(await getCalendar(event.calendar_id));
    const decision = getDispatchDecision(event, context);

    // The bot here was added by hand, which the schedule mode normally leaves alone. The user asked for
    // the calendar's setting to decide, so remove it if that setting doesn't want a bot.
    if (!decision.dispatch && getUpcomingBot(event) && new Date(event.start_time) > new Date()) {
        await deleteBotFromCalendarEvent(event.id);
        await logBotDecision({
            ...decisionFor(event),
            action: "removed",
            reason: `Switched back to the calendar's setting. ${decision.reason}`,
        });
        return;
    }
    await reconcileEvent(event, context, "user");
}
