import { updateCalendarBotSettings, updateCalendarScheduleMode, upsertCalendar } from "@/db/queries";
import type { BotSettings } from "@/lib/bot-settings";
import type { ScheduleMode } from "@/lib/schedule-modes";
import {
    applyScheduleToUpcomingEvents,
    formatReconcileSummary,
    getCalendar,
    getCalendarBotSettings,
    type ReconcileSummary,
} from "@/lib/recall";
import { ServiceError } from "./errors";

export type CalendarSettings = { scheduleMode: ScheduleMode; botSettings: BotSettings };

/**
 * Save a calendar's schedule mode and bot settings.
 * - Bot settings are saved first, so bots sent by a new mode use them. Bots already scheduled keep
 *   their settings; those are edited per meeting.
 * - If the mode changed, it's applied to the calendar's upcoming meetings straight away. After that, the
 *   calendar.sync_events webhook applies it as meetings change. Bots added by hand are kept whatever the mode.
 *
 * Returns what applying the mode changed, or null if the mode didn't change.
 */
export async function updateCalendarSettings(calendarId: string, settings: CalendarSettings): Promise<ReconcileSummary | null> {
    const calendar = await getCalendar(calendarId);
    if (calendar.status !== "connected") throw new ServiceError("This calendar isn't connected.");

    const current = await upsertCalendar(calendar);
    const botSettingsChanged = JSON.stringify(getCalendarBotSettings(current)) !== JSON.stringify(settings.botSettings);
    if (botSettingsChanged) {
        await updateCalendarBotSettings(calendarId, settings.botSettings);
    }

    if (current.scheduleMode === settings.scheduleMode) {
        console.log(`Calendar settings saved: calendar_id=${calendarId} bot_settings_changed=${botSettingsChanged}`);
        return null;
    }

    await updateCalendarScheduleMode(calendarId, settings.scheduleMode);
    const summary = await applyScheduleToUpcomingEvents(calendar, "rules_changed");
    console.log(`Schedule mode set: calendar_id=${calendarId} mode=${settings.scheduleMode} ${formatReconcileSummary(summary)}`);
    return summary;
}
