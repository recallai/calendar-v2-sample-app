"use client";

import { BotIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { BotSettingsType } from "@/schemas/CalendarSettingsSchema";
import { BotSettingsDialog } from "./BotSettingsDialog";

/**
 * Add, edit or remove the bot for one meeting.
 */
export type BotActions = {
    saveBotFn: (eventId: string, settings: BotSettingsType) => Promise<{ error?: string }>;
    removeBotFn: (eventId: string) => Promise<{ error?: string }>;
};

export function BotControls({
    eventId,
    hasMeetingUrl,
    bot,
    defaultSettings,
    removeLabel = "Remove",
    saveBotFn,
    removeBotFn,
}: {
    eventId: string;
    hasMeetingUrl: boolean;
    bot: BotSettingsType | null;
    /** Where a new bot's settings start from: the meeting's calendar's bot settings. */
    defaultSettings: BotSettingsType;
    /** e.g. "Skip this meeting" when removing would otherwise be undone by the calendar's setting. */
    removeLabel?: string;
} & BotActions) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, startSaving] = useTransition();
    const [isRemoving, startRemoving] = useTransition();
    const [error, setError] = useState<string>();
    const [formError, setFormError] = useState<string>();

    if (!hasMeetingUrl) {
        return <p className="text-sm text-muted-foreground">This meeting has no meeting link, so a bot can&apos;t join.</p>;
    }

    const openEditor = () => {
        setFormError(undefined);
        setIsEditing(true);
    };

    const save = (settings: BotSettingsType) => {
        setFormError(undefined);
        startSaving(async () => {
            const result = await saveBotFn(eventId, settings);
            if (result.error) setFormError(result.error);
            else setIsEditing(false);
        });
    };

    const remove = () => {
        setError(undefined);
        startRemoving(async () => {
            const result = await removeBotFn(eventId);
            if (result.error) setError(result.error);
        });
    };

    return (
        <div className="flex flex-col items-start gap-2">
            {bot ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Badge>
                        <BotIcon />
                        {bot.botName}
                        {bot.joinMinutesEarly > 0 && ` · ${bot.joinMinutesEarly} min early`}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={openEditor} disabled={isRemoving}>
                        <PencilIcon />
                        Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={remove} disabled={isRemoving}>
                        <Trash2Icon />
                        {isRemoving ? "Removing…" : removeLabel}
                    </Button>
                </div>
            ) : (
                <Button size="sm" onClick={openEditor}>
                    <PlusIcon />
                    Add bot
                </Button>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <BotSettingsDialog
                open={isEditing}
                onOpenChange={setIsEditing}
                title={bot ? "Edit this meeting's bot" : "Add a bot to this meeting"}
                description={
                    bot
                        ? "Changes apply to this meeting only."
                        : "Starts from this calendar's bot settings. The meeting will always get a bot, whatever the calendar's setting."
                }
                initialSettings={bot ?? defaultSettings}
                submitLabel={bot ? "Save bot" : "Add bot"}
                requireChanges={!!bot}
                isPending={isSaving}
                error={formError}
                onSubmit={save}
            />
        </div>
    );
}
