import { env } from "../env";

/**
 * Microsoft Outlook OAuth (client secret flow).
 * See: https://docs.recall.ai/docs/calendar-v2-microsoft-outlook
 */

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
// `offline_access` is required for Microsoft to return a refresh token.
const SCOPES = "offline_access openid email https://graph.microsoft.com/Calendars.Read";

export function is_microsoft_configured(): boolean {
    return !!env.OUTLOOK_OAUTH_CLIENT_ID && !!env.OUTLOOK_OAUTH_CLIENT_SECRET && URL.canParse(env.OUTLOOK_OAUTH_REDIRECT_URI ?? "");
}

export function get_microsoft_config() {
    if (!is_microsoft_configured()) {
        throw new Error("Microsoft OAuth is not configured. Set OUTLOOK_OAUTH_CLIENT_ID, OUTLOOK_OAUTH_CLIENT_SECRET and OUTLOOK_OAUTH_REDIRECT_URI.");
    }
    return {
        client_id: env.OUTLOOK_OAUTH_CLIENT_ID!,
        client_secret: env.OUTLOOK_OAUTH_CLIENT_SECRET!,
        redirect_uri: env.OUTLOOK_OAUTH_REDIRECT_URI!,
    };
}

export function build_microsoft_auth_url(state: string): string {
    const { client_id, redirect_uri } = get_microsoft_config();
    const params = new URLSearchParams({
        client_id: client_id,
        redirect_uri: redirect_uri,
        response_type: "code",
        response_mode: "query",
        scope: SCOPES,
        state,
    });
    return `${AUTHORIZE_URL}?${params}`;
}

/**
 * Exchange the authorization code for a refresh token and the authorizing account's email.
 */
export async function exchange_microsoft_code(code: string): Promise<{ refresh_token: string, email: string }> {
    const { client_id, client_secret, redirect_uri } = get_microsoft_config();
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: client_id,
            client_secret: client_secret,
            code,
            redirect_uri: redirect_uri,
            grant_type: "authorization_code",
        }),
    });
    if (!response.ok) {
        throw new Error(`Microsoft token exchange failed with ${response.status}: ${await response.text()}`);
    }
    const tokens = (await response.json()) as { refresh_token?: string; id_token?: string };
    if (!tokens.refresh_token) {
        throw new Error("Microsoft did not return a refresh token");
    }

    const email = get_email_from_id_token(tokens.id_token);
    if (!email) {
        throw new Error("Microsoft id_token did not include an email");
    }

    return { refresh_token: tokens.refresh_token, email };
}

/**
 * Read the email from the id_token's claims. The token came straight from Microsoft's token endpoint
 * over TLS, so its signature doesn't need to be re-verified here.
 * Some accounts have no `email` claim, so fall back to `preferred_username`.
 */
function get_email_from_id_token(id_token: string | undefined): string | undefined {
    const payload = id_token?.split(".")[1];
    if (!payload) return undefined;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        email?: string;
        preferred_username?: string;
    };
    return claims.email ?? claims.preferred_username;
}
