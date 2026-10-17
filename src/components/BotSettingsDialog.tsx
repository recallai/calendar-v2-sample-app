"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import type { BotSettingsType, ScheduleModeType } from "@/schemas/CalendarSettingsSchema";
import { BotSettingsForm } from "./BotSettingsForm";

/**
 * A dialog for editing bot settings: a calendar's (with its schedule mode), or one meeting's bot.
 * The form is remounted each time the dialog opens, so it always starts from `initialSettings`.
 */
export function BotSettingsDialog({
    open,
    onOpenChange,
    title,
    description,
    initialSettings,
    initialScheduleMode,
    requireChanges,
    submitLabel,
    isPending,
    error,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    initialSettings: BotSettingsType;
    initialScheduleMode?: ScheduleModeType;
    requireChanges?: boolean;
    submitLabel: string;
    isPending: boolean;
    error?: string;
    onSubmit: (settings: BotSettingsType, scheduleMode?: ScheduleModeType) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {open && (
                    <BotSettingsForm
                        initialSettings={initialSettings}
                        initialScheduleMode={initialScheduleMode}
                        requireChanges={requireChanges}
                        submitLabel={submitLabel}
                        isPending={isPending}
                        error={error}
                        onSubmit={onSubmit}
                        onCancel={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
