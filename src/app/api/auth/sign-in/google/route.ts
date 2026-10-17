import { build_google_auth_url, get_google_config, is_google_configured } from "../../../../../lib/oauth/google";
import { redirect_to_provider } from "../../../../../lib/oauth/state";

/**
 * GET /api/auth/sign-in/google
 * Start the Google Calendar OAuth flow by redirecting to the consent screen.
 */
export async function GET() {
    if (!is_google_configured()) {
        return new Response("Google OAuth is not configured", { status: 404 });
    }
    return redirect_to_provider("google", get_google_config().redirect_uri, build_google_auth_url);
}
