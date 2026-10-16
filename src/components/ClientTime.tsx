"use client";

/**
 * A timestamp in the viewer's timezone. The server may render in a different timezone, so the
 * hydration mismatch on this text is expected.
 */
export function ClientTime({ value }: { value: Date | string }) {
    const date = new Date(value);
    return (
        <time dateTime={date.toISOString()} suppressHydrationWarning>
            {date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}
        </time>
    );
}
