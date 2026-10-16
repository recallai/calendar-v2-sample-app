import { after } from "next/server";
import { getEnv } from "../../../../lib/env";
import {
  type CalendarSyncEvent,
  type CalendarUpdateEvent,
  verifyWebhookRequest,
  WebhookSchema
} from "../../../../lib/recall";

/**
 * Receives webhooks from Recall.ai.
 * Point a Recall.ai dashboard webhook endpoint at https://<NGROK_DOMAIN>/api/webhooks/recall
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

    const json = JSON.parse(payload);
    const result = WebhookSchema.safeParse(json);
    if (!result.success) {
        // Acknowledge events this app doesn't handle so Recall doesn't keep retrying them.
        console.log(`Received unhandled webhook event: ${json?.event}`);
        return new Response(null, { status: 200 });
    }

    // Acknowledge right away and do the Recall.ai API calls after responding, since syncing many events
    // (with retries) can take longer than the webhook sender waits for a response.
    const webhook = result.data;
    after(async () => {
        try {
            switch (webhook.event) {
                case "calendar.update":
                    await calendarUpdate(webhook.data);
                    break;
                case "calendar.sync_events":
                    await calendarSync(webhook.data);
                    break;
            }
        } catch (error) {
            console.error(`Failed to handle ${webhook.event}:`, error instanceof Error ? error.message : error);
        }
    });

    return new Response(null, { status: 200 });
}


async function calendarUpdate(data: CalendarUpdateEvent) {
  //
}


async function calendarSync(data: CalendarSyncEvent) {
  //
}
