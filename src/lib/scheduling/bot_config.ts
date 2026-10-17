import { generate_bot_deduplication_key, schedule_bot_for_calendar_event } from "@/lib/recall";
import { DEFAULT_CALENDAR_SETTINGS } from "@/lib/settings";
import type { BotType } from "@/schemas/BotArtifactSchema";
import type { CalendarEventType } from "@/schemas/CalendarEventArtifactSchema";
import type { BotSettingsType } from "@/schemas/CalendarSettingsSchema";

/**
 * Turning this app's bot settings into a Recall bot config, and reading them back from a scheduled bot.
 */

/** Who added a bot: the calendar's schedule mode, or the user by hand. Stored in its `scheduled_by` metadata. */
export type BotSource = "schedule_mode" | "manual";

/**
 * Turn the app's bot settings into a Create Bot config for this event. The Schedule Bot endpoint
 * doesn't support partial updates, so this is always the complete config.
 * - `join_at` is only set when joining early; otherwise Recall uses the event's start time.
 * - `metadata.join_minutes_early` remembers the offset so it survives the meeting being moved.
 * - `automatic_leave` sets when the bot gives up or leaves on its own.
 * - `metadata.scheduled_by` records whether the calendar's schedule mode or the user added the bot.
 * https://docs.recall.ai/reference/bot_create, https://docs.recall.ai/docs/sending-chat-messages,
 * https://docs.recall.ai/docs/automatic-leaving-behavior
 */
export function build_bot_config(args: {
    calendar_event: CalendarEventType,
    bot_settings: BotSettingsType,
    source: BotSource,
}) {
    const { calendar_event, bot_settings, source } = args;

    const join_at = bot_settings.joinMinutesEarly > 0
        ? new Date(new Date(calendar_event.start_time).getTime() - bot_settings.joinMinutesEarly * 60_000).toISOString()
        : undefined;

    return {
        bot_name: bot_settings.botName,
        ...(join_at ? { join_at } : {}),
        ...(bot_settings.chatMessage
            ? { chat: { on_bot_join: { send_to: "everyone", message: bot_settings.chatMessage } } }
            : {}),
        automatic_leave: {
            waiting_room_timeout: bot_settings.waitingRoomTimeout,
            noone_joined_timeout: bot_settings.nooneJoinedTimeout,
            // A plain number of seconds. The object form's `activate_after` must be at least 1, so 0 (the
            // documented default) is rejected; the number form leaves it at Recall's default.
            everyone_left_timeout: bot_settings.everyoneLeftTimeout,
        },
        metadata: { join_minutes_early: String(bot_settings.joinMinutesEarly), scheduled_by: source },
    };
}

/**
 * Schedule (or update) the bot for an event. Calling again replaces the previous config.
 */
export async function schedule_bot(args: {
    calendar_event: CalendarEventType,
    bot_settings: BotSettingsType,
    source: BotSource,
}) {
    const { calendar_event } = args;
    const { deduplication_key } = generate_bot_deduplication_key(calendar_event);

    return await schedule_bot_for_calendar_event({
        calendar_event_id: calendar_event.id,
        deduplication_key,
        bot_config: build_bot_config(args),
    });
}

/**
 * Read back the settings a scheduled bot was created with.
 */
export function read_bot_settings(bot: BotType): BotSettingsType {
    const defaults = DEFAULT_CALENDAR_SETTINGS.botSettings;
    const join_minutes_early = Number(bot.metadata?.join_minutes_early);
    const everyone_left_timeout = bot.automatic_leave?.everyone_left_timeout;

    return {
        botName: bot.bot_name ?? defaults.botName,
        joinMinutesEarly: Number.isFinite(join_minutes_early) ? join_minutes_early : defaults.joinMinutesEarly,
        chatMessage: bot.chat?.on_bot_join?.message ?? "",
        waitingRoomTimeout: bot.automatic_leave?.waiting_room_timeout ?? defaults.waitingRoomTimeout,
        nooneJoinedTimeout: bot.automatic_leave?.noone_joined_timeout ?? defaults.nooneJoinedTimeout,
        everyoneLeftTimeout: (typeof everyone_left_timeout === "number" ? everyone_left_timeout : everyone_left_timeout?.timeout)
            ?? defaults.everyoneLeftTimeout,
    };
}

/**
 * Who added a bot, from the `scheduled_by` metadata set in build_bot_config. A bot without it counts as
 * added by hand, so the schedule mode never removes it.
 */
export function read_bot_source(bot: BotType): BotSource {
    return bot.metadata?.scheduled_by === "schedule_mode" ? "schedule_mode" : "manual";
}
