import { bot_retrieve, calendar_events_list, get_calendar_label, get_event_title, get_upcoming_bot } from "@/lib/recall";
import type { BotSettingsType } from "@/schemas/CalendarSettingsSchema";
import { read_bot_settings, read_bot_source, type BotSource } from "./bot_config";
import { get_bot_decision, type MeetingOverride, type SchedulingContext } from "./decision";

/** An event as the week calendar shows it. */
export type UpcomingEvent = {
    id: string,
    title: string,
    start_time: string,
    end_time: string,
    meeting_url: string | null,
    meeting_platform: string | null,
    calendar_id: string,
    calendar_label: string,
    /** Settings of the bot scheduled for this meeting, or null if it has no bot. */
    bot: BotSettingsType | null,
    /** The meeting's calendar's bot settings, where a bot added by hand starts from. */
    calendar_bot_settings: BotSettingsType,
    /** Whether the bot was added by the calendar's schedule mode or by hand. */
    bot_source: BotSource | null,
    /** Why this meeting does or doesn't get a bot, e.g. "This calendar sends bots: Every meeting." */
    decision_reason: string,
    /** A per-meeting "always" / "never" choice that beats the calendar's schedule mode. */
    override: MeetingOverride | null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Events from a day before now through `days + 1` days ahead across the given calendars (loaded with
 * load_scheduling_contexts), soonest first.
 * The extra day on each side lets the browser pick the days to show in its own timezone.
 * Only connected calendars are queried, and events removed from the calendar are excluded. Recall
 * doesn't return all-day events, since bots don't join them.
 * https://docs.recall.ai/reference/calendar_events_list
 */
export async function upcoming_events_list(args: {
    contexts: Map<string, SchedulingContext>,
    days: number,
}): Promise<UpcomingEvent[]> {
    const { contexts, days } = args;
    const now = new Date();
    const from = new Date(now.getTime() - DAY_MS);
    const until = new Date(now.getTime() + (days + 1) * DAY_MS);

    const connected_contexts = [...contexts.values()].filter(({ calendar }) => calendar.status === "connected");

    const events_per_calendar = await Promise.all(connected_contexts.map(async (context) => {
        const calendar_events = await calendar_events_list({
            calendar_id: context.calendar.id,
            is_deleted: false,
            start_time__gte: from.toISOString(),
            start_time__lte: until.toISOString(),
        });
        return calendar_events.map((calendar_event) => ({ calendar_event, context }));
    }));

    const upcoming_events = await Promise.all(events_per_calendar.flat().map(async ({ calendar_event, context }): Promise<UpcomingEvent> => {
        // A calendar event only lists its bots' IDs. The settings shown in the UI (name, timeouts) are on
        // the bot itself, so this is one Retrieve Bot request per meeting with a bot. That's fine for a
        // week of meetings; with many more, store the settings you need when you schedule the bot instead.
        const scheduled_bot = get_upcoming_bot(calendar_event, now);
        const bot = scheduled_bot ? await bot_retrieve({ bot_id: scheduled_bot.bot_id }) : null;

        return {
            id: calendar_event.id,
            title: get_event_title(calendar_event),
            start_time: calendar_event.start_time,
            end_time: calendar_event.end_time,
            meeting_url: calendar_event.meeting_url,
            meeting_platform: calendar_event.meeting_platform,
            calendar_id: calendar_event.calendar_id,
            calendar_label: get_calendar_label(context.calendar),
            bot: bot ? read_bot_settings(bot) : null,
            calendar_bot_settings: context.settings.botSettings,
            bot_source: bot ? read_bot_source(bot) : null,
            decision_reason: get_bot_decision({ calendar_event, context }).reason,
            override: context.overrides.get(calendar_event.id) ?? null,
        };
    }));

    return upcoming_events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}
