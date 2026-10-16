import { NextRequest } from "next/server";
import { upsertCalendar } from "@/db/queries";
import { connectCalendar } from "@/lib/recall";
import { exchangeMicrosoftCode, getMicrosoftConfig, isMicrosoftConfigured } from "@/lib/oauth/microsoft";
import { readCallback, redirectHome } from "@/lib/oauth/state";

/**
 * GET /api/auth/callback/microsoft
 * Microsoft Outlook redirects here after the user authorizes calendar access. Exchanges the code for a refresh token,
 * then creates (or reconnects) the calendar in Recall.ai.
 */
export async function GET(request: NextRequest) {
    if (!isMicrosoftConfigured()) {
        return new Response("Microsoft OAuth is not configured", { status: 404 });
    }
    const { clientId, clientSecret, redirectUri } = getMicrosoftConfig();

    const callback = readCallback("microsoft", request);
    if ("error" in callback) {
        console.error(`Microsoft OAuth failed: ${callback.error}`, callback.description ?? "");
        return redirectHome(redirectUri, { error: callback.error });
    }

    try {
        const { refreshToken, email } = await exchangeMicrosoftCode(callback.code);
        const { calendar, reconnected } = await connectCalendar({
            platform: "microsoft_outlook",
            email,
            clientId,
            clientSecret,
            refreshToken,
        });
        await upsertCalendar(calendar);
        console.log(`Microsoft calendar ${reconnected ? "reconnected" : "connected"}: calendar_id=${calendar.id}`);
        return redirectHome(redirectUri, { connected: calendar.id });
    } catch (error) {
        console.error("Microsoft OAuth callback failed:", error instanceof Error ? error.message : error);
        return redirectHome(redirectUri, { error: "connect_failed" });
    }
}
