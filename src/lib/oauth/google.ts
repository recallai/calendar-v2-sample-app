import { env } from "../env";

/**
 * Google Calendar OAuth.
 * Scopes required by Recall: https://docs.recall.ai/docs/calendar-v2-google-calendar
 * Google docs: https://developers.google.com/identity/protocols/oauth2/web-server
 */

const SCOPES = [
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
];

export function is_google_configured(): boolean {
    return !!env.GOOGLE_OAUTH_CLIENT_ID && !!env.GOOGLE_OAUTH_CLIENT_SECRET && URL.canParse(env.GOOGLE_OAUTH_REDIRECT_URI ?? "");
}

export function get_google_config() {
    if (!is_google_configured()) {
        throw new Error("Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI.");
    }
    return {
        client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
        redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI!,
    };
}

export function build_google_auth_url(state: string): string {
    const { client_id, redirect_uri } = get_google_config();
    // `access_type=offline` + `prompt=consent` makes Google return a refresh token every time.
    const params = new URLSearchParams({
        client_id: client_id,
        redirect_uri: redirect_uri,
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
export async function exchange_google_code(code: string): Promise<{ refresh_token: string, email: string }> {
    const { client_id, client_secret, redirect_uri } = get_google_config();
    const token_response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: client_id,
            client_secret: client_secret,
            redirect_uri: redirect_uri,
            grant_type: "authorization_code",
        }),
    });
    if (!token_response.ok) {
        throw new Error(`Google token exchange failed with ${token_response.status}: ${await token_response.text()}`);
    }
    const tokens = (await token_response.json()) as { access_token: string; refresh_token?: string };
    if (!tokens.refresh_token) {
        throw new Error("Google did not return a refresh token");
    }

    const user_response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!user_response.ok) {
        throw new Error(`Google userinfo request failed with ${user_response.status}`);
    }
    const { email } = (await user_response.json()) as { email?: string };
    if (!email) {
        throw new Error("Google userinfo response did not include an email");
    }

    return { refresh_token: tokens.refresh_token, email };
}
