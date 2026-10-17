import { NextRequest } from "next/server";
import { exchange_google_code, get_google_config, is_google_configured } from "@/lib/oauth/google";
import { read_callback, redirect_home } from "@/lib/oauth/state";
import { calendar_connect } from "@/lib/recall";

/**
 * GET /api/auth/callback/google
 * Google Calendar redirects here after the user authorizes calendar access. Exchanges the code for a refresh token,
 * then creates (or reconnects) the calendar in Recall.ai.
 */
export async function GET(request: NextRequest) {
    if (!is_google_configured()) {
        return new Response("Google OAuth is not configured", { status: 404 });
    }
    const { client_id, client_secret, redirect_uri } = get_google_config();

    const callback = read_callback("google", request);
    if ("error" in callback) {
        console.error(`Google OAuth failed: ${callback.error}`, callback.description ?? "");
        return redirect_home(redirect_uri, { error: callback.error });
    }

    try {
        const { refresh_token, email } = await exchange_google_code(callback.code);
        const { calendar, reconnected } = await calendar_connect({
            platform: "google_calendar",
            email,
            oauth_client_id: client_id,
            oauth_client_secret: client_secret,
            oauth_refresh_token: refresh_token,
        });
        console.log(`Google calendar ${reconnected ? "reconnected" : "connected"}: calendar_id=${calendar.id}`);
        return redirect_home(redirect_uri, { connected: calendar.id });
    } catch (error) {
        console.error("Google OAuth callback failed:", error instanceof Error ? error.message : error);
        return redirect_home(redirect_uri, { error: "connect_failed" });
    }
}
