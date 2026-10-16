import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Calendar V2 Demo",
    description: "Connect a calendar and schedule Recall.ai bots for calendar events",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className="min-h-screen antialiased">{children}</body>
        </html>
    );
}
