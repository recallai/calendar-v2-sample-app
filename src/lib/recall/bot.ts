import { DEFAULT_BOT_SETTINGS, type BotSettings } from "@/lib/bot-settings";
import type { BotSource } from "@/lib/schedule-modes";
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
    automatic_leave?: {
        waiting_room_timeout?: number;
        noone_joined_timeout?: number;
        /** Recall returns a number of seconds; the docs also describe an object form. */
        everyone_left_timeout?: number | { timeout?: number; activate_after?: number | null } | null;
    } | null;
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
 * - `automatic_leave` sets when the bot gives up or leaves on its own.
 * - `metadata.scheduled_by` records whether the calendar's schedule mode or the user added the bot.
 * https://docs.recall.ai/reference/bot_create, https://docs.recall.ai/docs/sending-chat-messages,
 * https://docs.recall.ai/docs/automatic-leaving-behavior
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
        automatic_leave: {
            waiting_room_timeout: settings.waitingRoomTimeout,
            noone_joined_timeout: settings.nooneJoinedTimeout,
            // A plain number of seconds. The object form's `activate_after` must be at least 1, so 0 (the
            // documented default) is rejected; the number form leaves it at Recall's default.
            everyone_left_timeout: settings.everyoneLeftTimeout,
        },
        metadata: { join_minutes_early: String(settings.joinMinutesEarly), scheduled_by: source },
    };
}

function getEveryoneLeftTimeout(bot: Bot): number | undefined {
    const value = bot.automatic_leave?.everyone_left_timeout;
    return typeof value === "number" ? value : (value?.timeout ?? undefined);
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
        waitingRoomTimeout: bot.automatic_leave?.waiting_room_timeout ?? DEFAULT_BOT_SETTINGS.waitingRoomTimeout,
        nooneJoinedTimeout: bot.automatic_leave?.noone_joined_timeout ?? DEFAULT_BOT_SETTINGS.nooneJoinedTimeout,
        everyoneLeftTimeout: getEveryoneLeftTimeout(bot) ?? DEFAULT_BOT_SETTINGS.everyoneLeftTimeout,
    };
}

/**
 * Who added a bot. Bots created before schedule modes existed have no `scheduled_by`, so they count as
 * manual. ("rule" and "series" both mean the app added it automatically.)
 */
export function getBotSource(bot: Bot): BotSource {
    const source = bot.metadata?.scheduled_by;
    return source === "rule" || source === "series" ? "rule" : "manual";
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
