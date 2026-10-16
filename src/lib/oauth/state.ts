import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF protection for the OAuth flow: a random `state` is stored in a cookie by the sign-in route
 * and must match the `state` the provider sends back to the callback route.
 */

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_COOKIE_PATH = "/api/auth";

type Provider = "google" | "microsoft";

/**
 * Redirect to the provider's consent screen and remember the `state` in a cookie.
 */
export function redirectToProvider(provider: Provider, redirectUri: string, buildAuthUrl: (state: string) => string) {
    const state = crypto.randomBytes(16).toString("hex");
    const response = NextResponse.redirect(buildAuthUrl(state));
    response.cookies.set(OAUTH_STATE_COOKIE, `${provider}.${state}`, {
        httpOnly: true,
        // Secure cookies aren't kept over plain http, so only set it when the callback is https (e.g. not localhost).
        secure: new URL(redirectUri).protocol === "https:",
        sameSite: "lax",
        path: OAUTH_COOKIE_PATH,
        maxAge: 10 * 60,
    });
    return response;
}

/**
 * Validate the callback request and return the authorization code, or an error code to show the user.
 */
export function readCallback(
    provider: Provider,
    request: NextRequest,
): { code: string } | { error: string; description?: string } {
    const { searchParams } = request.nextUrl;
    const providerError = searchParams.get("error");
    if (providerError) {
        // Providers send a human-readable reason (e.g. Microsoft's AADSTS error) in `error_description`.
        return { error: providerError, description: searchParams.get("error_description") ?? undefined };
    }
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state || request.cookies.get(OAUTH_STATE_COOKIE)?.value !== `${provider}.${state}`) {
        return { error: "invalid_state" };
    }
    return { code };
}

/**
 * Send the user back to the home page with the result, clearing the state cookie.
 */
export function redirectHome(redirectUri: string, result: { connected: string } | { error: string }) {
    const home = new URL("/", redirectUri);
    for (const [key, value] of Object.entries(result)) home.searchParams.set(key, value);
    const response = NextResponse.redirect(home);
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: OAUTH_COOKIE_PATH });
    return response;
}
