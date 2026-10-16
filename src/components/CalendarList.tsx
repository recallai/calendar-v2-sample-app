import type { ReactNode } from "react";
import { CalendarIcon, CalendarOffIcon, CalendarPlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { BotSettings } from "@/lib/bot-settings";
import type { ScheduleMode } from "@/lib/schedule-modes";
import type { Calendar } from "@/lib/recall";
import { getCalendarPlatformLabel } from "./calendar-format";
import { CalendarScheduling } from "./CalendarScheduling";
import { EditCalendarSettingsButton, type SaveCalendarSettingsFn } from "./EditCalendarSettingsButton";
import { DeleteCalendarButton } from "./DeleteCalendarButton";
import { RefreshButton } from "./RefreshButton";


type CalendarListProps = {
  calendars: Calendar[],
  removeCalendarFn: (id: string) => Promise<{error?: string}>
  /** Each calendar's schedule mode and bot settings, from the local database. */
  scheduleModeByCalendar: Record<string, ScheduleMode>
  botSettingsByCalendar: Record<string, BotSettings>
  saveCalendarSettingsFn: SaveCalendarSettingsFn
  /** Shown across from the title, e.g. the connect buttons. */
  actions?: ReactNode
}

/** Cards per row on wide screens. Empty slots in the last row are shown as placeholders. */
const COLUMNS = 3;

const STATUS_VARIANTS = {
    connected: "secondary",
    connecting: "outline",
    disconnected: "destructive",
} as const;


/**
 * Calendars connected in the Recall.ai workspace, each with its status, how it schedules bots, and a delete button.
 */
export function CalendarList({ calendars, removeCalendarFn, scheduleModeByCalendar, botSettingsByCalendar, saveCalendarSettingsFn, actions }: CalendarListProps) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Connected calendars</h2>
                {actions}
            </div>
            {calendars.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <CalendarOffIcon />
                        </EmptyMedia>
                        <EmptyTitle>No calendars connected</EmptyTitle>
                        <EmptyDescription>
                            Connect a Google Calendar or Microsoft Outlook calendar, then choose which of its meetings get a bot.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {calendars.map((calendar) => (
                        <Card key={calendar.id} size="sm">
                            <CardHeader>
                                <CardTitle className="flex min-w-0 items-center gap-2">
                                    <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{calendar.platform_email ?? calendar.oauth_email ?? calendar.id}</span>
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 whitespace-nowrap">
                                    {getCalendarPlatformLabel(calendar.platform)}
                                    <Badge variant={STATUS_VARIANTS[calendar.status]}>{calendar.status}</Badge>
                                </CardDescription>
                            </CardHeader>
                            {calendar.status === "connected" && (
                                <CardContent>
                                    <CalendarScheduling
                                        scheduleMode={scheduleModeByCalendar[calendar.id] ?? "none"}
                                        botSettings={botSettingsByCalendar[calendar.id]}
                                    />
                                </CardContent>
                            )}
                            <CardFooter className="mt-auto justify-end gap-2">
                                {calendar.status === "connecting" && <RefreshButton />}
                                {calendar.status === "connected" && (
                                    <EditCalendarSettingsButton
                                        calendarId={calendar.id}
                                        scheduleMode={scheduleModeByCalendar[calendar.id] ?? "none"}
                                        botSettings={botSettingsByCalendar[calendar.id]}
                                        saveCalendarSettingsFn={saveCalendarSettingsFn}
                                    />
                                )}
                                <DeleteCalendarButton
                                    calendarId={calendar.id}
                                    label={calendar.platform_email ?? calendar.oauth_email ?? calendar.id}
                                    removeFn={removeCalendarFn}
                                />
                            </CardFooter>
                        </Card>
                    ))}
                    {Array.from({ length: (COLUMNS - (calendars.length % COLUMNS)) % COLUMNS }, (_, i) => (
                        <div
                            key={`placeholder-${i}`}
                            aria-hidden
                            className="hidden min-h-32 items-center justify-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground/50 lg:flex"
                        >
                            <CalendarPlusIcon className="size-5" />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
