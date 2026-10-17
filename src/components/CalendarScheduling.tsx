import { BotIcon, CalendarCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SCHEDULE_MODES } from "@/lib/settings";
import { format_seconds } from "@/lib/utils";
import type { BotSettingsType, ScheduleModeType } from "@/schemas/CalendarSettingsSchema";

/**
 * How a calendar schedules bots (Calendar V2's app-managed scheduling) and what those bots are like.
 * Edited with EditCalendarSettingsButton in the card's footer.
 */
export function CalendarScheduling({
    scheduleMode,
    botSettings,
}: {
    scheduleMode: ScheduleModeType;
    botSettings: BotSettingsType;
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
                <Badge variant="outline">Waiting room {format_seconds(botSettings.waitingRoomTimeout)}</Badge>
                <Badge variant="outline">Leaves after {format_seconds(botSettings.everyoneLeftTimeout)}</Badge>
            </div>
        </div>
    );
}
