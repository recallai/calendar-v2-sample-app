import { CalendarPlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { get_google_config, is_google_configured } from "../lib/oauth/google";

/**
 * Starts the Google Calendar OAuth flow. Hidden until the Google OAuth variables are set in .env.
 */
export function ConnectGoogleButton() {
    if (!is_google_configured()) {
        return null;
    }

    // Start OAuth on the same origin as the redirect URI so the state cookie is sent back on the callback.
    const href = new URL("/api/auth/sign-in/google", get_google_config().redirect_uri).toString();

    return (
        <a href={href} className={buttonVariants()}>
            <CalendarPlusIcon />
            Connect Google Calendar
        </a>
    );
}
