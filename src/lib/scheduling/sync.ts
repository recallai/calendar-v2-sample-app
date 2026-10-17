import { bot_decision_create } from "@/db/queries";
import {
    bot_retrieve,
    calendar_events_list,
    get_event_title,
    get_upcoming_bot,
    is_bot_in_sync,
    unschedule_bot_for_calendar_event,
} from "@/lib/recall";
import type { CalendarType } from "@/schemas/CalendarArtifactSchema";
import type { CalendarEventType } from "@/schemas/CalendarEventArtifactSchema";
import { read_bot_settings, read_bot_source, schedule_bot } from "./bot_config";
import { get_bot_decision, load_scheduling_context, type SchedulingContext } from "./decision";

/**
 * Syncing an event's bot: making Recall's scheduled bot match what the app decided for the event.
 * This runs for every event a calendar.sync_events webhook reports, and for all upcoming events when a
 * calendar's schedule mode changes.
 * https://docs.recall.ai/docs/scheduling-guide
 */

export type SyncResult = "scheduled" | "rescheduled" | "removed" | "unchanged";
export type SyncSummary = Record<SyncResult | "failed", number>;
/** What started a sync. Logged with each change. */
export type SyncTrigger = "webhook" | "schedule_mode_changed" | "user";

/**
 * Make an event's bot match the app's decision and the event's latest time and meeting link, and log
 * any change.
 * - Add a bot when the decision says to and there isn't one.
 * - Remove a bot when the decision says not to. Bots added by hand are only removed by a "never" override
 *   (or losing the meeting link), so changing the schedule mode never takes away a bot the user added.
 * - Move a bot whose meeting moved, keeping its settings.
 * Deleted or already-started events are left alone; Recall unschedules bots for deleted events itself.
 */
export async function sync_event_bot(args: {
    calendar_event: CalendarEventType,
    context: SchedulingContext,
    trigger: SyncTrigger,
}): Promise<SyncResult> {
    const { calendar_event, context, trigger } = args;
    const now = new Date();
    if (calendar_event.is_deleted || new Date(calendar_event.start_time) <= now) {
        return "unchanged";
    }

    const decision = get_bot_decision({ calendar_event, context });
    const scheduled_bot = get_upcoming_bot(calendar_event, now);
    const log = async (action: Exclude<SyncResult, "unchanged">, reason = decision.reason) => {
        await bot_decision_create({
            calendar_id: context.calendar.id,
            calendar_event_id: calendar_event.id,
            event_title: get_event_title(calendar_event),
            event_start_time: calendar_event.start_time,
            action,
            reason,
            trigger,
        });
    };

    // No bot yet: add one if the decision wants it.
    if (!scheduled_bot) {
        if (!decision.wants_bot) return "unchanged";
        const source = decision.decided_by === "override" ? "manual" : "schedule_mode";
        await schedule_bot({ calendar_event, bot_settings: context.settings.botSettings, source });
        await log("scheduled");
        return "scheduled";
    }

    // A bot the schedule mode added is removed when the decision no longer wants it. A bot added by hand
    // is only removed by a "never" override or a lost meeting link.
    const bot = await bot_retrieve({ bot_id: scheduled_bot.bot_id });
    const source = read_bot_source(bot);
    if (!decision.wants_bot && (decision.decided_by !== "schedule_mode" || source === "schedule_mode")) {
        await unschedule_bot_for_calendar_event({ calendar_event_id: calendar_event.id });
        await log("removed");
        return "removed";
    }

    // The meeting moved: schedule the bot again for its new time or link, keeping its settings.
    if (!is_bot_in_sync(scheduled_bot, calendar_event)) {
        await schedule_bot({ calendar_event, bot_settings: read_bot_settings(bot), source });
        await log("rescheduled", "The meeting moved, so its bot was moved too.");
        return "rescheduled";
    }
    return "unchanged";
}

/**
 * Sync events one at a time, soonest first: the scheduling guide recommends chronological order,
 * and sequential requests avoid 409s from parallel changes to the same bot.
 */
export async function sync_event_bots(args: {
    calendar_events: CalendarEventType[],
    context: SchedulingContext,
    trigger: SyncTrigger,
}): Promise<SyncSummary> {
    const { calendar_events, context, trigger } = args;
    const summary: SyncSummary = { scheduled: 0, rescheduled: 0, removed: 0, unchanged: 0, failed: 0 };

    const sorted_events = [...calendar_events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    for (const calendar_event of sorted_events) {
        try {
            summary[await sync_event_bot({ calendar_event, context, trigger })]++;
        } catch (error) {
            summary.failed++;
            console.error(`Failed to sync calendar_event_id=${calendar_event.id}:`, error instanceof Error ? error.message : error);
        }
    }
    return summary;
}

/**
 * Sync every upcoming event on a calendar, e.g. right after its schedule mode changes.
 * Recall keeps events for the next 28 days, which is as far ahead as bots need scheduling.
 */
export async function sync_upcoming_events(args: { calendar: CalendarType }): Promise<SyncSummary> {
    const { calendar } = args;
    const [context, calendar_events] = await Promise.all([
        load_scheduling_context({ calendar }),
        calendar_events_list({ calendar_id: calendar.id, is_deleted: false, start_time__gte: new Date().toISOString() }),
    ]);
    return await sync_event_bots({ calendar_events, context, trigger: "schedule_mode_changed" });
}

export function format_sync_summary(summary: SyncSummary): string {
    return Object.entries(summary)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
}
