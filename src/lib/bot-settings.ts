import { z } from "zod";

/**
 * Bot settings editable in the UI: a calendar's defaults for the bots its schedule mode sends, or one
 * meeting's bot. Kept free of server imports so client components can use it.
 *
 * The automatic-leave timeouts map to Create Bot's `automatic_leave` fields, in seconds, with Recall's
 * defaults: https://docs.recall.ai/docs/automatic-leaving-behavior
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

export type BotSettings = z.infer<typeof BotSettingsSchema>;

export const DEFAULT_BOT_SETTINGS: BotSettings = {
    botName: "Recall Notetaker",
    joinMinutesEarly: 0,
    chatMessage: "",
    waitingRoomTimeout: 1200,
    nooneJoinedTimeout: 1200,
    everyoneLeftTimeout: 2,
};
