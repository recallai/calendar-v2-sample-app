/**
 * Per-calendar recording rules: Calendar V2's "app-managed scheduling". Recall syncs the events,
 * and this app decides which ones get a bot. Kept free of server imports so client components can use it.
 * https://docs.recall.ai/docs/calendar-integration
 */

export const RECORDING_RULES = {
    manual: {
        label: "Only meetings I pick",
        description: "Bots are only added when you add one to a meeting yourself.",
    },
    all: {
        label: "All meetings",
        description: "Every meeting with a meeting link gets a bot.",
    },
    external: {
        label: "Meetings with external guests",
        description: "Meetings where someone outside your email domain is invited.",
    },
    accepted: {
        label: "Meetings I've accepted",
        description: "Meetings you organize or have accepted.",
    },
} as const;

export type RecordingRule = keyof typeof RECORDING_RULES;

/** Where an event's bot came from: a calendar's rule, a recurring series set to always record, or added by hand. */
export type BotSource = "rule" | "series" | "manual";

/** Calendar metadata key holding the calendar's recording rule. */
export const RECORDING_RULE_METADATA_KEY = "recording_rule";

export function isRecordingRule(value: unknown): value is RecordingRule {
    return typeof value === "string" && value in RECORDING_RULES;
}

/** A calendar's recording rule, from its metadata. Calendars without one only get bots added by hand. */
export function getRecordingRule(metadata: Record<string, unknown> | null | undefined): RecordingRule {
    const rule = metadata?.[RECORDING_RULE_METADATA_KEY];
    return isRecordingRule(rule) ? rule : "manual";
}
