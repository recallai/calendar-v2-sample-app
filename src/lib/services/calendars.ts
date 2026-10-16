import { deleteCalendarRow } from "@/db/queries";
import { deleteCalendar } from "@/lib/recall";

/**
 * Delete (disconnect) a calendar in Recall.ai and forget its settings and overrides. Recall immediately
 * unschedules bots for its future meetings, and doesn't send a calendar.update webhook since the delete
 * was initiated by us. Decision history is kept.
 * https://docs.recall.ai/docs/scheduling-guide#disconnectingdeleting-a-calendar
 */
export async function deleteCalendarAndState(calendarId: string): Promise<void> {
    await deleteCalendar(calendarId);
    await deleteCalendarRow(calendarId);
    console.log(`Calendar deleted: calendar_id=${calendarId}`);
}
