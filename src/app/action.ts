"use server";

import { revalidatePath } from "next/cache";
import { BotSettingsSchema, type BotSettings } from "../lib/bot-settings";
import {
    applyRulesToUpcomingEvents,
    deleteBotFromCalendarEvent,
    deleteCalendar,
    formatReconcileSummary,
    getCalendar,
    getCalendarEvent,
    getCalendarRules,
    getRecordingDecision,
    getUpcomingBot,
    hasCalendarEvents,
    listCalendarEvents,
    reconcileEvents,
    saveCalendarRules,
    scheduleBot,
    type ReconcileSummary,
} from "../lib/recall";
import { isRecordingRule, type RecordingRule } from "../lib/recording-rules";

export type ActionResult = { error?: string };
export type RulesActionResult = ActionResult & { summary?: ReconcileSummary };
export type RemoveCalendarResult = ActionResult;

/**
 * Delete (disconnect) a calendar in Recall.ai. Recall immediately unschedules bots for its future meetings,
 * and doesn't send a calendar.update webhook since the delete was initiated by us.
 * https://docs.recall.ai/docs/scheduling-guide#disconnectingdeleting-a-calendar
 */
export async function removeCalendar(id: string): Promise<RemoveCalendarResult> {
    if (typeof id !== "string" || id.length === 0) {
        return { error: "Missing calendar id" };
    }

    try {
      await deleteCalendar(id);
    } catch (error) {
      console.error(`Failed to delete calendar_id=${id}:`, error instanceof Error ? error.message : error);
      return { error: "Couldn't delete calendar. Try again." };
    }

    console.log(`Calendar deleted: calendar_id=${id}`);
    revalidatePath("/");
    return {};
}

/**
 * Add a bot to a meeting, or update the existing bot's settings. Scheduling again replaces the previous
 * bot config, so the same call handles both.
 * https://docs.recall.ai/reference/calendar_events_bot_create
 */
export async function saveBotForEvent(eventId: string, settings: BotSettings): Promise<ActionResult> {
    const parsed = BotSettingsSchema.safeParse(settings);
    if (typeof eventId !== "string" || eventId.length === 0) {
        return { error: "Missing calendar event id" };
    }
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid bot settings" };
    }

    try {
        // Re-fetch so the bot is scheduled against the event's latest start time and meeting link.
        const event = await getCalendarEvent(eventId);
        if (event.is_deleted) return { error: "This meeting was removed from the calendar." };
        if (!event.meeting_url) return { error: "This meeting doesn't have a meeting link." };
        if (new Date(event.start_time) <= new Date()) return { error: "This meeting has already started." };

        // Bots added or edited by hand are kept regardless of the calendar's rules.
        await scheduleBot(event, parsed.data, "manual");

        // If the user had skipped this meeting, adding a bot by hand undoes that.
        const calendar = await getCalendar(event.calendar_id);
        const rules = getCalendarRules(calendar);
        if (rules.skippedEvents.delete(event.id)) {
            await saveCalendarRules(calendar, rules);
        }
    } catch (error) {
        console.error(`Failed to schedule bot for calendar_event_id=${eventId}:`, error instanceof Error ? error.message : error);
        return { error: "Couldn't schedule the bot. Try again." };
    }

    console.log(`Bot saved for calendar_event_id=${eventId}`);
    revalidatePath("/");
    return {};
}

/**
 * Remove the bot from a meeting. If the bot is shared with other calendars' copies of the meeting
 * (deduplication), it still joins for them. If the calendar's rules would add the bot back, the meeting
 * is marked as skipped so they leave it alone.
 * https://docs.recall.ai/reference/calendar_events_bot_destroy
 */
export async function removeBotFromEvent(eventId: string): Promise<ActionResult> {
    if (typeof eventId !== "string" || eventId.length === 0) {
        return { error: "Missing calendar event id" };
    }

    try {
        const event = await getCalendarEvent(eventId);
        if (getUpcomingBot(event)) {
            await deleteBotFromCalendarEvent(eventId);
        }

        const calendar = await getCalendar(event.calendar_id);
        const rules = getCalendarRules(calendar);
        if (getRecordingDecision(event, calendar, rules).record) {
            rules.skippedEvents.add(event.id);
            await saveCalendarRules(calendar, rules);
        }
    } catch (error) {
        console.error(`Failed to remove bot from calendar_event_id=${eventId}:`, error instanceof Error ? error.message : error);
        return { error: "Couldn't remove the bot. Try again." };
    }

    console.log(`Bot removed from calendar_event_id=${eventId}`);
    revalidatePath("/");
    return {};
}

/**
 * Whether Recall has finished loading a newly connected calendar's events, so the page knows when to refresh.
 */
export async function isCalendarSynced(calendarId: string): Promise<boolean> {
    if (typeof calendarId !== "string" || calendarId.length === 0) {
        return false;
    }
    try {
        return await hasCalendarEvents(calendarId);
    } catch (error) {
        console.error(`Failed to check events for calendar_id=${calendarId}:`, error instanceof Error ? error.message : error);
        return false;
    }
}

/**
 * Change a calendar's recording rule and apply it to its upcoming meetings right away: bots are added
 * to meetings that now match and removed from rule-added meetings that don't. Manually added bots stay.
 * Changing the rule also clears any meetings the user skipped under the previous rule.
 */
export async function setRecordingRule(calendarId: string, rule: RecordingRule): Promise<RulesActionResult> {
    if (typeof calendarId !== "string" || calendarId.length === 0) {
        return { error: "Missing calendar id" };
    }
    if (!isRecordingRule(rule)) {
        return { error: "Unknown recording rule" };
    }

    try {
        const calendar = await getCalendar(calendarId);
        if (calendar.status !== "connected") return { error: "This calendar isn't connected." };

        const rules = getCalendarRules(calendar);
        rules.rule = rule;
        rules.skippedEvents.clear();
        const updated = await saveCalendarRules(calendar, rules);
        const summary = await applyRulesToUpcomingEvents(updated, rules);

        console.log(`Recording rule set: calendar_id=${calendarId} rule=${rule} ${formatReconcileSummary(summary)}`);
        revalidatePath("/");
        return { summary };
    } catch (error) {
        console.error(`Failed to set recording rule for calendar_id=${calendarId}:`, error instanceof Error ? error.message : error);
        return { error: "Couldn't update the recording rule. Try again." };
    }
}

/**
 * Turn "always record this series" on or off for a recurring meeting, and apply it to the series'
 * upcoming occurrences. Uses the event's iCalUID, which Recall's scheduling guide suggests for
 * recording all instances of a recurring event.
 * https://docs.recall.ai/docs/scheduling-guide#2-determine-whether-an-event-should-be-recorded
 */
export async function setSeriesRecording(eventId: string, enabled: boolean): Promise<RulesActionResult> {
    if (typeof eventId !== "string" || eventId.length === 0) {
        return { error: "Missing calendar event id" };
    }

    try {
        const event = await getCalendarEvent(eventId);
        const calendar = await getCalendar(event.calendar_id);
        const rules = getCalendarRules(calendar);

        if (enabled) rules.recordedSeries.add(event.ical_uid);
        else rules.recordedSeries.delete(event.ical_uid);

        // `ical_uid` filters by prefix, so keep exact matches only.
        const occurrences = (
            await listCalendarEvents({
                calendar_id: calendar.id,
                ical_uid: event.ical_uid,
                is_deleted: false,
                start_time__gte: new Date().toISOString(),
            })
        ).filter((occurrence) => occurrence.ical_uid === event.ical_uid);

        // Turning a series on should record every occurrence, including ones skipped before.
        if (enabled) occurrences.forEach((occurrence) => rules.skippedEvents.delete(occurrence.id));

        const updated = await saveCalendarRules(calendar, rules);
        const summary = await reconcileEvents(occurrences, updated, rules);

        console.log(`Series recording ${enabled ? "on" : "off"}: calendar_id=${calendar.id} ${formatReconcileSummary(summary)}`);
        revalidatePath("/");
        return { summary };
    } catch (error) {
        console.error(`Failed to update series recording for calendar_event_id=${eventId}:`, error instanceof Error ? error.message : error);
        return { error: "Couldn't update this series. Try again." };
    }
}
