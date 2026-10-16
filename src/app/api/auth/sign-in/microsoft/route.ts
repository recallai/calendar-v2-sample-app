import { buildMicrosoftAuthUrl, getMicrosoftConfig, isMicrosoftConfigured } from "../../../../../lib/oauth/microsoft";
import { redirectToProvider } from "../../../../../lib/oauth/state";

/**
 * GET /api/auth/sign-in/microsoft
 * Start the Microsoft Outlook OAuth flow by redirecting to the consent screen.
 */
export async function GET() {
    if (!isMicrosoftConfigured()) {
        return new Response("Microsoft OAuth is not configured", { status: 404 });
    }
    return redirectToProvider("microsoft", getMicrosoftConfig().redirectUri, buildMicrosoftAuthUrl);
}
