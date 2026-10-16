"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BotSettingsSchema, type BotSettings } from "@/lib/bot-settings";
import type { ReconcileSummary } from "@/lib/recall";
import { ScheduleModeSchema } from "@/lib/schedule-modes";
import {
    addOrUpdateMeetingBot,
    deleteCalendarAndState,
    removeMeetingBot,
    resetMeetingToRules,
    ServiceError,
    updateCalendarSettings,
    type CalendarSettings,
} from "@/lib/services";

/**
 * Server actions called from the UI. Each one only validates its input and calls a service in
 * `@/lib/services`, which holds the business logic.
 */

export type ActionResult = { error?: string };
/** `summary` is set when the schedule mode changed and was applied to upcoming meetings. */
export type CalendarSettingsResult = ActionResult & { summary?: ReconcileSummary };
export type RemoveCalendarResult = ActionResult;

const IdSchema = z.string().min(1);
const CalendarSettingsSchema = z.object({ scheduleMode: ScheduleModeSchema, botSettings: BotSettingsSchema });

/**
 * Validate an action's inputs. Returns the parsed values, or the first validation message.
 */
function validate<T extends z.ZodTypeAny[]>(
    ...pairs: { [K in keyof T]: [T[K], unknown] }
): { data: { [K in keyof T]: z.output<T[K]> } } | { error: string } {
    const data = [];
    for (const [schema, value] of pairs) {
        const result = schema.safeParse(value);
        if (!result.success) return { error: result.error.issues[0]?.message ?? "Invalid input" };
        data.push(result.data);
    }
    return { data: data as { [K in keyof T]: z.output<T[K]> } };
}

/**
 * Run a service, refresh the page, and turn failures into a message for the UI. A ServiceError's
 * message is shown as-is; anything else is logged and replaced with `failureMessage`.
 */
async function run<T extends object>(failureMessage: string, task: () => Promise<T>): Promise<T | { error: string }> {
    try {
        const result = await task();
        revalidatePath("/");
        return result;
    } catch (error) {
        if (error instanceof ServiceError) return { error: error.message };
        console.error(failureMessage, error instanceof Error ? error.message : error);
        return { error: failureMessage };
    }
}

/* -------------------------------------------------------------------------- */
/*                                  Calendars                                 */
/* -------------------------------------------------------------------------- */

export async function removeCalendar(id: string): Promise<RemoveCalendarResult> {
    const input = validate([IdSchema, id]);
    if ("error" in input) return input;
    return run("Couldn't delete calendar. Try again.", async () => {
        await deleteCalendarAndState(input.data[0]);
        return {};
    });
}

/**
 * Save which of a calendar's meetings automatically get a bot, and what those bots are like. A changed
 * schedule mode is applied to upcoming meetings right away.
 */
export async function saveCalendarSettings(calendarId: string, settings: CalendarSettings): Promise<CalendarSettingsResult> {
    const input = validate([IdSchema, calendarId], [CalendarSettingsSchema, settings]);
    if ("error" in input) return input;
    return run("Couldn't save this calendar's settings. Try again.", async () => {
        const summary = await updateCalendarSettings(...input.data);
        return summary ? { summary } : {};
    });
}

/* -------------------------------------------------------------------------- */
/*                             Per-meeting overrides                          */
/* -------------------------------------------------------------------------- */

export async function saveBotForEvent(eventId: string, settings: BotSettings): Promise<ActionResult> {
    const input = validate([IdSchema, eventId], [BotSettingsSchema, settings]);
    if ("error" in input) return input;
    return run("Couldn't schedule the bot. Try again.", async () => {
        await addOrUpdateMeetingBot(...input.data);
        return {};
    });
}

export async function removeBotFromEvent(eventId: string): Promise<ActionResult> {
    const input = validate([IdSchema, eventId]);
    if ("error" in input) return input;
    return run("Couldn't remove the bot. Try again.", async () => {
        await removeMeetingBot(input.data[0]);
        return {};
    });
}

export async function resetToCalendarSetting(eventId: string): Promise<ActionResult> {
    const input = validate([IdSchema, eventId]);
    if ("error" in input) return input;
    return run("Couldn't apply the calendar's setting. Try again.", async () => {
        await resetMeetingToRules(input.data[0]);
        return {};
    });
}
