import { CalendarClockIcon } from "lucide-react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CalendarList } from "@/components/CalendarList";
import { ConnectedToast } from "@/components/ConnectedToast";
import { ConnectGoogleButton } from "@/components/ConnectGoogleButton";
import { ConnectMicrosoftButton } from "@/components/ConnectMicrosoftButton";
import { StatusBanner } from "@/components/StatusBanner";
import { Badge } from "@/components/ui/Badge";
import { WeekCalendar } from "@/components/WeekCalendar";
import { bot_decisions_list } from "@/db/queries";
import { is_google_configured } from "@/lib/oauth/google";
import { is_microsoft_configured } from "@/lib/oauth/microsoft";
import { calendars_list, get_calendar_label } from "@/lib/recall";
import { load_scheduling_contexts, upcoming_events_list } from "@/lib/scheduling";
import type { BotSettingsType, ScheduleModeType } from "@/schemas/CalendarSettingsSchema";
import { follow_schedule_mode, remove_calendar, remove_meeting_bot_action, save_calendar_settings, save_meeting_bot } from "./action";

export const dynamic = "force-dynamic";

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ connected?: string; error?: string }>;
}) {
    const { connected, error } = await searchParams;
    const calendars = await calendars_list();

    // Load this app's settings and overrides for each calendar.
    const contexts = await load_scheduling_contexts({ calendars });
    const [upcomingEvents, decisions] = await Promise.all([
        upcoming_events_list({ contexts, days: 7 }),
        bot_decisions_list({ limit: 30 }),
    ]);

    const scheduleModeByCalendar: Record<string, ScheduleModeType> = Object.fromEntries(
        [...contexts].map(([calendarId, { settings }]) => [calendarId, settings.scheduleMode]),
    );
    const botSettingsByCalendar: Record<string, BotSettingsType> = Object.fromEntries(
        [...contexts].map(([calendarId, { settings }]) => [calendarId, settings.botSettings]),
    );

    const canConnectCalendar = is_google_configured() || is_microsoft_configured();

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
                    label={get_calendar_label(connectedCalendar)}
                    isConnecting={connectedCalendar.status === "connecting"}
                />
            )}
            <StatusBanner error={error} />
            <CalendarList
                calendars={calendars}
                removeCalendarFn={remove_calendar}
                scheduleModeByCalendar={scheduleModeByCalendar}
                botSettingsByCalendar={botSettingsByCalendar}
                saveCalendarSettingsFn={save_calendar_settings}
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
                saveBotFn={save_meeting_bot}
                removeBotFn={remove_meeting_bot_action}
                followScheduleModeFn={follow_schedule_mode}
            />
            <ActivityFeed decisions={decisions} />
        </main>
    );
}
