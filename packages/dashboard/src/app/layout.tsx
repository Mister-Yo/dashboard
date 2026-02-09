import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Company Dashboard",
  description: "AI-centric company management portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${space.variable} ${jetbrains.variable} flex min-h-screen bg-[var(--background)] text-[var(--foreground)]`}
      >
        <Sidebar />
        <main className="flex-1 p-4 pt-16 lg:p-6 lg:pt-6 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
