import { buildGoogleAuthUrl, getGoogleConfig, isGoogleConfigured } from "../../../../../lib/oauth/google";
import { redirectToProvider } from "../../../../../lib/oauth/state";

/**
 * GET /api/auth/sign-in/google
 * Start the Google Calendar OAuth flow by redirecting to the consent screen.
 */
export async function GET() {
    if (!isGoogleConfigured()) {
        return new Response("Google OAuth is not configured", { status: 404 });
    }
    return redirectToProvider("google", getGoogleConfig().redirectUri, buildGoogleAuthUrl);
}
