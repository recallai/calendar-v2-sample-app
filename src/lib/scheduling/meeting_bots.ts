import { bot_decision_create, event_override_delete, event_override_set } from "@/db/queries";
import {
    calendar_event_retrieve,
    calendar_retrieve,
    get_event_title,
    get_upcoming_bot,
    unschedule_bot_for_calendar_event,
} from "@/lib/recall";
import type { CalendarEventType } from "@/schemas/CalendarEventArtifactSchema";
import type { BotSettingsType } from "@/schemas/CalendarSettingsSchema";
import { schedule_bot } from "./bot_config";
import { get_bot_decision, load_scheduling_context } from "./decision";
import { UserFacingError } from "./errors";
import { sync_event_bot } from "./sync";

/**
 * Per-meeting choices made by hand. They're stored as overrides, which beat the calendar's schedule mode.
 */

function decision_log_fields(calendar_event: CalendarEventType) {
    return {
        calendar_id: calendar_event.calendar_id,
        calendar_event_id: calendar_event.id,
        event_title: get_event_title(calendar_event),
        event_start_time: calendar_event.start_time,
        trigger: "user" as const,
    };
}

/**
 * Add a bot to a meeting, or update the existing bot's settings. Scheduling again replaces the previous
 * bot config, so the same call handles both. The meeting gets an "always" override, so the calendar's
 * schedule mode won't remove it.
 * https://docs.recall.ai/reference/calendar_events_bot_create
 */
export async function add_or_update_meeting_bot(args: {
    calendar_event_id: string,
    bot_settings: BotSettingsType,
}): Promise<void> {
    const { calendar_event_id, bot_settings } = args;

    // Re-fetch so the bot is scheduled against the event's latest start time and meeting link.
    const calendar_event = await calendar_event_retrieve({ calendar_event_id });
    if (calendar_event.is_deleted) throw new UserFacingError("This meeting was removed from the calendar.");
    if (!calendar_event.meeting_url) throw new UserFacingError("This meeting doesn't have a meeting link.");
    if (new Date(calendar_event.start_time) <= new Date()) throw new UserFacingError("This meeting has already started.");

    const had_bot = !!get_upcoming_bot(calendar_event);
    await schedule_bot({ calendar_event, bot_settings, source: "manual" });
    await event_override_set({ calendar_event_id, calendar_id: calendar_event.calendar_id, action: "always" });
    await bot_decision_create({
        ...decision_log_fields(calendar_event),
        action: had_bot ? "rescheduled" : "scheduled",
        reason: had_bot ? "You changed this meeting's bot settings." : "You added a bot to this meeting by hand.",
    });
    console.log(`Bot saved for calendar_event_id=${calendar_event_id}`);
}

/**
 * Remove the bot from a meeting and give it a "never" override, so the schedule mode doesn't add it back. If the bot
 * is shared with other calendars' copies of the meeting (deduplication), it still joins for them.
 * https://docs.recall.ai/reference/calendar_events_bot_destroy
 */
export async function remove_meeting_bot(args: { calendar_event_id: string }): Promise<void> {
    const { calendar_event_id } = args;

    const calendar_event = await calendar_event_retrieve({ calendar_event_id });
    if (get_upcoming_bot(calendar_event)) {
        await unschedule_bot_for_calendar_event({ calendar_event_id });
        await bot_decision_create({
            ...decision_log_fields(calendar_event),
            action: "removed",
            reason: "You removed the bot from this meeting.",
        });
    }
    await event_override_set({ calendar_event_id, calendar_id: calendar_event.calendar_id, action: "never" });
    console.log(`Bot removed from calendar_event_id=${calendar_event_id}`);
}

/**
 * Drop a meeting's "always" / "never" override so the calendar's schedule mode decides again.
 */
export async function clear_meeting_override(args: { calendar_event_id: string }): Promise<void> {
    const { calendar_event_id } = args;

    const calendar_event = await calendar_event_retrieve({ calendar_event_id });
    await event_override_delete({ calendar_event_id });
    const calendar = await calendar_retrieve({ calendar_id: calendar_event.calendar_id });
    const context = await load_scheduling_context({ calendar });
    const decision = get_bot_decision({ calendar_event, context });

    // The bot here was added by hand, which the schedule mode normally leaves alone. The user asked for
    // the calendar's setting to decide, so remove it if that setting doesn't want a bot.
    if (!decision.wants_bot && get_upcoming_bot(calendar_event) && new Date(calendar_event.start_time) > new Date()) {
        await unschedule_bot_for_calendar_event({ calendar_event_id });
        await bot_decision_create({
            ...decision_log_fields(calendar_event),
            action: "removed",
            reason: `Switched back to the calendar's setting. ${decision.reason}`,
        });
        return;
    }
    await sync_event_bot({ calendar_event, context, trigger: "user" });
}
