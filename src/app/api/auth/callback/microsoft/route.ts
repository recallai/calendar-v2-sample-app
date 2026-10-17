import { NextRequest } from "next/server";
import { exchange_microsoft_code, get_microsoft_config, is_microsoft_configured } from "@/lib/oauth/microsoft";
import { read_callback, redirect_home } from "@/lib/oauth/state";
import { calendar_connect } from "@/lib/recall";

/**
 * GET /api/auth/callback/microsoft
 * Microsoft Outlook redirects here after the user authorizes calendar access. Exchanges the code for a refresh token,
 * then creates (or reconnects) the calendar in Recall.ai.
 */
export async function GET(request: NextRequest) {
    if (!is_microsoft_configured()) {
        return new Response("Microsoft OAuth is not configured", { status: 404 });
    }
    const { client_id, client_secret, redirect_uri } = get_microsoft_config();

    const callback = read_callback("microsoft", request);
    if ("error" in callback) {
        console.error(`Microsoft OAuth failed: ${callback.error}`, callback.description ?? "");
        return redirect_home(redirect_uri, { error: callback.error });
    }

    try {
        const { refresh_token, email } = await exchange_microsoft_code(callback.code);
        const { calendar, reconnected } = await calendar_connect({
            platform: "microsoft_outlook",
            email,
            oauth_client_id: client_id,
            oauth_client_secret: client_secret,
            oauth_refresh_token: refresh_token,
        });
        console.log(`Microsoft calendar ${reconnected ? "reconnected" : "connected"}: calendar_id=${calendar.id}`);
        return redirect_home(redirect_uri, { connected: calendar.id });
    } catch (error) {
        console.error("Microsoft OAuth callback failed:", error instanceof Error ? error.message : error);
        return redirect_home(redirect_uri, { error: "connect_failed" });
    }
}
