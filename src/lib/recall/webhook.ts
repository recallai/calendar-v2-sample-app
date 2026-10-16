import crypto from "crypto";


/**
 * Verify that a request came from Recall.ai.
 * Supports both workspace verification secrets (`webhook-*` headers) and Svix endpoint secrets (`svix-*` headers).
 * See: https://docs.recall.ai/docs/authenticating-requests-from-recallai
 */
export function verifyWebhookRequest(args: {
    secret: string;
    headers: Headers;
    payload: string | null;
}) {
    const { secret, headers, payload } = args;
    const msg_id = headers.get("webhook-id") ?? headers.get("svix-id");
    const msg_timestamp = headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
    const msg_signature = headers.get("webhook-signature") ?? headers.get("svix-signature");

    if (!secret || !secret.startsWith("whsec_")) {
        throw new Error("Verification secret is missing or invalid");
    }
    if (!msg_id || !msg_timestamp || !msg_signature) {
        throw new Error("Missing webhook id, timestamp, or signature header");
    }

    const key = Buffer.from(secret.slice("whsec_".length), "base64");
    const to_sign = `${msg_id}.${msg_timestamp}.${payload ?? ""}`;
    const expected_sig = crypto.createHmac("sha256", key).update(to_sign).digest();

    // The header may contain multiple space-separated signatures (e.g. during secret rotation).
    for (const versioned_sig of msg_signature.split(" ")) {
        const [version, signature] = versioned_sig.split(",");
        if (version !== "v1" || !signature) continue;
        const sig_bytes = Buffer.from(signature, "base64");
        if (sig_bytes.length === expected_sig.length && crypto.timingSafeEqual(sig_bytes, expected_sig)) {
            return;
        }
    }

    throw new Error("No matching signature found");
}
