import type { CalendarSettingsType, ScheduleModeType } from "../schemas/CalendarSettingsSchema";

/**
 * Calendar V2's "app-managed scheduling": Recall syncs each calendar's events and sends
 * calendar.sync_events webhooks; this app decides which meetings get a bot based on the calendar's mode.
 * Kept free of server imports so client components can use it, and imported with relative paths from
 * db/schema.ts so drizzle-kit can load it.
 * https://docs.recall.ai/docs/calendar-integration
 */
export const SCHEDULE_MODES: Record<ScheduleModeType, { label: string; description: string }> = {
    none: {
        label: "Manually",
        description: "No bots are sent automatically. You can still add one to a meeting by hand.",
    },
    all: {
        label: "Every meeting",
        description: "Every meeting with a meeting link gets a bot.",
    },
    organized: {
        label: "When I organized it",
        description: "Meetings you organized.",
    },
    external: {
        label: "When there are external guests",
        description: "Meetings where someone outside your email domain is invited.",
    },
    internal: {
        label: "When there are only internal guests",
        description: "Meetings with other people from your email domain, and no one from outside it.",
    },
};

/** A calendar's settings until the user saves their own. */
export const DEFAULT_CALENDAR_SETTINGS: CalendarSettingsType = {
    scheduleMode: "none",
    botSettings: {
        botName: "Recall Notetaker",
        joinMinutesEarly: 0,
        chatMessage: "",
        waitingRoomTimeout: 1200,
        nooneJoinedTimeout: 1200,
        everyoneLeftTimeout: 2,
    },
};
