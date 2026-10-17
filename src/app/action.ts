"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
    add_or_update_meeting_bot,
    clear_meeting_override,
    delete_calendar_and_settings,
    remove_meeting_bot,
    update_calendar_settings,
    UserFacingError,
    type SyncSummary,
} from "@/lib/scheduling";
import { BotSettingsSchema, CalendarSettingsSchema, type BotSettingsType, type CalendarSettingsType } from "@/schemas/CalendarSettingsSchema";

/**
 * Server actions called from the UI. Each one validates its input, calls a function in
 * `@/lib/scheduling`, and refreshes the page.
 */

export type ActionResult = { error?: string };

/**
 * Turn a failure into a message for the UI. A UserFacingError's message is shown as is; anything else is
 * logged and replaced with `fallback`.
 */
function to_action_error(error: unknown, fallback: string): ActionResult {
    if (error instanceof UserFacingError) return { error: error.message };
    console.error(fallback, error instanceof Error ? error.message : error);
    return { error: fallback };
}

/* -------------------------------------------------------------------------- */
/*                                  Calendars                                 */
/* -------------------------------------------------------------------------- */

/**
 * Delete a calendar, along with its settings and overrides.
 */
export async function remove_calendar(calendar_id: string): Promise<ActionResult> {
    const input = z.object({ calendar_id: z.string().min(1) }).safeParse({ calendar_id });
    if (!input.success) return { error: input.error.issues[0].message };

    try {
        await delete_calendar_and_settings(input.data);
    } catch (error) {
        return to_action_error(error, "Couldn't delete calendar. Try again.");
    }
    revalidatePath("/");
    return {};
}

/**
 * Save which of a calendar's meetings automatically get a bot, and what those bots are like. A changed
 * schedule mode is applied to upcoming meetings right away, and `summary` says what that changed.
 */
export async function save_calendar_settings(
    calendar_id: string,
    settings: CalendarSettingsType,
): Promise<ActionResult & { summary?: SyncSummary }> {
    const input = z.object({ calendar_id: z.string().min(1), settings: CalendarSettingsSchema }).safeParse({ calendar_id, settings });
    if (!input.success) return { error: input.error.issues[0].message };

    let summary: SyncSummary | null;
    try {
        summary = await update_calendar_settings(input.data);
    } catch (error) {
        return to_action_error(error, "Couldn't save this calendar's settings. Try again.");
    }
    revalidatePath("/");
    return summary ? { summary } : {};
}

/* -------------------------------------------------------------------------- */
/*                                  Meetings                                  */
/* -------------------------------------------------------------------------- */

/**
 * Add a bot to a meeting, or change its settings.
 */
export async function save_meeting_bot(calendar_event_id: string, bot_settings: BotSettingsType): Promise<ActionResult> {
    const input = z.object({ calendar_event_id: z.string().min(1), bot_settings: BotSettingsSchema }).safeParse({ calendar_event_id, bot_settings });
    if (!input.success) return { error: input.error.issues[0].message };

    try {
        await add_or_update_meeting_bot(input.data);
    } catch (error) {
        return to_action_error(error, "Couldn't schedule the bot. Try again.");
    }
    revalidatePath("/");
    return {};
}

/**
 * Remove a meeting's bot and skip the meeting from now on.
 */
export async function remove_meeting_bot_action(calendar_event_id: string): Promise<ActionResult> {
    const input = z.object({ calendar_event_id: z.string().min(1) }).safeParse({ calendar_event_id });
    if (!input.success) return { error: input.error.issues[0].message };

    try {
        await remove_meeting_bot(input.data);
    } catch (error) {
        return to_action_error(error, "Couldn't remove the bot. Try again.");
    }
    revalidatePath("/");
    return {};
}

/**
 * Drop a meeting's override so the calendar's schedule mode decides again.
 */
export async function follow_schedule_mode(calendar_event_id: string): Promise<ActionResult> {
    const input = z.object({ calendar_event_id: z.string().min(1) }).safeParse({ calendar_event_id });
    if (!input.success) return { error: input.error.issues[0].message };

    try {
        await clear_meeting_override(input.data);
    } catch (error) {
        return to_action_error(error, "Couldn't apply the calendar's setting. Try again.");
    }
    revalidatePath("/");
    return {};
}
