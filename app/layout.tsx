import type { Metadata } from "next";
import { Geist, Oleo_Script } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Wordmark-only display face for the "PlayBook" logo (see SiteHeader and
// SiteFooter). Not a variable font, so the weights it renders have to be
// requested explicitly. 400 renders "Play", 700 renders "Book".
const oleoScript = Oleo_Script({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-oleo-script",
});

export const metadata: Metadata = {
  title: "PlayBook",
  description: "Find and book courts, classes, and campsites near you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.className} ${oleoScript.variable} h-full antialiased`}>
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        {/* flex flex-col here, not just flex-1, so pages that rely on
            being a flex-column child themselves, such as login and
            signup's centered card layout, keep working. */}
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
