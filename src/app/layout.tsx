import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
    title: "Calendar V2 Demo",
    description: "Connect a calendar and schedule Recall.ai bots for calendar events",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={cn("font-sans", geist.variable)}>
            <body className="min-h-screen antialiased">
                {children}
                {/* The app only has a light theme, so don't follow the OS's dark mode. */}
                <Toaster position="top-right" theme="light" />
            </body>
        </html>
    );
}
