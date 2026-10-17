import { z } from "zod";

export const EnvSchema = z.object({
    RECALL_API_KEY: z.string().min(1),
    RECALL_REGION: z.enum(["us-east-1", "us-west-2", "eu-central-1", "ap-northeast-1"]),
    RECALL_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),

    OUTLOOK_OAUTH_CLIENT_ID: z.string().optional(),
    OUTLOOK_OAUTH_CLIENT_SECRET: z.string().optional(),
    OUTLOOK_OAUTH_REDIRECT_URI: z.string().optional(),
});

export type EnvType = z.infer<typeof EnvSchema>;
