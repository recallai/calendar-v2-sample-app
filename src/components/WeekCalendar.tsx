"use client";

import { ZapIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { UpcomingEvent } from "../lib/recall";
import type { BotActions } from "./BotControls";
import { addDays, formatTime, startOfDay, toDateKey } from "./calendar-format";
import { EventDialog } from "./EventDialog";
import type { ResetToRulesFn } from "./UseCalendarRulesButton";

const DAYS = 7;
const HOUR_HEIGHT = 48;
/** Hours always shown, widened to fit any earlier or later meetings. */
const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 18;
/** Short meetings still get a clickable block. */
const MIN_EVENT_MINUTES = 20;

type PositionedEvent = { event: UpcomingEvent; start: Date; end: Date; lane: number; lanes: number };

/**
 * Lay out one day's meetings: overlapping meetings share the column side by side, like Google Calendar.
 */
function layoutDay(events: UpcomingEvent[]): PositionedEvent[] {
    const items = events
        .map((event) => ({ event, start: new Date(event.start_time), end: new Date(event.end_time), lane: 0, lanes: 1 }))
        .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

    let cluster: PositionedEvent[] = [];
    let laneEnds: number[] = [];
    let clusterEnd = 0;
    const finishCluster = () => cluster.forEach((item) => (item.lanes = laneEnds.length));

    for (const item of items) {
        // A meeting starting after everything in the current group ends starts a new group.
        if (item.start.getTime() >= clusterEnd && cluster.length > 0) {
            finishCluster();
            cluster = [];
            laneEnds = [];
        }
        const freeLane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start.getTime());
        item.lane = freeLane === -1 ? laneEnds.length : freeLane;
        laneEnds[item.lane] = item.end.getTime();
        clusterEnd = Math.max(cluster.length > 0 ? clusterEnd : 0, item.end.getTime());
        cluster.push(item);
    }
    finishCluster();
    return items;
}

function eventClassName(event: UpcomingEvent, hasEnded: boolean): string {
    const base =
        "overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight shadow-xs transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
    const state = event.bot
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : event.meeting_url
          ? "border border-primary/40 bg-background text-foreground hover:bg-muted"
          : "border border-dashed border-muted-foreground/60 bg-background text-muted-foreground hover:bg-muted";
    return `${base} ${state} ${hasEnded ? "opacity-50" : ""}`;
}

/**
 * A 7-day calendar starting today. Click a meeting to add, edit or remove its bot.
 * Rendered only in the browser so days and times use the viewer's timezone.
 */
export function WeekCalendar({
    events,
    saveBotFn,
    removeBotFn,
    resetToRulesFn,
}: { events: UpcomingEvent[]; resetToRulesFn: ResetToRulesFn } & BotActions) {
    const [now, setNow] = useState<Date | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        setNow(new Date());
        const interval = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(interval);
    }, []);

    const heading = (
        <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold">Next 7 days</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm bg-primary" /> Bot scheduled
                </span>
                <span className="flex items-center gap-1.5">
                    <ZapIcon className="size-3 text-amber-500" /> Sent by calendar setting
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm border border-primary/40" /> No bot
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm border border-dashed border-muted-foreground/60" /> No meeting link
                </span>
            </div>
        </div>
    );

    if (!now) {
        return (
            <section className="flex flex-col gap-3">
                {heading}
                <Skeleton className="h-96 rounded-xl" />
            </section>
        );
    }

    const today = startOfDay(now);
    const days = Array.from({ length: DAYS }, (_, index) => addDays(today, index));

    const timed = events.filter((event) => !event.isAllDay);
    const timedByDay = days.map((day) => {
        const next = addDays(day, 1);
        return timed.filter((event) => {
            const start = new Date(event.start_time);
            return start >= day && start < next;
        });
    });
    const allDayByDay = days.map((day) => {
        const key = toDateKey(day);
        return events.filter(
            (event) => event.isAllDay && event.allDayStart && event.allDayEnd && event.allDayStart <= key && key < event.allDayEnd,
        );
    });

    // Fit the visible hours to this week's meetings.
    let firstHour = DEFAULT_FIRST_HOUR;
    let lastHour = DEFAULT_LAST_HOUR;
    for (const event of timedByDay.flat()) {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        firstHour = Math.min(firstHour, start.getHours());
        const endsNextDay = startOfDay(end).getTime() !== startOfDay(start).getTime();
        lastHour = Math.max(lastHour, endsNextDay ? 24 : Math.ceil(end.getHours() + end.getMinutes() / 60));
    }
    const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
    const gridHeight = hours.length * HOUR_HEIGHT;
    const minutesToPx = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;

    const selected = events.find((event) => event.id === selectedId) ?? null;
    const hasAnyEvents = timedByDay.some((day) => day.length > 0) || allDayByDay.some((day) => day.length > 0);
    const hasAllDayEvents = allDayByDay.some((day) => day.length > 0);

    return (
        <section className="flex flex-col gap-3">
            {heading}
            <Card className="overflow-x-auto py-0">
                <div className="min-w-[720px]">
                    {/* Day headers */}
                    <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border">
                        <div />
                        {days.map((day) => {
                            const isToday = day.getTime() === today.getTime();
                            return (
                                <div key={day.toISOString()} className="flex flex-col items-center gap-1 py-2">
                                    <span className={`text-xs font-medium uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                                        {day.toLocaleDateString(undefined, { weekday: "short" })}
                                    </span>
                                    <span
                                        className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                                            isToday ? "bg-primary text-primary-foreground" : ""
                                        }`}
                                    >
                                        {day.getDate()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* All-day events */}
                    {hasAllDayEvents && (
                        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border">
                            <div className="py-1 pr-2 text-right text-[10px] text-muted-foreground">all-day</div>
                            {allDayByDay.map((dayEvents, index) => (
                                <div key={index} className="flex flex-col gap-1 border-l border-border p-1">
                                    {dayEvents.map((event) => (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={() => setSelectedId(event.id)}
                                            className={eventClassName(event, false)}
                                        >
                                            <span className="block truncate font-medium">
                                                    {event.botSource === "rule" && <ZapIcon className="mr-0.5 inline size-3 align-[-1px] text-amber-300" />}
                                                    {event.title}
                                                </span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Time grid */}
                    <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                        <div className="relative" style={{ height: gridHeight }}>
                            {hours.map((hour, index) => (
                                <span
                                    key={hour}
                                    className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                                    style={{ top: index * HOUR_HEIGHT }}
                                >
                                    {index === 0 ? "" : formatTime(new Date(2000, 0, 1, hour)).replace(":00", "")}
                                </span>
                            ))}
                        </div>

                        {days.map((day, dayIndex) => {
                            const isToday = day.getTime() === today.getTime();
                            const gridStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), firstHour);
                            const nowOffset = (now.getTime() - gridStart.getTime()) / 60_000;

                            return (
                                <div key={day.toISOString()} className="relative border-l border-border" style={{ height: gridHeight }}>
                                    {hours.map((hour, index) => (
                                        <div
                                            key={hour}
                                            className="absolute inset-x-0 border-t border-border"
                                            style={{ top: index * HOUR_HEIGHT }}
                                        />
                                    ))}

                                    {layoutDay(timedByDay[dayIndex]).map(({ event, start, end, lane, lanes }) => {
                                        const dayEnd = addDays(day, 1);
                                        const visibleEnd = end > dayEnd ? dayEnd : end;
                                        const top = minutesToPx((start.getTime() - gridStart.getTime()) / 60_000);
                                        const durationMinutes = Math.max(
                                            (visibleEnd.getTime() - start.getTime()) / 60_000,
                                            MIN_EVENT_MINUTES,
                                        );
                                        const height = minutesToPx(durationMinutes) - 2;
                                        return (
                                            <button
                                                key={event.id}
                                                type="button"
                                                onClick={() => setSelectedId(event.id)}
                                                title={event.title}
                                                className={`absolute ${eventClassName(event, end <= now)}`}
                                                style={{
                                                    top: top + 1,
                                                    height,
                                                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                                                    width: `calc(${100 / lanes}% - 4px)`,
                                                }}
                                            >
                                                <span className="block truncate font-medium">
                                                    {event.botSource === "rule" && <ZapIcon className="mr-0.5 inline size-3 align-[-1px] text-amber-300" />}
                                                    {event.title}
                                                </span>
                                                {height >= 32 && (
                                                    <span className="block truncate opacity-80">
                                                        {formatTime(start)} – {formatTime(end)}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {isToday && nowOffset >= 0 && nowOffset <= hours.length * 60 && (
                                        <div
                                            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                                            style={{ top: minutesToPx(nowOffset) }}
                                        >
                                            <span className="-ml-1.5 h-3 w-3 rounded-full bg-destructive" />
                                            <span className="h-0.5 flex-1 bg-destructive" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {!hasAnyEvents && <p className="text-sm text-muted-foreground">No meetings in the next 7 days.</p>}

            {selected && (
                <EventDialog
                    event={selected}
                    now={now}
                    onClose={() => setSelectedId(null)}
                    saveBotFn={saveBotFn}
                    removeBotFn={removeBotFn}
                    resetToRulesFn={resetToRulesFn}
                />
            )}
        </section>
    );
}

