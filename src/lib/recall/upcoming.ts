import type { BotSettings } from "../bot-settings";
import type { BotSource } from "../recording-rules";
import { getBot, getBotSettings, getBotSource, getUpcomingBot } from "./bot";
import { getCalendarEventTitle, listCalendarEvents, type Calendar, type CalendarEvent } from "./calendar";
import { getCalendarRules, getRecordingDecision, isRecurringEvent } from "./rules";

export type UpcomingEvent = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    /** All-day events are shown in their own row. `allDayStart`/`allDayEnd` are YYYY-MM-DD, end exclusive. */
    isAllDay: boolean;
    allDayStart: string | null;
    allDayEnd: string | null;
    meeting_url: string | null;
    meeting_platform: string | null;
    calendarId: string;
    calendarLabel: string;
    /** Settings of the bot scheduled for this meeting, or null if it has no bot. */
    bot: BotSettings | null;
    /** Whether the bot was added by the calendar's rule, by an always-recorded series, or by hand. */
    botSource: BotSource | null;
    /** Why the calendar's rules do or don't want a bot on this meeting. */
    ruleReason: string;
    isRecurring: boolean;
    /** This meeting's recurring series is set to always record. */
    seriesRecorded: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * All-day events from the provider's raw data: Google uses `start.date` instead of `start.dateTime`,
 * Outlook sets `isAllDay`. https://docs.recall.ai/docs/calendar-event-platform-data
 */
function getAllDayRange(event: CalendarEvent): { start: string; end: string } | null {
    const raw = (event.raw ?? {}) as {
        start?: { date?: string; dateTime?: string };
        end?: { date?: string; dateTime?: string };
        isAllDay?: boolean;
    };
    if (raw.start?.date && raw.end?.date) {
        return { start: raw.start.date, end: raw.end.date };
    }
    if (raw.isAllDay && raw.start?.dateTime && raw.end?.dateTime) {
        return { start: raw.start.dateTime.slice(0, 10), end: raw.end.dateTime.slice(0, 10) };
    }
    return null;
}

/**
 * Events from a day before now through `days + 1` days ahead across the given calendars, soonest first.
 * The extra day on each side lets the browser pick the days to show in its own timezone.
 * Only connected calendars are queried, and events removed from the calendar are excluded.
 * https://docs.recall.ai/reference/calendar_events_list
 */
export async function listUpcomingEvents(calendars: Calendar[], days = 7): Promise<UpcomingEvent[]> {
    const now = new Date();
    const from = new Date(now.getTime() - DAY_MS);
    const until = new Date(now.getTime() + (days + 1) * DAY_MS);

    const perCalendar = await Promise.all(
        calendars
            .filter((calendar) => calendar.status === "connected")
            .map(async (calendar) => {
                const events = await listCalendarEvents({
                    calendar_id: calendar.id,
                    is_deleted: false,
                    start_time__gte: from.toISOString(),
                    start_time__lte: until.toISOString(),
                });
                return events.map((event) => ({
                    event,
                    calendar,
                    calendarLabel: calendar.platform_email ?? calendar.oauth_email ?? calendar.id,
                }));
            }),
    );

    const upcoming = await Promise.all(
        perCalendar.flat().map(async ({ event, calendar, calendarLabel }): Promise<UpcomingEvent> => {
            const scheduledBot = getUpcomingBot(event, now);
            const bot = scheduledBot ? await getBot(scheduledBot.bot_id) : null;
            const rules = getCalendarRules(calendar);
            const allDay = getAllDayRange(event);
            return {
                id: event.id,
                title: getCalendarEventTitle(event),
                start_time: event.start_time,
                end_time: event.end_time,
                isAllDay: !!allDay,
                allDayStart: allDay?.start ?? null,
                allDayEnd: allDay?.end ?? null,
                meeting_url: event.meeting_url,
                meeting_platform: event.meeting_platform,
                calendarId: event.calendar_id,
                calendarLabel,
                bot: bot ? getBotSettings(bot) : null,
                botSource: bot ? getBotSource(bot) : null,
                ruleReason: getRecordingDecision(event, calendar, rules).reason,
                isRecurring: isRecurringEvent(event),
                seriesRecorded: rules.recordedSeries.has(event.ical_uid),
            };
        }),
    );

    return upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}
