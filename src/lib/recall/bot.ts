import { DEFAULT_BOT_SETTINGS, type BotSettings } from "../bot-settings";
import type { BotSource } from "../recording-rules";
import { scheduleBotForCalendarEvent, type CalendarEvent, type CalendarEventBot } from "./calendar";
import { recallFetch } from "./client";

/**
 * Bot scheduling for calendar events.
 * See: https://docs.recall.ai/docs/scheduling-guide
 */

/** The subset of Retrieve Bot fields this app reads. https://docs.recall.ai/reference/bot_retrieve */
export type Bot = {
    id: string;
    bot_name?: string;
    join_at: string;
    chat?: { on_bot_join?: { send_to?: string; message?: string } } | null;
    metadata?: Record<string, string>;
};

/**
 * https://docs.recall.ai/reference/bot_retrieve
 */
export async function getBot(botId: string): Promise<Bot> {
    return recallFetch<Bot>(`/api/v1/bot/${encodeURIComponent(botId)}/`);
}

/**
 * "Deduplicate all": one bot per meeting across every connected calendar in the workspace.
 * Keep this consistent for all events; changing schemes later can cause unexpected scheduling.
 */
export function getDeduplicationKey(event: Pick<CalendarEvent, "start_time" | "meeting_url">): string {
    return `${event.start_time}-${event.meeting_url}`;
}

/**
 * Turn the UI's bot settings into a Create Bot config for this event. The Schedule Bot endpoint
 * doesn't support partial updates, so this is always the complete config.
 * - `join_at` is only set when joining early; otherwise Recall uses the event's start time.
 * - `metadata.join_minutes_early` remembers the offset so it survives the meeting being moved.
 * - `metadata.scheduled_by` records whether a recording rule, a recorded series or the user added the bot.
 * https://docs.recall.ai/reference/bot_create, https://docs.recall.ai/docs/sending-chat-messages
 */
export function buildBotConfig(event: Pick<CalendarEvent, "start_time">, settings: BotSettings, source: BotSource) {
    const joinAt =
        settings.joinMinutesEarly > 0
            ? new Date(new Date(event.start_time).getTime() - settings.joinMinutesEarly * 60_000).toISOString()
            : undefined;

    return {
        bot_name: settings.botName,
        ...(joinAt ? { join_at: joinAt } : {}),
        ...(settings.chatMessage ? { chat: { on_bot_join: { send_to: "everyone", message: settings.chatMessage } } } : {}),
        metadata: { join_minutes_early: String(settings.joinMinutesEarly), scheduled_by: source },
    };
}

/**
 * Read back the settings a scheduled bot was created with.
 */
export function getBotSettings(bot: Bot): BotSettings {
    const joinMinutesEarly = Number(bot.metadata?.join_minutes_early);
    return {
        botName: bot.bot_name ?? DEFAULT_BOT_SETTINGS.botName,
        joinMinutesEarly: Number.isFinite(joinMinutesEarly) ? joinMinutesEarly : DEFAULT_BOT_SETTINGS.joinMinutesEarly,
        chatMessage: bot.chat?.on_bot_join?.message ?? "",
    };
}

/**
 * Who added a bot. Bots created before rules existed have no `scheduled_by`, so they count as manual.
 */
export function getBotSource(bot: Bot): BotSource {
    const source = bot.metadata?.scheduled_by;
    return source === "rule" || source === "series" ? source : "manual";
}

/**
 * Schedule (or update) the bot for an event. Calling again replaces the previous config.
 */
export async function scheduleBot(
    event: CalendarEvent,
    settings: BotSettings = DEFAULT_BOT_SETTINGS,
    source: BotSource = "manual",
): Promise<CalendarEvent> {
    return scheduleBotForCalendarEvent(event.id, {
        deduplication_key: getDeduplicationKey(event),
        bot_config: buildBotConfig(event, settings, source),
    });
}

/**
 * The bot scheduled for an event's current occurrence, if any. Perpetual events can also list bots
 * for past occurrences, so only bots for meetings that haven't started yet count.
 */
export function getUpcomingBot(event: CalendarEvent, now = new Date()) {
    return event.bots
        .filter((bot) => new Date(bot.start_time) > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
}

/**
 * Whether a scheduled bot still matches its event. Recall doesn't move a bot when its event moves,
 * so a changed start time or meeting link means the bot has to be scheduled again.
 * A bot's start_time is the event start it was scheduled for; compare as instants since the two
 * timestamps may be formatted differently.
 */
export function isBotInSync(bot: CalendarEventBot, event: CalendarEvent): boolean {
    return (
        new Date(bot.start_time).getTime() === new Date(event.start_time).getTime() && bot.meeting_url === event.meeting_url
    );
}
