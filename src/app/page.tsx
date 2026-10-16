import { CalendarClockIcon } from "lucide-react";
import { ActivityFeed } from "../components/ActivityFeed";
import { Badge } from "@/components/ui/badge";
import { CalendarList } from "../components/CalendarList";
import { ConnectGoogleButton } from "../components/ConnectGoogleButton";
import { ConnectMicrosoftButton } from "../components/ConnectMicrosoftButton";
import { ConnectedToast } from "../components/ConnectedToast";
import { StatusBanner } from "../components/StatusBanner";
import { WeekCalendar } from "../components/WeekCalendar";

import { listRecentBotDecisions, listRecentWebhookEvents, upsertCalendars } from "@/db/queries";
import type { BotSettings } from "@/lib/bot-settings";
import type { ScheduleMode } from "@/lib/schedule-modes";
import { isGoogleConfigured } from "@/lib/oauth/google";
import { isMicrosoftConfigured } from "@/lib/oauth/microsoft";
import { getCalendarBotSettings, listCalendars, listUpcomingEvents } from "@/lib/recall";

import {
    removeBotFromEvent,
    removeCalendar,
    resetToCalendarSetting,
    saveBotForEvent,
    saveCalendarSettings,
} from "./action";

export const dynamic = "force-dynamic";

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ connected?: string; error?: string }>;
}) {
    const { connected, error } = await searchParams;
    const calendars = await listCalendars();

    // Keep the local copies of Recall's calendars current, then load this app's state for them.
    const calendarRows = await upsertCalendars(calendars);
    const [upcomingEvents, webhookEvents, decisions] = await Promise.all([
        listUpcomingEvents(calendars, 7),
        listRecentWebhookEvents(20),
        listRecentBotDecisions(30),
    ]);

    const scheduleModeByCalendar: Record<string, ScheduleMode> = Object.fromEntries(
        calendarRows.map((row) => [row.id, row.scheduleMode]),
    );
    const botSettingsByCalendar: Record<string, BotSettings> = Object.fromEntries(
        calendarRows.map((row) => [row.id, getCalendarBotSettings(row)]),
    );
    const calendarLabels: Record<string, string> = Object.fromEntries(
        calendars.map((calendar) => [calendar.id, calendar.platform_email ?? calendar.oauth_email ?? calendar.id]),
    );

    const canConnectCalendar = isGoogleConfigured() || isMicrosoftConfigured();

    // ?connected=<id> comes from the OAuth callback. Ignore it if that calendar has since been deleted or
    // disconnected, so a stale link doesn't show a toast.
    const connectedCalendar = calendars.find((calendar) => calendar.id === connected && calendar.status !== "disconnected");

    return (
        <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <CalendarClockIcon className="size-5" />
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight">Calendar V2 Demo</h1>
                    <Badge variant="secondary">Recall.ai</Badge>
                </div>
                <p className="text-muted-foreground">
                    Connect a calendar, choose which meetings get a bot, and watch the app schedule them as your calendar changes.
                </p>
            </header>
            {connectedCalendar && (
                <ConnectedToast
                    calendarId={connectedCalendar.id}
                    label={connectedCalendar.platform_email ?? connectedCalendar.oauth_email ?? connectedCalendar.id}
                    isConnecting={connectedCalendar.status === "connecting"}
                />
            )}
            <StatusBanner error={error} />
            <CalendarList
                calendars={calendars}
                removeCalendarFn={removeCalendar}
                scheduleModeByCalendar={scheduleModeByCalendar}
                botSettingsByCalendar={botSettingsByCalendar}
                saveCalendarSettingsFn={saveCalendarSettings}
                actions={
                    canConnectCalendar ? (
                        <div className="flex flex-wrap gap-2">
                            <ConnectGoogleButton />
                            <ConnectMicrosoftButton />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Set the Google or Outlook OAuth variables in .env to connect a calendar.</p>
                    )
                }
            />
            <WeekCalendar
                events={upcomingEvents}
                saveBotFn={saveBotForEvent}
                removeBotFn={removeBotFromEvent}
                resetToRulesFn={resetToCalendarSetting}
            />
            <ActivityFeed webhookEvents={webhookEvents} decisions={decisions} calendarLabels={calendarLabels} />
        </main>
    );
}
