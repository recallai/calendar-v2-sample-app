import { CalendarPlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
        <a href={href} className={buttonVariants()}>
            <CalendarPlusIcon />
            Connect Microsoft Outlook
        </a>
    );
}
