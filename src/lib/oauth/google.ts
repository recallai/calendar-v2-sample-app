import { getEnv } from "../env";

/**
 * Google Calendar OAuth.
 * Scopes required by Recall: https://docs.recall.ai/docs/calendar-v2-google-calendar
 * Google docs: https://developers.google.com/identity/protocols/oauth2/web-server
 */

const SCOPES = [
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleConfigured(): boolean {
    const env = getEnv();
    return !!env.GOOGLE_OAUTH_CLIENT_ID && !!env.GOOGLE_OAUTH_CLIENT_SECRET && URL.canParse(env.GOOGLE_OAUTH_REDIRECT_URI ?? "");
}

export function getGoogleConfig() {
    const env = getEnv();
    if (!isGoogleConfigured()) {
        throw new Error("Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI.");
    }
    return {
        clientId: env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
        redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI!,
    };
}

export function buildGoogleAuthUrl(state: string): string {
    const { clientId, redirectUri } = getGoogleConfig();
    // `access_type=offline` + `prompt=consent` makes Google return a refresh token every time.
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange the authorization code for a refresh token and the authorizing account's email.
 */
export async function exchangeGoogleCode(code: string): Promise<{ refreshToken: string; email: string }> {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });
    if (!tokenResponse.ok) {
        throw new Error(`Google token exchange failed with ${tokenResponse.status}: ${await tokenResponse.text()}`);
    }
    const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token?: string };
    if (!tokens.refresh_token) {
        throw new Error("Google did not return a refresh token");
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userResponse.ok) {
        throw new Error(`Google userinfo request failed with ${userResponse.status}`);
    }
    const { email } = (await userResponse.json()) as { email?: string };
    if (!email) {
        throw new Error("Google userinfo response did not include an email");
    }

    return { refreshToken: tokens.refresh_token, email };
}
