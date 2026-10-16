import { getMicrosoftConfig, isMicrosoftConfigured } from "../lib/oauth/microsoft";

/**
 * Starts the Microsoft Outlook OAuth flow. Hidden until the Outlook OAuth variables are set in .env.
 */
export function ConnectMicrosoftButton() {
    if (!isMicrosoftConfigured()) {
        return null;
    }

    // Start OAuth on the same origin as the redirect URI so the state cookie is sent back on the callback.
    const href = new URL("/api/auth/sign-in/microsoft", getMicrosoftConfig().redirectUri).toString();

    return (
        <a
            href={href}
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
            Connect Microsoft Outlook
        </a>
    );
}
