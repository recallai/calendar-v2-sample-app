import crypto from "crypto";
import { getCalendar, listCalendarEvents } from "./calendar";
import { formatReconcileSummary, getCalendarRules, reconcileEvents } from "./rules";


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

/**
 * calendar.update: the calendar's data changed (e.g. its status became "disconnected").
 * Re-fetch it to get the latest state. When a calendar disconnects, Recall removes its scheduled bots itself.
 * https://docs.recall.ai/docs/calendar-v2-webhooks
 */
export async function handleCalendarUpdate(data: { calendar_id: string }) {
    const calendar = await getCalendar(data.calendar_id);
    console.log(`calendar.update: calendar_id=${calendar.id} status=${calendar.status}`);

    if (calendar.status === "disconnected") {
        // status_changes holds details such as the provider's error code.
        const lastChange = calendar.status_changes.at(-1);
        console.warn(`Calendar ${calendar.id} disconnected. The user needs to reconnect it.`, lastChange ?? "");
    }
}

/**
 * calendar.sync_events: events on the calendar were created, updated or deleted.
 * Fetch every event updated since `last_updated_ts` (following pagination), then apply the calendar's
 * recording rules: add bots to newly matching meetings, remove rule bots that no longer match, and move
 * bots whose meeting moved. This is Calendar V2's app-managed scheduling.
 * https://docs.recall.ai/docs/scheduling-guide
 */
export async function handleCalendarSyncEvents(data: { calendar_id: string; last_updated_ts: string }) {
    const calendar = await getCalendar(data.calendar_id);
    if (calendar.status !== "connected") {
        console.log(`calendar.sync_events: calendar_id=${calendar.id} is ${calendar.status}, skipping`);
        return;
    }

    const events = await listCalendarEvents({
        calendar_id: data.calendar_id,
        updated_at__gte: data.last_updated_ts,
    });
    const rules = getCalendarRules(calendar);
    const summary = await reconcileEvents(events, calendar, rules);

    console.log(
        `calendar.sync_events: calendar_id=${calendar.id} rule=${rules.rule} events=${events.length} ${formatReconcileSummary(summary)}`,
    );
}
