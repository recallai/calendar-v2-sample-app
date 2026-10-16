import { NextRequest } from "next/server";
import { connectCalendar } from "../../../../../lib/recall";
import { exchangeGoogleCode, getGoogleConfig, isGoogleConfigured } from "../../../../../lib/oauth/google";
import { readCallback, redirectHome } from "../../../../../lib/oauth/state";

/**
 * GET /api/auth/callback/google
 * Google Calendar redirects here after the user authorizes calendar access. Exchanges the code for a refresh token,
 * then creates (or reconnects) the calendar in Recall.ai.
 */
export async function GET(request: NextRequest) {
    if (!isGoogleConfigured()) {
        return new Response("Google OAuth is not configured", { status: 404 });
    }
    const { clientId, clientSecret, redirectUri } = getGoogleConfig();

    const callback = readCallback("google", request);
    if ("error" in callback) {
        console.error(`Google OAuth failed: ${callback.error}`, callback.description ?? "");
        return redirectHome(redirectUri, { error: callback.error });
    }

    try {
        const { refreshToken, email } = await exchangeGoogleCode(callback.code);
        const { calendar, reconnected } = await connectCalendar({
            platform: "google_calendar",
            email,
            clientId,
            clientSecret,
            refreshToken,
        });
        console.log(`Google calendar ${reconnected ? "reconnected" : "connected"}: calendar_id=${calendar.id}`);
        return redirectHome(redirectUri, { connected: calendar.id });
    } catch (error) {
        console.error("Google OAuth callback failed:", error instanceof Error ? error.message : error);
        return redirectHome(redirectUri, { error: "connect_failed" });
    }
}
