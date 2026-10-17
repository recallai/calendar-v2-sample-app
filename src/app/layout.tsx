import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/Sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
    title: "Calendar V2 Demo",
    description: "Connect a calendar and schedule Recall.ai bots for calendar events",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={cn("font-sans", geist.variable)}>
            <body className="min-h-screen antialiased">
                {children}
                <Toaster position="top-right" />
            </body>
        </html>
    );
}
