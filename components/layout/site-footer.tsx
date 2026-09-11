import Link from "next/link";
import { Logo } from "@/components/layout/logo";

// Simple stroke-style brand marks, hand-drawn rather than pulled from an
// icon library — lucide-react (already used elsewhere) dropped brand/logo
// glyphs from its icon set, so there's no Instagram/Facebook mark to
// import.
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

// Placeholder footer links: Privacy Policy/Terms/Contact pages, these pages don't existe yet.
const FOOTER_LINKS = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms" },
  { href: "#", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      {/* Same max-w as site-header.tsx — kept in sync so the header/footer
          bars and the page content between them all line up at the same
          edges regardless of viewport width. */}
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <Logo size="sm" />

        <nav className="flex gap-5 text-sm text-muted-foreground">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-foreground hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex gap-3">
          <a
            href="#"
            aria-label="Instagram"
            className="grid size-8 place-items-center rounded-full border border-input text-muted-foreground hover:text-foreground"
          >
            <InstagramIcon />
          </a>
          <a
            href="#"
            aria-label="X"
            className="grid size-8 place-items-center rounded-full border border-input text-muted-foreground hover:text-foreground"
          >
            <XIcon />
          </a>
          <a
            href="#"
            aria-label="Facebook"
            className="grid size-8 place-items-center rounded-full border border-input text-muted-foreground hover:text-foreground"
          >
            <FacebookIcon />
          </a>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-[1800px] justify-end px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} PlayBook — Jaime Aramburo
          </p>
        </div>
      </div>
    </footer>
  );
}
