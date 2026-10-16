"use client";

import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Deletes a calendar from Recall.ai after the user confirms. Its scheduled bots are removed too.
 */
export function DeleteCalendarButton({
    calendarId,
    label,
    removeFn,
}: {
    calendarId: string;
    /** Shown in the confirmation, e.g. the calendar's email. */
    label: string;
    removeFn: (id: string) => Promise<{ error?: string }>;
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string>();

    const confirm = () => {
        setError(undefined);
        startTransition(async () => {
            const result = await removeFn(calendarId);
            if (result.error) setError(result.error);
            else setOpen(false);
        });
    };

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                // Stay open while the delete is in flight.
                if (isPending) return;
                setOpen(next);
                if (next) setError(undefined);
            }}
        >
            <Button
                variant="destructive"
                size="icon-sm"
                aria-label="Delete calendar"
                title="Delete calendar"
                onClick={() => setOpen(true)}
            >
                <Trash2Icon />
            </Button>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                        <Trash2Icon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete this calendar?</AlertDialogTitle>
                    <AlertDialogDescription>
                        <span className="font-medium text-foreground">{label}</span> will be disconnected from Recall, and
                        bots scheduled for its upcoming meetings will be removed. You can connect it again later.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={confirm} disabled={isPending}>
                        {isPending ? "Deleting…" : "Delete calendar"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
