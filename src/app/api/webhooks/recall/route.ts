import { after } from "next/server";
import { finishWebhookEvent, recordWebhookEvent, upsertCalendar } from "@/db/queries";
import { getEnv } from "@/lib/env";
import {
    formatReconcileSummary,
    getCalendar,
    listCalendarEvents,
    loadDispatchContext,
    reconcileEvents,
    type CalendarSyncEvent,
    type CalendarUpdateEvent,
    verifyWebhookRequest,
    WebhookSchema,
} from "@/lib/recall";

/**
 * Receives webhooks from Recall.ai.
 * Point a Recall.ai dashboard webhook endpoint at https://<NGROK_DOMAIN>/api/webhooks/recall
 *
 * Every verified webhook is stored in the `webhook_events` table by its message ID, so a redelivered
 * message (Recall retries until it gets a 2xx) is only processed once, and the activity feed can show
 * what arrived and what the app did about it.
 */
export async function POST(request: Request) {
    // Signature verification must run against the raw body, before parsing.
    const payload = await request.text();

    try {
        verifyWebhookRequest({
            secret: getEnv().RECALL_WEBHOOK_SECRET,
            headers: request.headers,
            payload,
        });
    } catch (error) {
        console.error("Webhook verification failed:", error instanceof Error ? error.message : error);
        return new Response("Request not verified", { status: 401 });
    }

    // Verification guarantees one of these headers is present.
    const messageId = (request.headers.get("webhook-id") ?? request.headers.get("svix-id"))!;
    const json = JSON.parse(payload);
    const result = WebhookSchema.safeParse(json);

    const isNew = await recordWebhookEvent({
        id: messageId,
        event: typeof json?.event === "string" ? json.event : "unknown",
        calendarId: typeof json?.data?.calendar_id === "string" ? json.data.calendar_id : null,
        payload,
        // Acknowledge events this app doesn't handle so Recall doesn't keep retrying them.
        status: result.success ? "received" : "ignored",
    });

    if (!isNew) {
        console.log(`Ignoring redelivered webhook ${messageId}`);
        return new Response(null, { status: 200 });
    }
    if (!result.success) {
        console.log(`Received unhandled webhook event: ${json?.event}`);
        return new Response(null, { status: 200 });
    }

    // Acknowledge right away and do the Recall.ai API calls after responding, since syncing many events
    // (with retries) can take longer than the webhook sender waits for a response.
    const webhook = result.data;
    after(async () => {
        try {
            const summary =
                webhook.event === "calendar.update"
                    ? await calendarUpdate(webhook.data)
                    : await calendarSync(webhook.data, messageId);
            await finishWebhookEvent(messageId, { status: "processed", summary });
            console.log(`${webhook.event}: ${summary}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await finishWebhookEvent(messageId, { status: "failed", error: message });
            console.error(`Failed to handle ${webhook.event}:`, message);
        }
    });

    return new Response(null, { status: 200 });
}

/**
 * calendar.update: the calendar's data changed (e.g. its status became "disconnected").
 * Re-fetch it and update the local copy. When a calendar disconnects, Recall removes its scheduled bots itself.
 * https://docs.recall.ai/docs/calendar-v2-webhooks
 */
async function calendarUpdate(data: CalendarUpdateEvent): Promise<string> {
    const calendar = await getCalendar(data.calendar_id);
    await upsertCalendar(calendar);

    if (calendar.status === "disconnected") {
        // status_changes holds details such as the provider's error code.
        console.warn(`Calendar ${calendar.id} disconnected. The user needs to reconnect it.`, calendar.status_changes.at(-1) ?? "");
    }
    return `status=${calendar.status}`;
}

/**
 * calendar.sync_events: events on the calendar were created, updated or deleted.
 * Fetch every event updated since `last_updated_ts` (following pagination), then apply the calendar's
 * dispatch rules: add bots to newly matching meetings, remove rule bots that no longer match, and move
 * bots whose meeting moved. This is Calendar V2's app-managed scheduling.
 * https://docs.recall.ai/docs/scheduling-guide
 */
async function calendarSync(data: CalendarSyncEvent, messageId: string): Promise<string> {
    const calendar = await getCalendar(data.calendar_id);
    if (calendar.status !== "connected") {
        await upsertCalendar(calendar);
        return `calendar is ${calendar.status}, skipped`;
    }

    const [context, events] = await Promise.all([
        loadDispatchContext(calendar),
        listCalendarEvents({ calendar_id: data.calendar_id, updated_at__gte: data.last_updated_ts }),
    ]);
    const summary = await reconcileEvents(events, context, "webhook", messageId);
    return `events=${events.length} ${formatReconcileSummary(summary)}`;
}
