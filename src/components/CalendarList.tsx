import type { Calendar } from "../lib/recall";
import { getRecordingRule } from "../lib/recording-rules";
import { DeleteCalendarButton } from "./DeleteCalendarButton";
import { RecordingRuleSelect, type SetRecordingRuleFn } from "./RecordingRuleSelect";


type CalendarListProps = {
  calendars: Calendar[],
  removeCalendarFn: (id: string) => Promise<{error?: string}>
  setRecordingRuleFn: SetRecordingRuleFn
}


/**
 * Calendars connected in the Recall.ai workspace, each with its status, recording rule and a delete button.
 */
export function CalendarList({ calendars, removeCalendarFn, setRecordingRuleFn }: CalendarListProps) {
    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Connected calendars</h2>
            {calendars.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calendars connected yet.</p>
            ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {calendars.map((calendar) =>
                        (
                            <li key={calendar.id} className="flex items-start justify-between gap-4 p-3 text-sm">
                                <div className="flex min-w-0 flex-col gap-2">
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate font-medium">{calendar.platform_email ?? calendar.oauth_email ?? calendar.id}</span>
                                        <span className="text-muted-foreground">{calendar.platform}</span>
                                    </div>
                                    {calendar.status === "connected" && (
                                        <RecordingRuleSelect
                                            calendarId={calendar.id}
                                            rule={getRecordingRule(calendar.metadata)}
                                            setRecordingRuleFn={setRecordingRuleFn}
                                        />
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{calendar.status}</span>
                                    <DeleteCalendarButton calendarId={calendar.id} removeFn={removeCalendarFn} />
                                </div>
                            </li>
                        )
                    )}
                </ul>
            )}
        </section>
    );
}
