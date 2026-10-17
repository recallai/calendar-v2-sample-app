import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bot_decisions, calendar_settings, event_overrides } from "@/db/schema";
import type { MeetingOverride } from "@/lib/scheduling/decision";
import { DEFAULT_CALENDAR_SETTINGS } from "@/lib/settings";
import type { CalendarSettingsType } from "@/schemas/CalendarSettingsSchema";

/* -------------------------------------------------------------------------- */
/*                              Calendar settings                             */
/* -------------------------------------------------------------------------- */

/**
 * The settings for each of the given calendars. A calendar the user hasn't saved settings for gets the
 * defaults.
 */
export async function calendar_settings_list(args: { calendar_ids: string[] }): Promise<Map<string, CalendarSettingsType>> {
    const { calendar_ids } = args;
    const rows = calendar_ids.length === 0
        ? []
        : await db.select().from(calendar_settings).where(inArray(calendar_settings.calendar_id, calendar_ids));

    const saved_settings = new Map(rows.map((row): [string, CalendarSettingsType] => [
        row.calendar_id,
        {
            scheduleMode: row.schedule_mode,
            botSettings: {
                botName: row.bot_name,
                joinMinutesEarly: row.join_minutes_early,
                chatMessage: row.chat_message,
                waitingRoomTimeout: row.waiting_room_timeout,
                nooneJoinedTimeout: row.noone_joined_timeout,
                everyoneLeftTimeout: row.everyone_left_timeout,
            },
        },
    ]));
    return new Map(calendar_ids.map((calendar_id) => [calendar_id, saved_settings.get(calendar_id) ?? DEFAULT_CALENDAR_SETTINGS]));
}

export async function calendar_settings_save(args: { calendar_id: string, settings: CalendarSettingsType }): Promise<void> {
    const { calendar_id, settings } = args;
    const { botSettings: bot_settings } = settings;
    const values = {
        schedule_mode: settings.scheduleMode,
        bot_name: bot_settings.botName,
        join_minutes_early: bot_settings.joinMinutesEarly,
        chat_message: bot_settings.chatMessage,
        waiting_room_timeout: bot_settings.waitingRoomTimeout,
        noone_joined_timeout: bot_settings.nooneJoinedTimeout,
        everyone_left_timeout: bot_settings.everyoneLeftTimeout,
    };
    await db
        .insert(calendar_settings)
        .values({ calendar_id, ...values })
        .onConflictDoUpdate({ target: calendar_settings.calendar_id, set: values });
}

/**
 * Forget a deleted calendar's settings and overrides. Decision history is kept.
 */
export async function calendar_settings_delete(args: { calendar_id: string }): Promise<void> {
    const { calendar_id } = args;
    await db.delete(event_overrides).where(eq(event_overrides.calendar_id, calendar_id));
    await db.delete(calendar_settings).where(eq(calendar_settings.calendar_id, calendar_id));
}

/* -------------------------------------------------------------------------- */
/*                               Event overrides                              */
/* -------------------------------------------------------------------------- */

export async function event_overrides_list(args: { calendar_ids: string[] }) {
    const { calendar_ids } = args;
    if (calendar_ids.length === 0) return [];
    return await db.select().from(event_overrides).where(inArray(event_overrides.calendar_id, calendar_ids));
}

export async function event_override_set(args: { calendar_event_id: string, calendar_id: string, action: MeetingOverride }) {
    const { calendar_event_id, calendar_id, action } = args;
    await db
        .insert(event_overrides)
        .values({ calendar_event_id, calendar_id, action })
        .onConflictDoUpdate({ target: event_overrides.calendar_event_id, set: { action, created_at: new Date() } });
}

export async function event_override_delete(args: { calendar_event_id: string }) {
    const { calendar_event_id } = args;
    await db.delete(event_overrides).where(eq(event_overrides.calendar_event_id, calendar_event_id));
}

/* -------------------------------------------------------------------------- */
/*                                Bot decisions                               */
/* -------------------------------------------------------------------------- */

export async function bot_decision_create(args: typeof bot_decisions.$inferInsert) {
    await db.insert(bot_decisions).values(args);
}

export async function bot_decisions_list(args: { limit: number }) {
    const { limit } = args;
    return await db.select().from(bot_decisions).orderBy(desc(bot_decisions.created_at), desc(bot_decisions.id)).limit(limit);
}
