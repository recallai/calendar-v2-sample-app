"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * After the OAuth callback redirects back with ?connected=<id>, show a toast instead of a banner, then
 * drop the param from the URL so a page refresh doesn't show it again. While Recall is still connecting
 * the calendar, the toast offers a refresh.
 */
export function ConnectedToast({ calendarId, label, isConnecting }: { calendarId: string; label: string; isConnecting: boolean }) {
    const router = useRouter();

    useEffect(() => {
        // A fixed id keeps React's dev-mode double effect (or a re-render) from stacking duplicate toasts.
        const id = `calendar-connected-${calendarId}`;
        if (isConnecting) {
            toast.loading(`Connecting ${label}…`, {
                id,
                description: "Recall is still setting up this calendar, so its meetings may not show yet.",
                action: { label: "Refresh", onClick: () => router.refresh() },
            });
        } else {
            toast.success("Calendar connected", { id, description: label });
        }

        const url = new URL(window.location.href);
        if (!isConnecting && url.searchParams.has("connected")) {
            url.searchParams.delete("connected");
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        }
    }, [calendarId, label, isConnecting, router]);

    return null;
}
