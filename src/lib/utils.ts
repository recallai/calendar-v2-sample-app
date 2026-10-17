export { cn } from "cn";

/** A duration for display, e.g. 2 -> "2 sec", 1200 -> "20 min". */
export function format_seconds(seconds: number): string {
    return seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`;
}
