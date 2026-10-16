import { CalendarList } from "../components/CalendarList";
import { CalendarSyncWatcher } from "../components/CalendarSyncWatcher";
import { ConnectGoogleButton } from "../components/ConnectGoogleButton";
import { ConnectMicrosoftButton } from "../components/ConnectMicrosoftButton";
import { StatusBanner } from "../components/StatusBanner";
import { WeekCalendar } from "../components/WeekCalendar";
import { isGoogleConfigured } from "../lib/oauth/google";
import { isMicrosoftConfigured } from "../lib/oauth/microsoft";
import { listCalendars, listUpcomingEvents } from "../lib/recall";

import {
    isCalendarSynced,
    removeBotFromEvent,
    removeCalendar,
    saveBotForEvent,
    setRecordingRule,
    setSeriesRecording,
} from "./action";

export const dynamic = "force-dynamic";

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ connected?: string; error?: string }>;
}) {
    const { connected, error } = await searchParams;
    const calendars = await listCalendars();
    const upcomingEvents = await listUpcomingEvents(calendars, 7);

    const canConnectCalendar = isGoogleConfigured() || isMicrosoftConfigured();

    // ?connected=<id> comes from the OAuth callback. Ignore it if that calendar has since been deleted
    // or disconnected, so a stale link doesn't wait for events that will never arrive.
    const connectedCalendar = calendars.find((calendar) => calendar.id === connected && calendar.status === "connected");

    return (
        <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold">Calendar V2 Demo</h1>
                <p className="text-muted-foreground">Connect a calendar to schedule Recall.ai bots for its meetings.</p>
            </div>
            <StatusBanner
                connected={connectedCalendar && (connectedCalendar.platform_email ?? connectedCalendar.oauth_email ?? connectedCalendar.id)}
                error={error}
            />
            {connectedCalendar && (
                <CalendarSyncWatcher
                    calendarId={connectedCalendar.id}
                    alreadySynced={upcomingEvents.some((event) => event.calendarId === connectedCalendar.id)}
                    isSyncedFn={isCalendarSynced}
                />
            )}
            {canConnectCalendar ? (
                <div className="flex flex-wrap gap-3">
                    <ConnectGoogleButton />
                    <ConnectMicrosoftButton />
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Set the Google or Outlook OAuth variables in .env to connect a calendar.</p>
            )}
            <CalendarList calendars={calendars} removeCalendarFn={removeCalendar} setRecordingRuleFn={setRecordingRule} />
            <WeekCalendar
                events={upcomingEvents}
                saveBotFn={saveBotForEvent}
                removeBotFn={removeBotFromEvent}
                setSeriesRecordingFn={setSeriesRecording}
            />
        </main>
    );
}
