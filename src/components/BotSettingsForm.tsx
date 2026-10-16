"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { BotSettings } from "@/lib/bot-settings";
import { SCHEDULE_MODES, type ScheduleMode } from "@/lib/schedule-modes";
import { OptionSelect, type Option } from "./OptionSelect";

const SCHEDULE_MODE_OPTIONS: Option<ScheduleMode>[] = Object.entries(SCHEDULE_MODES).map(([value, { label }]) => ({
    value: value as ScheduleMode,
    label,
}));

const JOIN_EARLY_OPTIONS: Option<number>[] = [0, 1, 2, 5, 10].map((minutes) => ({
    value: minutes,
    label: minutes === 0 ? "When the meeting starts" : `${minutes} min early`,
}));

function formatDuration(seconds: number): string {
    return seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`;
}

/** Seconds. Recall's defaults are 20 minutes for both: https://docs.recall.ai/docs/automatic-leaving-behavior */
const WAITING_TIMEOUT_OPTIONS: Option<number>[] = [300, 600, 1200, 1800, 3600].map((seconds) => ({
    value: seconds,
    label: formatDuration(seconds),
}));

/** Seconds. Recall's default is 2 seconds, which can leave before people rejoin after a dropout. */
const EVERYONE_LEFT_OPTIONS: Option<number>[] = [2, 30, 60, 300].map((seconds) => ({
    value: seconds,
    label: formatDuration(seconds),
}));

/**
 * Editable bot settings: name, how early to join, a chat message on join, and when the bot leaves on
 * its own. Rendered inside a dialog (see BotSettingsDialog), for a calendar or one meeting's bot.
 *
 * - `initialScheduleMode` adds the calendar's "Schedule a bot" select at the top.
 * - `requireChanges` keeps Save disabled until something differs from the initial values.
 */
export function BotSettingsForm({
    initialSettings,
    initialScheduleMode,
    requireChanges = false,
    submitLabel,
    isPending,
    error,
    onSubmit,
    onCancel,
}: {
    initialSettings: BotSettings;
    initialScheduleMode?: ScheduleMode;
    requireChanges?: boolean;
    submitLabel: string;
    isPending: boolean;
    error?: string;
    onSubmit: (settings: BotSettings, scheduleMode?: ScheduleMode) => void;
    onCancel: () => void;
}) {
    const id = useId();
    const [settings, setSettings] = useState(initialSettings);
    const [scheduleMode, setScheduleMode] = useState(initialScheduleMode);
    const update = <K extends keyof BotSettings>(key: K, value: BotSettings[K]) =>
        setSettings((current) => ({ ...current, [key]: value }));

    const hasChanges =
        scheduleMode !== initialScheduleMode ||
        (Object.keys(initialSettings) as (keyof BotSettings)[]).some((key) => settings[key] !== initialSettings[key]);

    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit(settings, scheduleMode);
            }}
        >
            {scheduleMode && (
                <>
                    <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-mode`}>Schedule a bot</Label>
                        <OptionSelect
                            id={`${id}-mode`}
                            value={scheduleMode}
                            options={SCHEDULE_MODE_OPTIONS}
                            onChange={setScheduleMode}
                            className="w-full sm:w-80"
                        />
                        <p className="text-xs text-muted-foreground">{SCHEDULE_MODES[scheduleMode].description}</p>
                    </div>
                    <Separator />
                    <p className="-mb-2 text-sm font-medium">Bot</p>
                </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-name`}>Bot name</Label>
                    <Input
                        id={`${id}-name`}
                        required
                        maxLength={100}
                        value={settings.botName}
                        onChange={(event) => update("botName", event.target.value)}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-join`}>Join</Label>
                    <OptionSelect
                        id={`${id}-join`}
                        value={settings.joinMinutesEarly}
                        options={JOIN_EARLY_OPTIONS}
                        onChange={(value) => update("joinMinutesEarly", value)}
                        className="w-full"
                    />
                </div>
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor={`${id}-chat`}>Chat message when the bot joins</Label>
                <Textarea
                    id={`${id}-chat`}
                    rows={2}
                    maxLength={500}
                    value={settings.chatMessage}
                    onChange={(event) => update("chatMessage", event.target.value)}
                    placeholder="Optional, e.g. Hi! I'm recording this meeting to take notes."
                />
                <p className="text-xs text-muted-foreground">Sent to everyone on Zoom, Google Meet and Teams.</p>
            </div>

            <Separator />

            <div className="grid gap-3">
                <div>
                    <p className="text-sm font-medium">Leave automatically</p>
                    <p className="text-xs text-muted-foreground">When the bot gives up or leaves the call on its own.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-waiting`} className="text-xs font-normal text-muted-foreground">
                            Not let in from the waiting room after
                        </Label>
                        <OptionSelect
                            id={`${id}-waiting`}
                            value={settings.waitingRoomTimeout}
                            options={WAITING_TIMEOUT_OPTIONS}
                            onChange={(value) => update("waitingRoomTimeout", value)}
                            className="w-full"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-noone`} className="text-xs font-normal text-muted-foreground">
                            Nobody else joins after
                        </Label>
                        <OptionSelect
                            id={`${id}-noone`}
                            value={settings.nooneJoinedTimeout}
                            options={WAITING_TIMEOUT_OPTIONS}
                            onChange={(value) => update("nooneJoinedTimeout", value)}
                            className="w-full"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-left`} className="text-xs font-normal text-muted-foreground">
                            After everyone else leaves, wait
                        </Label>
                        <OptionSelect
                            id={`${id}-left`}
                            value={settings.everyoneLeftTimeout}
                            options={EVERYONE_LEFT_OPTIONS}
                            onChange={(value) => update("everyoneLeftTimeout", value)}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isPending || (requireChanges && !hasChanges)}>
                    {isPending ? "Saving…" : submitLabel}
                </Button>
            </DialogFooter>
        </form>
    );
}
