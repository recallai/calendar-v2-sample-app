/**
 * Shows the result of the OAuth flow: `connected` is the label (e.g. email) of the calendar that was just
 * connected, and `error` is the ?error=<code> the callback passed back to the home page.
 */
export function StatusBanner({ connected, error }: { connected?: string; error?: string }) {
    if (connected) {
        return <p className="rounded-md border border-border bg-secondary p-3 text-sm">Calendar connected: {connected}</p>;
    }
    if (error) {
        return (
            <p className="rounded-md border border-destructive p-3 text-sm text-destructive">
                Couldn&apos;t connect calendar: {error}
            </p>
        );
    }
    return null;
}
