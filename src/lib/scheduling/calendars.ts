import { calendar_settings_delete, calendar_settings_list, calendar_settings_save } from "@/db/queries";
import { calendar_delete, calendar_retrieve } from "@/lib/recall";
import type { CalendarSettingsType } from "@/schemas/CalendarSettingsSchema";
import { UserFacingError } from "./errors";
import { format_sync_summary, sync_upcoming_events, type SyncSummary } from "./sync";

/**
 * Save a calendar's schedule mode and bot settings.
 * - Bots sent by a new mode use the new bot settings. Bots already scheduled keep their settings; those
 *   are edited per meeting.
 * - If the mode changed, it's applied to the calendar's upcoming meetings straight away. After that, the
 *   calendar.sync_events webhook applies it as meetings change. Bots added by hand are kept whatever the mode.
 *
 * Returns what applying the mode changed, or null if the mode didn't change.
 */
export async function update_calendar_settings(args: {
    calendar_id: string,
    settings: CalendarSettingsType,
}): Promise<SyncSummary | null> {
    const { calendar_id, settings } = args;

    const calendar = await calendar_retrieve({ calendar_id });
    if (calendar.status !== "connected") throw new UserFacingError("This calendar isn't connected.");

    const current_settings = (await calendar_settings_list({ calendar_ids: [calendar_id] })).get(calendar_id)!;
    await calendar_settings_save({ calendar_id, settings });

    if (current_settings.scheduleMode === settings.scheduleMode) {
        console.log(`Calendar settings saved: calendar_id=${calendar_id}`);
        return null;
    }

    const summary = await sync_upcoming_events({ calendar });
    console.log(`Schedule mode set: calendar_id=${calendar_id} mode=${settings.scheduleMode} ${format_sync_summary(summary)}`);
    return summary;
}

/**
 * Delete a calendar in Recall.ai and forget its settings and overrides. Recall immediately unschedules
 * bots for its future meetings. Decision history is kept.
 * https://docs.recall.ai/docs/scheduling-guide#disconnectingdeleting-a-calendar
 */
export async function delete_calendar_and_settings(args: { calendar_id: string }): Promise<void> {
    const { calendar_id } = args;
    await calendar_delete({ calendar_id });
    await calendar_settings_delete({ calendar_id });
    console.log(`Calendar deleted: calendar_id=${calendar_id}`);
}
