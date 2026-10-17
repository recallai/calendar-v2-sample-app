import { EnvSchema } from "../schemas/EnvSchema";

/**
 * Server-only environment variables, checked when the server starts.
 */
export const env = EnvSchema.parse(process.env);
