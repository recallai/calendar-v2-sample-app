"use client";

import { Undo2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export type ResetToRulesFn = (eventId: string) => Promise<{ error?: string }>;

/** Drop a meeting's "always" / "never" choice so the calendar's schedule mode decides again. */
export function UseCalendarRulesButton({ eventId, resetToRulesFn }: { eventId: string; resetToRulesFn: ResetToRulesFn }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string>();
    return (
        <>
            <Button
                variant="outline"
                size="xs"
                disabled={isPending}
                onClick={() =>
                    startTransition(async () => {
                        const result = await resetToRulesFn(eventId);
                        setError(result.error);
                    })
                }
            >
                <Undo2Icon />
                {isPending ? "Applying…" : "Use calendar setting"}
            </Button>
            {error && <span className="text-destructive">{error}</span>}
        </>
    );
}
