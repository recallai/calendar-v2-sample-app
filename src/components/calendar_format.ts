/**
 * Display helpers for the week calendar. All times are formatted in the viewer's timezone.
 */

const PLATFORM_LABELS: Record<string, string> = {
    zoom: "Zoom",
    google_meet: "Google Meet",
};

/** Readable label for a meeting_platform value, e.g. "google_meet" -> "Google Meet". */
export function get_platform_label(platform: string): string {
    return (
        PLATFORM_LABELS[platform] ??
        platform
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
    );
}

export function format_time(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function format_time_range(start: Date, end: Date): string {
    return `${format_time(start)} – ${format_time(end)}`;
}

export function format_day(date: Date): string {
    return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

/** Local midnight of the given date. */
export function start_of_day(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function add_days(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

const CALENDAR_PLATFORM_LABELS: Record<string, string> = {
    google_calendar: "Google Calendar",
    microsoft_outlook: "Microsoft Outlook",
};

/** e.g. "google_calendar" -> "Google Calendar" */
export function get_calendar_platform_label(platform: string): string {
    return CALENDAR_PLATFORM_LABELS[platform] ?? platform;
}
