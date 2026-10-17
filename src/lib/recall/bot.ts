import { z } from "zod";
import { BotSchema } from "../../schemas/BotArtifactSchema";
import type { CalendarEventBotType, CalendarEventType } from "../../schemas/CalendarEventArtifactSchema";
import { recall_fetch } from "./client";

/**
 * Bots scheduled for calendar events.
 * See: https://docs.recall.ai/docs/scheduling-guide
 */

/**
 * Retrieve a bot from Recall.
 * https://docs.recall.ai/reference/bot_retrieve
 */
export async function bot_retrieve(args: { bot_id: string }) {
    const { bot_id } = z.object({ bot_id: z.string() }).parse(args);

    return BotSchema.parse(await recall_fetch({ path: `/api/v1/bot/${bot_id}/` }));
}

/**
 * Generate the deduplication key for a calendar event's bot.
 * Deduplicate at meeting level: one bot for the entire meeting, across every connected calendar in the
 * workspace. Keep this consistent for all events; changing schemes later can cause unexpected scheduling.
 */
export function generate_bot_deduplication_key(args: { meeting_url: string | null, start_time: string }) {
    const { meeting_url, start_time } = args;
    return { deduplication_key: `${start_time}-${meeting_url}` };
}

/**
 * The bot scheduled for an event's current occurrence, if any. Perpetual events can also list bots
 * for past occurrences, so only bots for meetings that haven't started yet count.
 */
export function get_upcoming_bot(calendar_event: CalendarEventType, now = new Date()): CalendarEventBotType | undefined {
    return calendar_event.bots
        .filter((bot) => new Date(bot.start_time) > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
}

/**
 * Whether a scheduled bot still matches its event. Recall doesn't move a bot when its event moves,
 * so a changed start time or meeting link means the bot has to be scheduled again.
 * A bot's start_time is the event start it was scheduled for; compare as instants since the two
 * timestamps may be formatted differently.
 */
export function is_bot_in_sync(bot: CalendarEventBotType, calendar_event: CalendarEventType): boolean {
    return (
        new Date(bot.start_time).getTime() === new Date(calendar_event.start_time).getTime()
        && bot.meeting_url === calendar_event.meeting_url
    );
}
