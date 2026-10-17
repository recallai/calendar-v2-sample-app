import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";

/**
 * Shows the ?error=<code> the OAuth callback passes back to the home page when connecting a calendar
 * fails. A successful connection is shown as a toast instead (see ConnectedToast).
 */
export function StatusBanner({ error }: { error?: string }) {
    if (!error) return null;
    return (
        <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Couldn&apos;t connect calendar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    );
}
