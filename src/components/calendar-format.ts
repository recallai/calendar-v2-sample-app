/**
 * Display helpers for the week calendar. All times are formatted in the viewer's timezone.
 */

const PLATFORM_LABELS: Record<string, string> = {
    zoom: "Zoom",
    google_meet: "Google Meet",
};

/** Readable label for a meeting_platform value, e.g. "google_meet" -> "Google Meet". */
export function getPlatformLabel(platform: string): string {
    return (
        PLATFORM_LABELS[platform] ??
        platform
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
    );
}

export function formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatTimeRange(start: Date, end: Date): string {
    return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDay(date: Date): string {
    return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

/** Local calendar date as YYYY-MM-DD, for comparing against all-day event dates. */
export function toDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight of the given date. */
export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
