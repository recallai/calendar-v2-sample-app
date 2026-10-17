import { after } from "next/server";
import { z } from "zod";
import { calendar_settings_delete } from "@/db/queries";
import { calendar_events_list, calendar_find, verify_webhook_request } from "@/lib/recall";
import { format_sync_summary, load_scheduling_context, sync_event_bots } from "@/lib/scheduling";
import { CalendarSyncEventsEventSchema, type CalendarSyncEventsEventType } from "@/schemas/CalendarSyncEventsEventSchema";
import { CalendarUpdateEventSchema, type CalendarUpdateEventType } from "@/schemas/CalendarUpdateEventSchema";

/**
 * POST /api/webhooks/recall
 * Receives Calendar V2 webhooks from Recall.ai.
 * Point a Recall.ai dashboard webhook endpoint at https://<NGROK_DOMAIN>/api/webhooks/recall
 * https://docs.recall.ai/docs/calendar-v2-webhooks
 */
export async function POST(request: Request) {
    // 1. Verify the signature. It's computed over the raw body, so read it as text before parsing.
    const payload = await request.text();
    try {
        verify_webhook_request({ headers: request.headers, payload });
    } catch (error) {
        console.error("Webhook verification failed:", error instanceof Error ? error.message : error);
        return new Response("Request not verified", { status: 401 });
    }

    // 2. Parse it. Acknowledge events this app doesn't handle, so Recall doesn't keep retrying them.
    const result = z.discriminatedUnion("event", [
        CalendarUpdateEventSchema,
        CalendarSyncEventsEventSchema,
    ]).safeParse(JSON.parse(payload));
    if (!result.success) {
        console.log(`Received unhandled Recall webhook event: ${payload}`);
        return new Response(null, { status: 200 });
    }

    // 3. Acknowledge right away and call the Recall.ai API after responding, since syncing many events
    //    (with retries) can take longer than the webhook sender waits for a response. Handling the same
    //    webhook twice is harmless: the second sync finds nothing to change.
    const webhook = result.data;
    after(async () => {
        try {
            const summary = webhook.event === "calendar.update"
                ? await calendar_update(webhook)
                : await calendar_sync_events(webhook);
            console.log(`${webhook.event}: ${summary}`);
        } catch (error) {
            console.error(`Failed to handle ${webhook.event}:`, error instanceof Error ? error.message : error);
        }
    });
    return new Response(null, { status: 200 });
}

/**
 * calendar.update: the calendar's data changed (e.g. its status became "disconnected", or it was deleted).
 * Re-fetch it to see what changed. The app always reads the calendar from Recall, so there's nothing to
 * update locally unless it was deleted. When a calendar disconnects, Recall removes its scheduled bots itself.
 */
async function calendar_update(webhook: CalendarUpdateEventType): Promise<string> {
    const { calendar_id } = webhook.data;

    const calendar = await calendar_find({ calendar_id });
    if (!calendar) {
        await calendar_settings_delete({ calendar_id });
        return "calendar was deleted";
    }

    if (calendar.status === "disconnected") {
        // status_changes holds details such as the provider's error code.
        console.warn(`Calendar ${calendar.id} disconnected. The user needs to reconnect it.`, calendar.status_changes.at(-1) ?? "");
    }
    return `status=${calendar.status}`;
}

/**
 * calendar.sync_events: events on the calendar were created, updated or deleted. This is Calendar V2's
 * app-managed scheduling:
 * 1. Fetch every event updated since `last_updated_ts` (following pagination).
 * 2. Sync each event's bot with the calendar's schedule mode: add bots to newly matching meetings, remove
 *    schedule-mode bots that no longer match, and move bots whose meeting moved.
 * https://docs.recall.ai/docs/scheduling-guide
 */
async function calendar_sync_events(webhook: CalendarSyncEventsEventType): Promise<string> {
    const { calendar_id, last_updated_ts } = webhook.data;

    const calendar = await calendar_find({ calendar_id });
    if (!calendar) {
        await calendar_settings_delete({ calendar_id });
        return "calendar was deleted, skipped";
    }
    if (calendar.status !== "connected") {
        return `calendar is ${calendar.status}, skipped`;
    }

    const [context, calendar_events] = await Promise.all([
        load_scheduling_context({ calendar }),
        calendar_events_list({ calendar_id, updated_at__gte: last_updated_ts }),
    ]);
    const summary = await sync_event_bots({ calendar_events, context, trigger: "webhook" });
    return `events=${calendar_events.length} ${format_sync_summary(summary)}`;
}
