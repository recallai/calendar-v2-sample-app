import { build_microsoft_auth_url, get_microsoft_config, is_microsoft_configured } from "../../../../../lib/oauth/microsoft";
import { redirect_to_provider } from "../../../../../lib/oauth/state";

/**
 * GET /api/auth/sign-in/microsoft
 * Start the Microsoft Outlook OAuth flow by redirecting to the consent screen.
 */
export async function GET() {
    if (!is_microsoft_configured()) {
        return new Response("Microsoft OAuth is not configured", { status: 404 });
    }
    return redirect_to_provider("microsoft", get_microsoft_config().redirect_uri, build_microsoft_auth_url);
}
