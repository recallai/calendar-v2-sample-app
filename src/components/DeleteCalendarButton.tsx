"use client";

import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/Dialog";

/**
 * Deletes a calendar from Recall.ai after the user confirms. Its scheduled bots are removed too.
 * Uses a regular dialog rather than an alert dialog, so clicking outside it or pressing Escape cancels.
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
        <Dialog
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
            <DialogContent showCloseButton={false}>
                <DialogHeader className="flex-row items-start gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                        <Trash2Icon className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <DialogTitle>Delete this calendar?</DialogTitle>
                        <DialogDescription>
                            <span className="font-medium text-foreground">{label}</span> will be disconnected from Recall,
                            and bots scheduled for its upcoming meetings will be removed. You can connect it again later.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                    <DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
                    <Button variant="destructive" onClick={confirm} disabled={isPending}>
                        {isPending ? "Deleting…" : "Delete calendar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
