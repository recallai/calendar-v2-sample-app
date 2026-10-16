import type { ReconcileSummary } from "@/lib/recall";

/** What applying a calendar's setting changed, e.g. "Sent 3 bots, removed 1." */
export function describeReconcileSummary(summary: ReconcileSummary): string {
    const parts = [
        summary.scheduled > 0 && `sent ${summary.scheduled} bot${summary.scheduled === 1 ? "" : "s"}`,
        summary.removed > 0 && `removed ${summary.removed}`,
        summary.rescheduled > 0 && `moved ${summary.rescheduled}`,
        summary.failed > 0 && `${summary.failed} failed`,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return "Applied to upcoming meetings: no changes needed.";
    const text = parts.join(", ");
    return `Applied to upcoming meetings: ${text}.`;
}
