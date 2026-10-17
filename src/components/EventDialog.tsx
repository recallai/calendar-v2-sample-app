"use client";

import { ExternalLinkIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Separator } from "@/components/ui/Separator";
import type { UpcomingEvent } from "@/lib/scheduling";
import { BotControls, type BotActions } from "./BotControls";
import { format_day, format_time_range, get_platform_label } from "./calendar_format";
import { FollowScheduleModeButton, type FollowScheduleModeFn } from "./FollowScheduleModeButton";

const BOT_SOURCE_LABELS = {
    schedule_mode: "Sent automatically by this calendar's setting",
    manual: "Added by hand",
} as const;

const OVERRIDE_LABELS = {
    always: "Always send a bot to this meeting",
    never: "Never send a bot to this meeting",
} as const;

/**
 * Details for one meeting, with controls to add, edit or remove its bot.
 */
export function EventDialog({
    event,
    now,
    onClose,
    saveBotFn,
    removeBotFn,
    followScheduleModeFn,
}: {
    event: UpcomingEvent;
    now: Date;
    onClose: () => void;
    followScheduleModeFn: FollowScheduleModeFn;
} & BotActions) {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const hasStarted = start <= now;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="pr-8">{event.title}</DialogTitle>
                    <DialogDescription>
                        {format_day(start)} · {format_time_range(start, end)}
                    </DialogDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {event.meeting_platform && <Badge variant="secondary">{get_platform_label(event.meeting_platform)}</Badge>}
                        <Badge variant="outline">{event.calendar_label}</Badge>
                        {event.meeting_url && (
                            <a
                                href={event.meeting_url}
                                target="_blank"
                                rel="noreferrer"
                                className={buttonVariants({ variant: "link", size: "xs", className: "px-0" })}
                            >
                                Open meeting link
                                <ExternalLinkIcon />
                            </a>
                        )}
                    </div>
                </DialogHeader>

                {/* Calendar V2: the app, not Recall, decides which meetings get a bot. */}
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Bot decision</span>
                    {event.bot_source && (
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                            {event.bot_source === "schedule_mode" && <ZapIcon className="size-4 text-amber-500" />}
                            {BOT_SOURCE_LABELS[event.bot_source]}
                        </span>
                    )}
                    <span className="text-sm text-muted-foreground">{event.decision_reason}</span>
                    {event.override && !hasStarted && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">{OVERRIDE_LABELS[event.override]}</Badge>
                            <FollowScheduleModeButton eventId={event.id} followScheduleModeFn={followScheduleModeFn} />
                        </div>
                    )}
                </div>

                <Separator />

                {hasStarted ? (
                    <p className="text-sm text-muted-foreground">
                        {end <= now ? "This meeting has ended." : "This meeting has already started."}
                        {event.bot && ` Bot: ${event.bot.botName}.`}
                    </p>
                ) : (
                    <BotControls
                        eventId={event.id}
                        hasMeetingUrl={!!event.meeting_url}
                        bot={event.bot}
                        defaultSettings={event.calendar_bot_settings}
                        removeLabel={event.bot_source === "schedule_mode" ? "Skip this meeting" : "Remove"}
                        saveBotFn={saveBotFn}
                        removeBotFn={removeBotFn}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
