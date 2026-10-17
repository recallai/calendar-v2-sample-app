import { ArrowRightLeftIcon, BotIcon, BotOffIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { BotDecisionRow } from "@/db/schema";
import { ClientTime } from "./ClientTime";
import { RefreshButton } from "./RefreshButton";

const DECISIONS = {
    scheduled: { label: "Bot sent", icon: BotIcon },
    rescheduled: { label: "Bot moved", icon: ArrowRightLeftIcon },
    removed: { label: "Bot removed", icon: BotOffIcon },
} as const satisfies Record<BotDecisionRow["action"], unknown>;

const TRIGGER_LABELS: Record<BotDecisionRow["trigger"], string> = {
    webhook: "webhook",
    schedule_mode_changed: "calendar setting changed",
    user: "you",
};

/**
 * Bots the app sent, moved or removed, and why, from the local database.
 */
export function ActivityFeed({ decisions }: { decisions: BotDecisionRow[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Activity</h2>
                <RefreshButton />
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BotIcon className="size-4 text-muted-foreground" />
                        Bot decisions
                    </CardTitle>
                    <CardDescription>
                        Bots the app sent, moved or removed, and why. To see every webhook Recall sent and whether it
                        was delivered, open Webhooks in the Recall.ai dashboard.
                    </CardDescription>
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
                                            {decision.event_title ?? decision.calendar_event_id}
                                            {decision.event_start_time && (
                                                <span className="text-muted-foreground">
                                                    {" "}
                                                    · <ClientTime value={decision.event_start_time} />
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{decision.reason}</span>
                                        <span className="text-xs text-muted-foreground">
                                            <ClientTime value={decision.created_at} />
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
