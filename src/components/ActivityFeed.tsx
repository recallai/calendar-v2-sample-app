import { ArrowRightLeftIcon, BotIcon, BotOffIcon, WebhookIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BotDecisionRow, WebhookEventRow } from "@/db/schema";
import { ClientTime } from "./ClientTime";
import { RefreshButton } from "./RefreshButton";

type WebhookEventSummary = Pick<
    WebhookEventRow,
    "id" | "event" | "calendarId" | "status" | "summary" | "error" | "receivedAt" | "processedAt"
>;

const WEBHOOK_STATUS_VARIANTS = {
    received: "outline",
    processed: "secondary",
    failed: "destructive",
    ignored: "outline",
} as const satisfies Record<WebhookEventRow["status"], "outline" | "secondary" | "destructive">;

const DECISIONS = {
    scheduled: { label: "Bot sent", icon: BotIcon },
    rescheduled: { label: "Bot moved", icon: ArrowRightLeftIcon },
    removed: { label: "Bot removed", icon: BotOffIcon },
} as const satisfies Record<BotDecisionRow["action"], unknown>;

const TRIGGER_LABELS: Record<BotDecisionRow["trigger"], string> = {
    webhook: "webhook",
    rules_changed: "calendar setting changed",
    user: "you",
};

/**
 * What the app has received from Recall and what it did about it, from the local database.
 */
export function ActivityFeed({
    webhookEvents,
    decisions,
    calendarLabels,
}: {
    webhookEvents: WebhookEventSummary[];
    decisions: BotDecisionRow[];
    calendarLabels: Record<string, string>;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Activity</h2>
                <RefreshButton />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <WebhookIcon className="size-4 text-muted-foreground" />
                            Webhooks from Recall
                        </CardTitle>
                        <CardDescription>Every verified webhook, and what the app did with it.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {webhookEvents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No webhooks yet. Recall sends calendar.sync_events when a calendar&apos;s events change.
                            </p>
                        ) : (
                            <ul className="flex flex-col divide-y">
                                {webhookEvents.map((webhook) => (
                                    <li key={webhook.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <code className="text-xs font-medium">{webhook.event}</code>
                                            <Badge variant={WEBHOOK_STATUS_VARIANTS[webhook.status]}>{webhook.status}</Badge>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            <ClientTime value={webhook.receivedAt} />
                                            {webhook.calendarId && ` · ${calendarLabels[webhook.calendarId] ?? webhook.calendarId}`}
                                        </span>
                                        {webhook.summary && <code className="text-xs text-muted-foreground">{webhook.summary}</code>}
                                        {webhook.error && <span className="text-xs text-destructive">{webhook.error}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BotIcon className="size-4 text-muted-foreground" />
                            Bot decisions
                        </CardTitle>
                        <CardDescription>Bots the app sent, moved or removed, and why.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {decisions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No bots sent or removed yet.</p>
                        ) : (
                            <ul className="flex flex-col divide-y">
                                {decisions.map((decision) => {
                                    const { label, icon: Icon } = DECISIONS[decision.action];
                                    return (
                                        <li key={decision.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                                    <Icon className="size-4 text-muted-foreground" />
                                                    {label}
                                                </span>
                                                <Badge variant="outline">by {TRIGGER_LABELS[decision.trigger]}</Badge>
                                            </div>
                                            <span className="truncate text-sm">
                                                {decision.eventTitle ?? decision.calendarEventId}
                                                {decision.eventStartTime && (
                                                    <span className="text-muted-foreground">
                                                        {" "}
                                                        · <ClientTime value={decision.eventStartTime} />
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{decision.reason}</span>
                                            <span className="text-xs text-muted-foreground">
                                                <ClientTime value={decision.createdAt} />
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
