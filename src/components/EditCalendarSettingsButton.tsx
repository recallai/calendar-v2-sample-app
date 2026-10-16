"use client";

import { PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BotSettings } from "@/lib/bot-settings";
import type { ReconcileSummary } from "@/lib/recall";
import type { ScheduleMode } from "@/lib/schedule-modes";
import { BotSettingsDialog } from "./BotSettingsDialog";
import { describeReconcileSummary } from "./reconcile-summary";

export type SaveCalendarSettingsFn = (
    calendarId: string,
    settings: { scheduleMode: ScheduleMode; botSettings: BotSettings },
) => Promise<{ error?: string; summary?: ReconcileSummary }>;

/**
 * Edits how a calendar schedules bots and what those bots are like, in a dialog. A changed schedule mode
 * is applied to upcoming meetings straight away; after that, the calendar.sync_events webhook applies it
 * as meetings change.
 */
export function EditCalendarSettingsButton({
    calendarId,
    scheduleMode,
    botSettings,
    saveCalendarSettingsFn,
}: {
    calendarId: string;
    scheduleMode: ScheduleMode;
    botSettings: BotSettings;
    saveCalendarSettingsFn: SaveCalendarSettingsFn;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, startSaving] = useTransition();
    const [formError, setFormError] = useState<string>();

    const save = (nextBotSettings: BotSettings, nextScheduleMode?: ScheduleMode) => {
        setFormError(undefined);
        startSaving(async () => {
            const response = await saveCalendarSettingsFn(calendarId, {
                scheduleMode: nextScheduleMode ?? scheduleMode,
                botSettings: nextBotSettings,
            });
            if (response.error) {
                setFormError(response.error);
                return;
            }
            setIsEditing(false);
            toast.success("Calendar settings saved", {
                description: response.summary ? describeReconcileSummary(response.summary) : undefined,
            });
        });
    };

    return (
        <>
            <Button
                variant="outline"
                size="icon-sm"
                aria-label="Edit calendar settings"
                title="Edit calendar settings"
                onClick={() => {
                    setFormError(undefined);
                    setIsEditing(true);
                }}
            >
                <PencilIcon />
            </Button>
            <BotSettingsDialog
                open={isEditing}
                onOpenChange={setIsEditing}
                title="Calendar settings"
                description="Choose which meetings automatically get a bot, and what those bots are like. Bots already scheduled keep their current settings."
                initialSettings={botSettings}
                initialScheduleMode={scheduleMode}
                requireChanges
                submitLabel="Save"
                isPending={isSaving}
                error={formError}
                onSubmit={save}
            />
        </>
    );
}
