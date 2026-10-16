import { z } from "zod";

/**
 * Per-meeting bot settings editable in the UI. Kept free of server imports so client components can use it.
 */
export const BotSettingsSchema = z.object({
    /** Name shown in the call. Ignored by Recall for signed-in Google Meet bots. */
    botName: z.string().trim().min(1, "Bot name is required").max(100),
    /** Join this many minutes before the meeting starts. */
    joinMinutesEarly: z.coerce.number().int().min(0).max(15),
    /** Chat message sent to everyone when the bot joins. Empty means no message. Google Meet allows 500 characters. */
    chatMessage: z.string().trim().max(500),
});

export type BotSettings = z.infer<typeof BotSettingsSchema>;

export const DEFAULT_BOT_SETTINGS: BotSettings = {
    botName: "Recall Notetaker",
    joinMinutesEarly: 0,
    chatMessage: "",
};
