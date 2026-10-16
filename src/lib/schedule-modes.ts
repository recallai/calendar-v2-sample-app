import { z } from "zod";

/**
 * How a calendar schedules bots: Calendar V2's "app-managed scheduling". Recall syncs each calendar's
 * events and sends calendar.sync_events webhooks; this app decides which meetings get a bot based on
 * the calendar's mode. Kept free of server imports so client components can use it.
 * https://docs.recall.ai/docs/calendar-integration
 */
export const SCHEDULE_MODES = {
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
} as const;

export type ScheduleMode = keyof typeof SCHEDULE_MODES;
export const SCHEDULE_MODE_KEYS = Object.keys(SCHEDULE_MODES) as [ScheduleMode, ...ScheduleMode[]];
export const DEFAULT_SCHEDULE_MODE: ScheduleMode = "none";

export const ScheduleModeSchema = z.enum(SCHEDULE_MODE_KEYS);

/** A per-meeting choice that beats the calendar's mode: always or never send a bot. */
export type MeetingOverride = "dispatch" | "skip";

/** Where an event's bot came from: the calendar's schedule mode, or added by hand. */
export type BotSource = "rule" | "manual";
