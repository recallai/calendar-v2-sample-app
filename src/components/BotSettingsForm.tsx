"use client";

import { useState } from "react";
import type { BotSettings } from "../lib/bot-settings";

const JOIN_EARLY_OPTIONS = [0, 1, 2, 5, 10];

/**
 * Editable bot settings for one meeting: name, how early to join, and a chat message on join.
 */
export function BotSettingsForm({
    initialSettings,
    submitLabel,
    isPending,
    onSubmit,
    onCancel,
}: {
    initialSettings: BotSettings;
    submitLabel: string;
    isPending: boolean;
    onSubmit: (settings: BotSettings) => void;
    onCancel: () => void;
}) {
    const [settings, setSettings] = useState(initialSettings);
    const update = <K extends keyof BotSettings>(key: K, value: BotSettings[K]) =>
        setSettings((current) => ({ ...current, [key]: value }));

    return (
        <form
            className="flex flex-col gap-3 rounded-md border border-border bg-secondary p-3"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit(settings);
            }}
        >
            <label className="flex flex-col gap-1 text-xs font-medium">
                Bot name
                <input
                    required
                    maxLength={100}
                    value={settings.botName}
                    onChange={(event) => update("botName", event.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm font-normal"
                />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium">
                Join
                <select
                    value={settings.joinMinutesEarly}
                    onChange={(event) => update("joinMinutesEarly", Number(event.target.value))}
                    className="w-fit rounded-md border border-input bg-background px-2 py-1 text-sm font-normal"
                >
                    {JOIN_EARLY_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                            {minutes === 0 ? "When the meeting starts" : `${minutes} min early`}
                        </option>
                    ))}
                </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium">
                Chat message when the bot joins (optional)
                <textarea
                    rows={2}
                    maxLength={500}
                    value={settings.chatMessage}
                    onChange={(event) => update("chatMessage", event.target.value)}
                    placeholder="e.g. Hi! I'm recording this meeting to take notes."
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm font-normal"
                />
                <span className="font-normal text-muted-foreground">Sent to everyone on Zoom, Google Meet and Teams.</span>
            </label>

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                    {isPending ? "Saving…" : submitLabel}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-background disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
