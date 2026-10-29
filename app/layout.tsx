import type { Metadata } from "next";
import { Geist, Oleo_Script } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RefreshOnHistoryNavigation } from "@/components/layout/refresh-on-history-navigation";
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
        {/* Skip link: the first thing a keyboard user tabs to, so they can
            jump past the header to the page content instead of tabbing
            through it on every page. Hidden until focused. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <RefreshOnHistoryNavigation />
        <SiteHeader />
        {/* flex flex-col here, not just flex-1, so pages that rely on
            being a flex-column child themselves, such as login and
            signup's centered card layout, keep working. tabIndex={-1} lets
            the skip link above move focus here, not just scroll. */}
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
