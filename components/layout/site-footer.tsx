import Link from "next/link";
import { Logo } from "@/components/layout/logo";

// Simple stroke-style brand marks, hand-drawn rather than pulled from an
// icon library. lucide-react, already used elsewhere in this app, has no
// Instagram/Facebook/X glyphs in its icon set.
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

// Placeholder footer links. The Privacy Policy, Terms, and Contact pages
// don't exist yet.
const FOOTER_LINKS = [
  { href: "#", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "#", label: "Contact" },
];

const SOCIAL_LINKS = [
  { href: "#", label: "Instagram", icon: <InstagramIcon /> },
  { href: "#", label: "X", icon: <XIcon /> },
  { href: "#", label: "Facebook", icon: <FacebookIcon /> },
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
              aria-label={social.label}
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
