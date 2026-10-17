import { z } from "zod";

/**
 * The bot fields this app reads.
 * https://docs.recall.ai/reference/bot_retrieve
 */
export const BotSchema = z.object({
    id: z.string(),
    bot_name: z.string().nullish(),
    join_at: z.string().nullish(),
    chat: z.object({
        on_bot_join: z.object({
            message: z.string().nullish(),
        }).nullish(),
    }).nullish(),
    automatic_leave: z.object({
        waiting_room_timeout: z.number().nullish(),
        noone_joined_timeout: z.number().nullish(),
        // Recall returns a number of seconds; the docs also describe an object form.
        everyone_left_timeout: z.union([
            z.number(),
            z.object({ timeout: z.number().nullish() }),
        ]).nullish(),
    }).nullish(),
    metadata: z.record(z.unknown()).nullish(),
});

export type BotType = z.infer<typeof BotSchema>;
