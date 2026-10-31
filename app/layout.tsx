import type { Metadata } from "next";
import { Geist, Oleo_Script } from "next/font/google";
import { BrowseNavigationProvider } from "@/contexts/browse-navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RefreshOnHistoryNavigation } from "@/components/layout/refresh-on-history-navigation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display face for the "PlayBook" wordmark only. Not variable, so weights are
// listed: 400 for "Play", 700 for "Book".
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
        {/* Skip link: the first tab stop, jumping past the header. Hidden until
            focused. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <RefreshOnHistoryNavigation />
        {/* Wraps the header too: the header search takes part in browse
            navigation. */}
        <BrowseNavigationProvider>
          <SiteHeader />
          {/* flex-col so pages laid out as flex-column children (login, signup)
              work. tabIndex={-1} lets the skip link move focus here. */}
          <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
        </BrowseNavigationProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
