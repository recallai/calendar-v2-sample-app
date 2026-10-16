"use client";

import { ExternalLinkIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { UpcomingEvent } from "@/lib/recall";
import { BotControls, type BotActions } from "./BotControls";
import { formatDay, formatTimeRange, getPlatformLabel } from "./calendar-format";
import { UseCalendarRulesButton, type ResetToRulesFn } from "./UseCalendarRulesButton";

const BOT_SOURCE_LABELS = {
    rule: "Sent automatically by this calendar's setting",
    manual: "Added by hand",
} as const;

const OVERRIDE_LABELS = {
    dispatch: "Always send a bot to this meeting",
    skip: "Never send a bot to this meeting",
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
    resetToRulesFn,
}: {
    event: UpcomingEvent;
    now: Date;
    onClose: () => void;
    resetToRulesFn: ResetToRulesFn;
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
                        {formatDay(start)}
                        {!event.isAllDay && ` · ${formatTimeRange(start, end)}`}
                    </DialogDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {event.meeting_platform && <Badge variant="secondary">{getPlatformLabel(event.meeting_platform)}</Badge>}
                        <Badge variant="outline">{event.calendarLabel}</Badge>
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
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Dispatch decision</span>
                    {event.botSource && (
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                            {event.botSource === "rule" && <ZapIcon className="size-4 text-amber-500" />}
                            {BOT_SOURCE_LABELS[event.botSource]}
                        </span>
                    )}
                    <span className="text-sm text-muted-foreground">{event.decisionReason}</span>
                    {event.override && !hasStarted && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">{OVERRIDE_LABELS[event.override]}</Badge>
                            <UseCalendarRulesButton eventId={event.id} resetToRulesFn={resetToRulesFn} />
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
                        defaultSettings={event.calendarBotSettings}
                        removeLabel={event.botSource === "rule" ? "Skip this meeting" : "Remove"}
                        saveBotFn={saveBotFn}
                        removeBotFn={removeBotFn}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
