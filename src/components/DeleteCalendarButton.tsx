"use client";

import { useState, useTransition } from "react";

/**
 * Deletes a calendar from Recall.ai after the user confirms. Its scheduled bots are removed too.
 */
export function DeleteCalendarButton({ calendarId, removeFn }: { calendarId: string; removeFn: (id: string) => Promise<{error?:string}> }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string>();

    const onClick = () => {
        setError(undefined);
        startTransition(async () => {
            const result = await removeFn(calendarId);
            if (result.error) setError(result.error);
        });
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                onClick={onClick}
                disabled={isPending}
                className="rounded-md border border-destructive px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
            >
                {isPending ? "Deleting…" : "Delete"}
            </button>
            {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
    );
}
