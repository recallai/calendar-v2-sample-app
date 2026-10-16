"use client";

import { useState, useTransition } from "react";
import type { ReconcileSummary } from "../lib/recall";
import { RECORDING_RULES, type RecordingRule } from "../lib/recording-rules";

export type SetRecordingRuleFn = (calendarId: string, rule: RecordingRule) => Promise<{ error?: string; summary?: ReconcileSummary }>;

/** e.g. "Added 3 bots, removed 1." */
export function describeReconcileSummary(summary: ReconcileSummary): string {
    const parts = [
        summary.scheduled > 0 && `added ${summary.scheduled} bot${summary.scheduled === 1 ? "" : "s"}`,
        summary.removed > 0 && `removed ${summary.removed}`,
        summary.rescheduled > 0 && `moved ${summary.rescheduled}`,
        summary.failed > 0 && `${summary.failed} failed`,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return "No changes needed.";
    const text = parts.join(", ");
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/**
 * Picks which meetings on a calendar automatically get a bot. Saving applies the rule to upcoming
 * meetings straight away; after that, the calendar.sync_events webhook applies it as meetings change.
 */
export function RecordingRuleSelect({
    calendarId,
    rule,
    setRecordingRuleFn,
}: {
    calendarId: string;
    rule: RecordingRule;
    setRecordingRuleFn: SetRecordingRuleFn;
}) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ text: string; isError: boolean }>();

    const onChange = (nextRule: RecordingRule) => {
        setMessage(undefined);
        startTransition(async () => {
            const result = await setRecordingRuleFn(calendarId, nextRule);
            if (result.error) setMessage({ text: result.error, isError: true });
            else if (result.summary) setMessage({ text: describeReconcileSummary(result.summary), isError: false });
        });
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="flex flex-wrap items-center gap-2 text-xs font-medium">
                Record automatically:
                <select
                    value={rule}
                    disabled={isPending}
                    onChange={(event) => onChange(event.target.value as RecordingRule)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs font-normal disabled:opacity-50"
                >
                    {Object.entries(RECORDING_RULES).map(([value, { label }]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </label>
            <span className="text-xs text-muted-foreground">
                {isPending ? "Applying to upcoming meetings…" : RECORDING_RULES[rule].description}
            </span>
            {message && !isPending && (
                <span className={`text-xs ${message.isError ? "text-destructive" : "text-foreground"}`}>{message.text}</span>
            )}
        </div>
    );
}
