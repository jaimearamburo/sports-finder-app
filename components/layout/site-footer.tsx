import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { GITHUB_URL, LINKEDIN_URL } from "@/lib/site-links";

// Brand marks drawn inline: lucide-react, used elsewhere in this app, has no
// brand icons. Paths from Simple Icons (CC0).
function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

// The author's profiles (external, so they open in a new tab).
const SOCIAL_LINKS = [
  { href: GITHUB_URL, label: "GitHub", icon: <GitHubIcon /> },
  { href: LINKEDIN_URL, label: "LinkedIn", icon: <LinkedInIcon /> },
];

// Compact on purpose: only what's useful, in two short bands. Top band:
// the logo and the social icons share a row on phones (logo left, icons
// right) with the links on the row below; from md up all three sit on one
// row - logo left, links centre, icons right. Bottom bar: the copyright and
// the credit, split left and right (stacking only on the narrowest
// phones). Tap targets are 40px on phones.
export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      {/* Same max-w as site-header.tsx, kept in sync so the header/footer
          bars and the page content between them all line up at the same
          edges regardless of viewport width. */}
      <div className="mx-auto grid max-w-[1800px] grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] md:py-5 lg:px-8">
        <Logo size="sm" />

        <div className="flex gap-2 justify-self-end md:order-3">
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${social.label} (opens in a new tab)`}
              className="grid size-10 place-items-center rounded-full border border-input text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground md:size-9"
            >
              {social.icon}
            </a>
          ))}
        </div>

        <nav
          aria-label="Footer"
          className="col-span-2 -ml-1 flex flex-wrap gap-x-5 text-sm text-muted-foreground md:order-2 md:col-span-1 md:ml-0"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="inline-flex min-h-10 items-center px-1 hover:text-foreground hover:underline md:min-h-6 md:px-0"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-[1800px] flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} PlayBook</p>
          <p>Designed and built by Jaime Aramburo</p>
        </div>
      </div>
    </footer>
  );
}
