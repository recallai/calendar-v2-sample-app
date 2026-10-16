"use client";

import { useEffect } from "react";
import type { UpcomingEvent } from "../lib/recall";
import { BotControls, type BotActions } from "./BotControls";
import { formatDay, formatTimeRange, getPlatformLabel } from "./calendar-format";
import { SeriesRecordingToggle, type SetSeriesRecordingFn } from "./SeriesRecordingToggle";

const BOT_SOURCE_LABELS = {
    rule: "⚡ Added automatically by this calendar's recording rule",
    series: "⚡ Added automatically because this series always records",
    manual: "Added by hand",
} as const;

/**
 * Details for one meeting, with controls to add, edit or remove its bot. Closes on Escape or backdrop click.
 */
export function EventDialog({
    event,
    now,
    onClose,
    saveBotFn,
    removeBotFn,
    setSeriesRecordingFn,
}: {
    event: UpcomingEvent;
    now: Date;
    onClose: () => void;
    setSeriesRecordingFn: SetSeriesRecordingFn;
} & BotActions) {
    useEffect(() => {
        const onKeyDown = (keyEvent: KeyboardEvent) => keyEvent.key === "Escape" && onClose();
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const hasStarted = start <= now;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(clickEvent) => clickEvent.target === clickEvent.currentTarget && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="event-dialog-title"
                className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-background p-5 shadow-lg"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h3 id="event-dialog-title" className="text-base font-semibold">
                            {event.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {formatDay(start)}
                            {!event.isAllDay && ` · ${formatTimeRange(start, end)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {event.meeting_platform ? `${getPlatformLabel(event.meeting_platform)} · ` : ""}
                            {event.calendarLabel}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-secondary"
                    >
                        ✕
                    </button>
                </div>

                {event.meeting_url && (
                    <a
                        href={event.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-fit text-sm text-primary underline underline-offset-2"
                    >
                        Open meeting link
                    </a>
                )}

                {/* Calendar V2: the app, not Recall, decides which meetings get a bot. */}
                <div className="flex flex-col gap-2 rounded-md bg-secondary p-3 text-xs">
                    <span className="font-medium uppercase tracking-wide text-muted-foreground">Recording decision</span>
                    {event.botSource && <span className="font-medium">{BOT_SOURCE_LABELS[event.botSource]}</span>}
                    <span className="text-muted-foreground">{event.ruleReason}</span>
                    {event.isRecurring && !hasStarted && event.meeting_url && (
                        <SeriesRecordingToggle
                            eventId={event.id}
                            enabled={event.seriesRecorded}
                            setSeriesRecordingFn={setSeriesRecordingFn}
                        />
                    )}
                </div>

                <div className="border-t border-border pt-4">
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
                            removeLabel={event.botSource && event.botSource !== "manual" ? "Skip this meeting" : "Remove"}
                            saveBotFn={saveBotFn}
                            removeBotFn={removeBotFn}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
