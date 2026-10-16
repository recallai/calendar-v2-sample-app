import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { botDecisions, calendars, eventOverrides, webhookEvents, type CalendarRow } from "@/db/schema";
import type { BotSettings } from "@/lib/bot-settings";
import type { MeetingOverride, ScheduleMode } from "@/lib/schedule-modes";
import type { Calendar } from "@/lib/recall/calendar";

/* -------------------------------------------------------------------------- */
/*                                  Calendars                                 */
/* -------------------------------------------------------------------------- */

/**
 * Keep the local copy of a Recall calendar up to date. App settings (bot defaults) are left untouched.
 */
export async function upsertCalendar(calendar: Calendar): Promise<CalendarRow> {
    const values = {
        id: calendar.id,
        platform: calendar.platform,
        email: calendar.platform_email ?? calendar.oauth_email ?? null,
        status: calendar.status,
    };
    const [row] = await db
        .insert(calendars)
        .values(values)
        .onConflictDoUpdate({ target: calendars.id, set: { platform: values.platform, email: values.email, status: values.status } })
        .returning();
    return row;
}

export async function upsertCalendars(recallCalendars: Calendar[]): Promise<CalendarRow[]> {
    return Promise.all(recallCalendars.map(upsertCalendar));
}

/** Forget a deleted calendar along with its overrides. Decision history is kept. */
export async function deleteCalendarRow(calendarId: string): Promise<void> {
    await db.delete(eventOverrides).where(eq(eventOverrides.calendarId, calendarId));
    await db.delete(calendars).where(eq(calendars.id, calendarId));
}

export async function updateCalendarBotSettings(calendarId: string, settings: BotSettings): Promise<void> {
    await db
        .update(calendars)
        .set({
            botName: settings.botName,
            joinMinutesEarly: settings.joinMinutesEarly,
            chatMessage: settings.chatMessage,
            waitingRoomTimeout: settings.waitingRoomTimeout,
            nooneJoinedTimeout: settings.nooneJoinedTimeout,
            everyoneLeftTimeout: settings.everyoneLeftTimeout,
        })
        .where(eq(calendars.id, calendarId));
}

export async function updateCalendarScheduleMode(calendarId: string, scheduleMode: ScheduleMode): Promise<void> {
    await db.update(calendars).set({ scheduleMode }).where(eq(calendars.id, calendarId));
}

/* -------------------------------------------------------------------------- */
/*                               Event overrides                              */
/* -------------------------------------------------------------------------- */

export async function listEventOverrides(calendarIds: string[]) {
    if (calendarIds.length === 0) return [];
    return db.select().from(eventOverrides).where(inArray(eventOverrides.calendarId, calendarIds));
}

export async function setEventOverride(calendarEventId: string, calendarId: string, action: MeetingOverride) {
    await db
        .insert(eventOverrides)
        .values({ calendarEventId, calendarId, action })
        .onConflictDoUpdate({ target: eventOverrides.calendarEventId, set: { action, createdAt: new Date() } });
}

export async function clearEventOverride(calendarEventId: string) {
    await db.delete(eventOverrides).where(eq(eventOverrides.calendarEventId, calendarEventId));
}

/* -------------------------------------------------------------------------- */
/*                               Webhook events                               */
/* -------------------------------------------------------------------------- */

/**
 * Record a verified webhook. Returns false if this message ID was already received, meaning Recall
 * redelivered it and it shouldn't be processed again.
 */
export async function recordWebhookEvent(args: {
    id: string;
    event: string;
    calendarId: string | null;
    payload: string;
    status: "received" | "ignored";
}): Promise<boolean> {
    const inserted = await db.insert(webhookEvents).values(args).onConflictDoNothing().returning({ id: webhookEvents.id });
    return inserted.length > 0;
}

export async function finishWebhookEvent(
    id: string,
    result: { status: "processed" | "failed"; summary?: string; error?: string },
) {
    await db
        .update(webhookEvents)
        .set({ status: result.status, summary: result.summary ?? null, error: result.error ?? null, processedAt: new Date() })
        .where(eq(webhookEvents.id, id));
}

export async function listRecentWebhookEvents(limit = 20) {
    return db
        .select({
            id: webhookEvents.id,
            event: webhookEvents.event,
            calendarId: webhookEvents.calendarId,
            status: webhookEvents.status,
            summary: webhookEvents.summary,
            error: webhookEvents.error,
            receivedAt: webhookEvents.receivedAt,
            processedAt: webhookEvents.processedAt,
        })
        .from(webhookEvents)
        .orderBy(desc(webhookEvents.receivedAt))
        .limit(limit);
}

/* -------------------------------------------------------------------------- */
/*                                Bot decisions                               */
/* -------------------------------------------------------------------------- */

export type BotDecisionInput = typeof botDecisions.$inferInsert;

export async function logBotDecision(decision: BotDecisionInput) {
    await db.insert(botDecisions).values(decision);
}

export async function listRecentBotDecisions(limit = 30) {
    return db.select().from(botDecisions).orderBy(desc(botDecisions.createdAt), desc(botDecisions.id)).limit(limit);
}
