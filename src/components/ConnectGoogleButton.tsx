import { getGoogleConfig, isGoogleConfigured } from "../lib/oauth/google";

/**
 * Starts the Google Calendar OAuth flow. Hidden until the Google OAuth variables are set in .env.
 */
export function ConnectGoogleButton() {
    if (!isGoogleConfigured()) {
        return null;
    }

    // Start OAuth on the same origin as the redirect URI so the state cookie is sent back on the callback.
    const href = new URL("/api/auth/sign-in/google", getGoogleConfig().redirectUri).toString();

    return (
        <a
            href={href}
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
            Connect Google Calendar
        </a>
    );
}
