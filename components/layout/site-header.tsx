import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { HeaderSearch } from "@/components/layout/header-search";
import { UserMenu } from "@/components/layout/user-menu";
import { getAccountLinkInfo } from "@/lib/account-nav";

/**
 * Global site header: brand link, search, and auth-aware actions. An
 * async Server Component, not a Client Component, because it needs
 * auth() to decide which links to show. That call reads the session
 * cookie server-side, so there is no loading flicker between logged-out
 * and logged-in states the way a client-side useSession() version would
 * have.
 *
 * The search box and cart button are visual only.
 */
export async function SiteHeader() {
  // Reads the current session from the request cookie.
  const session = await auth();
  const accountLink = session ? getAccountLinkInfo(session.user.role) : null;

  return (
    // [will-change:transform] hints the browser to promote this sticky
    // element to its own GPU compositing layer at paint time instead of
    // lazily on the first scroll gesture - that lazy promotion is a real,
    // common cause of a brief stutter right as scrolling starts, since
    // allocating the layer competes with the scroll's own first frames.
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-card will-change-transform">
      {/* From md up, the first column and gap match BrowsePageShell's
          sidebar (200px column, gap-8) and the side padding matches too,
          so the search box starts exactly where the browse page's tag
          chips start. Keep the two in sync if either changes. Below md
          the browse page has no sidebar, so the header keeps its compact
          logo / search / actions layout. */}
      <div className="mx-auto grid h-17 max-w-[1800px] grid-cols-[auto_minmax(0,640px)_auto] items-center gap-4 px-4 sm:gap-5 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)_auto] md:gap-x-8">
        <Logo />

        <HeaderSearch />

        <div className="flex items-center justify-self-end gap-2">
          <Button variant="ghost" size="icon" aria-label="Cart" className="relative rounded-full">
            <ShoppingCart className="size-5" />
          </Button>

          {/* Below md (the same mobile cutoff BrowsePageShell and
              MobileFilterBar use, so the "mobile" boundary stays one
              width across the app), the full Dashboard/Log out or
              Log in/Sign up links don't fit next to a usable search box.
              UserMenu collapses them into one round avatar button that
              opens a small menu instead. */}
          <div className="md:hidden">
            <UserMenu role={session?.user.role ?? null} />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {session && accountLink ? (
              <>
                <Link href={accountLink.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  {accountLink.label}
                </Link>
                {/* Links to the logout confirmation page rather than
                    signing out directly. */}
                <Link href="/logout" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Log out
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Log in
                </Link>
                <Link href="/signup" className={buttonVariants({ variant: "default", size: "sm" })}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
