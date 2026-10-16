"use client";

import { useState, useTransition } from "react";
import type { ReconcileSummary } from "../lib/recall";
import { describeReconcileSummary } from "./RecordingRuleSelect";

export type SetSeriesRecordingFn = (eventId: string, enabled: boolean) => Promise<{ error?: string; summary?: ReconcileSummary }>;

/**
 * "Always record this series" for a recurring meeting. Applies to every upcoming occurrence.
 */
export function SeriesRecordingToggle({
    eventId,
    enabled,
    setSeriesRecordingFn,
}: {
    eventId: string;
    enabled: boolean;
    setSeriesRecordingFn: SetSeriesRecordingFn;
}) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ text: string; isError: boolean }>();

    const onChange = (next: boolean) => {
        setMessage(undefined);
        startTransition(async () => {
            const result = await setSeriesRecordingFn(eventId, next);
            if (result.error) setMessage({ text: result.error, isError: true });
            else if (result.summary) setMessage({ text: describeReconcileSummary(result.summary), isError: false });
        });
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={enabled} disabled={isPending} onChange={(event) => onChange(event.target.checked)} />
                Always record this recurring series
            </label>
            {isPending && <span className="text-xs text-muted-foreground">Updating upcoming occurrences…</span>}
            {message && !isPending && (
                <span className={`text-xs ${message.isError ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</span>
            )}
        </div>
    );
}
