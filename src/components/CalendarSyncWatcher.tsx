"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 2_000;
/** Stop checking after this long, e.g. for a calendar that really has no events. */
const POLL_TIMEOUT_MS = 60_000;

/** The current URL without the ?connected=<id> the OAuth callback added. */
function urlWithoutConnectedParam(): string {
    const url = new URL(window.location.href);
    url.searchParams.delete("connected");
    return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * After a calendar connects, Recall loads its events in the background, so the first page load can be empty.
 * This checks every few seconds until the calendar has events, then reloads the page data to show them.
 *
 * Once it's done (or there was nothing to wait for), it removes ?connected=<id> from the URL so later
 * re-renders, such as after deleting that calendar, don't start checking again.
 */
export function CalendarSyncWatcher({
    calendarId,
    alreadySynced,
    isSyncedFn,
}: {
    calendarId: string;
    /** The page already has events for this calendar, so there's nothing to wait for. */
    alreadySynced: boolean;
    isSyncedFn: (calendarId: string) => Promise<boolean>;
}) {
    const router = useRouter();
    const [status, setStatus] = useState<"syncing" | "done" | "timed_out">(alreadySynced ? "done" : "syncing");

    // The page re-renders with a new isSyncedFn reference, so keep the latest one in a ref rather than
    // restarting the polling whenever it changes.
    const isSyncedFnRef = useRef(isSyncedFn);
    isSyncedFnRef.current = isSyncedFn;

    useEffect(() => {
        if (alreadySynced) {
            // Nothing to wait for. Drop the param without reloading the page.
            window.history.replaceState(window.history.state, "", urlWithoutConnectedParam());
            return;
        }

        let cancelled = false;
        const startedAt = Date.now();

        const poll = async () => {
            while (!cancelled && Date.now() - startedAt < POLL_TIMEOUT_MS) {
                if (await isSyncedFnRef.current(calendarId)) {
                    if (!cancelled) {
                        setStatus("done");
                        // Navigating to the URL without the param also reloads the page data with the new events.
                        router.replace(urlWithoutConnectedParam(), { scroll: false });
                    }
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            }
            if (!cancelled) {
                setStatus("timed_out");
                window.history.replaceState(window.history.state, "", urlWithoutConnectedParam());
            }
        };
        poll();

        return () => {
            cancelled = true;
        };
    }, [calendarId, alreadySynced, router]);

    if (alreadySynced || status === "done") {
        return null;
    }
    if (status === "timed_out") {
        return (
            <p className="rounded-md border border-border bg-secondary p-3 text-sm text-muted-foreground">
                No events found yet. If your calendar has meetings, refresh in a minute.
            </p>
        );
    }
    return (
        <p className="flex items-center gap-2 rounded-md border border-border bg-secondary p-3 text-sm">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Loading events from your calendar…
        </p>
    );
}
