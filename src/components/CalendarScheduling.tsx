import { BotIcon, CalendarCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BotSettings } from "@/lib/bot-settings";
import { SCHEDULE_MODES, type ScheduleMode } from "@/lib/schedule-modes";

function formatSeconds(seconds: number): string {
    return seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`;
}

/**
 * How a calendar schedules bots (Calendar V2's app-managed scheduling) and what those bots are like.
 * Edited with EditCalendarSettingsButton in the card's header.
 */
export function CalendarScheduling({
    scheduleMode,
    botSettings,
}: {
    scheduleMode: ScheduleMode;
    botSettings: BotSettings;
}) {
    return (
        <div className="flex flex-col gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-sm" title={SCHEDULE_MODES[scheduleMode].description}>
                <CalendarCheckIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Schedule a bot:</span>
                <span className="truncate font-medium">{SCHEDULE_MODES[scheduleMode].label}</span>
            </span>

            <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">
                    <BotIcon />
                    {botSettings.botName}
                </Badge>
                <Badge variant="outline">
                    {botSettings.joinMinutesEarly > 0 ? `Joins ${botSettings.joinMinutesEarly} min early` : "Joins on time"}
                </Badge>
                {botSettings.chatMessage && <Badge variant="outline">Chat message</Badge>}
                <Badge variant="outline">Waiting room {formatSeconds(botSettings.waitingRoomTimeout)}</Badge>
                <Badge variant="outline">Leaves after {formatSeconds(botSettings.everyoneLeftTimeout)}</Badge>
            </div>
        </div>
    );
}
