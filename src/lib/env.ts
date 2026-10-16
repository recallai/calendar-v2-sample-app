import { z } from "zod";

const EnvSchema = z.object({
    RECALL_API_KEY: z.string().min(1),
    RECALL_REGION: z.enum(["us-east-1", "us-west-2", "eu-central-1", "ap-northeast-1"]),
    RECALL_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
    NGROK_DOMAIN: z.string().optional(),

    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),

    OUTLOOK_OAUTH_CLIENT_ID: z.string().optional(),
    OUTLOOK_OAUTH_CLIENT_SECRET: z.string().optional(),
    OUTLOOK_OAUTH_REDIRECT_URI: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let env: Env | undefined;

/**
 * Server-only environment variables. Parsed lazily so the app can still render without them.
 */
export function getEnv(): Env {
    env ??= EnvSchema.parse(process.env);
    return env;
}
