"use client";

import { useState, useTransition } from "react";
import { DEFAULT_BOT_SETTINGS, type BotSettings } from "../lib/bot-settings";
import { BotSettingsForm } from "./BotSettingsForm";

/**
 * Add, edit or remove the bot for one meeting.
 */
export type BotActions = {
    saveBotFn: (eventId: string, settings: BotSettings) => Promise<{ error?: string }>;
    removeBotFn: (eventId: string) => Promise<{ error?: string }>;
};

export function BotControls({
    eventId,
    hasMeetingUrl,
    bot,
    removeLabel = "Remove",
    saveBotFn,
    removeBotFn,
}: {
    eventId: string;
    hasMeetingUrl: boolean;
    bot: BotSettings | null;
    /** e.g. "Skip this meeting" when removing would otherwise be undone by a recording rule. */
    removeLabel?: string;
} & BotActions) {
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string>();

    const run = (action: () => Promise<{ error?: string }>, onSuccess?: () => void) => {
        setError(undefined);
        startTransition(async () => {
            const result = await action();
            if (result.error) setError(result.error);
            else onSuccess?.();
        });
    };

    if (!hasMeetingUrl) {
        return <span className="text-xs text-muted-foreground">No meeting link</span>;
    }

    if (isEditing) {
        return (
            <div className="flex w-full flex-col gap-1">
                <BotSettingsForm
                    initialSettings={bot ?? DEFAULT_BOT_SETTINGS}
                    submitLabel={bot ? "Save bot" : "Add bot"}
                    isPending={isPending}
                    onSubmit={(settings) => run(() => saveBotFn(eventId, settings), () => setIsEditing(false))}
                    onCancel={() => setIsEditing(false)}
                />
                {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-start gap-1">
            {bot ? (
                <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {bot.botName}
                        {bot.joinMinutesEarly > 0 && ` · ${bot.joinMinutesEarly} min early`}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        disabled={isPending}
                        className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => run(() => removeBotFn(eventId))}
                        disabled={isPending}
                        className="rounded-md border border-destructive px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                    >
                        {isPending ? "Removing…" : removeLabel}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-secondary"
                >
                    Add bot
                </button>
            )}
            {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
    );
}
