import { z } from "zod";

/**
 * Which of a calendar's meetings automatically get a bot. The labels shown in the UI are in
 * lib/settings.ts.
 */
export const ScheduleModeSchema = z.enum(["none", "all", "organized", "external", "internal"]);

export type ScheduleModeType = z.infer<typeof ScheduleModeSchema>;

/**
 * The bots a calendar's schedule mode sends, or one meeting's bot. The automatic-leave timeouts map to
 * Create Bot's `automatic_leave` fields, in seconds, with Recall's defaults:
 * https://docs.recall.ai/docs/automatic-leaving-behavior
 */
export const BotSettingsSchema = z.object({
    /** Name shown in the call. Ignored by Recall for signed-in Google Meet bots. */
    botName: z.string().trim().min(1, "Bot name is required").max(100),
    /** Join this many minutes before the meeting starts. */
    joinMinutesEarly: z.coerce.number().int().min(0).max(15),
    /** Chat message sent to everyone when the bot joins. Empty means no message. Google Meet allows 500 characters. */
    chatMessage: z.string().trim().max(500),
    /** Leave if nobody admits the bot from the waiting room within this many seconds. */
    waitingRoomTimeout: z.coerce.number().int().min(60).max(3600),
    /** Leave if no one else joins within this many seconds. */
    nooneJoinedTimeout: z.coerce.number().int().min(60).max(3600),
    /** Leave this many seconds after everyone else has left. */
    everyoneLeftTimeout: z.coerce.number().int().min(2).max(600),
});

export type BotSettingsType = z.infer<typeof BotSettingsSchema>;

/**
 * This app's settings for one connected calendar. Recall has no concept of these, so the app stores
 * them in its own database.
 */
export const CalendarSettingsSchema = z.object({
    scheduleMode: ScheduleModeSchema,
    botSettings: BotSettingsSchema,
});

export type CalendarSettingsType = z.infer<typeof CalendarSettingsSchema>;
