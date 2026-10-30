import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { HeaderSearch, HeaderSearchFallback } from "@/components/layout/header-search";
import { AccountMenu, type AccountMenuUser } from "@/components/layout/account-menu";

/**
 * Global site header: brand link, search, and auth-aware actions. An
 * async Server Component, not a Client Component, because it needs
 * auth() to decide which links to show. That call reads the session
 * cookie server-side, so there is no loading flicker between logged-out
 * and logged-in states the way a client-side useSession() version would
 * have.
 *
 * The search box runs natural-language search (see HeaderSearch and
 * app/search/actions.ts). There's no cart: a booking is checked out one at
 * a time (one active hold per user), so a basket would have nothing to do.
 */
export async function SiteHeader() {
  // Reads the current session from the request cookie.
  const session = await auth();
  const user: AccountMenuUser | null = session
    ? { name: session.user.name ?? null, email: session.user.email ?? null, role: session.user.role }
    : null;

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

        {/* Suspense: HeaderSearch reads the URL (useSearchParams) to show the
            current search, which needs a boundary in this Next version. */}
        <Suspense fallback={<HeaderSearchFallback />}>
          <HeaderSearch />
        </Suspense>

        <div className="flex items-center justify-self-end gap-2">
          {/* Below md (the same mobile cutoff BrowsePageShell and
              MobileFilterBar use, so the "mobile" boundary stays one width
              across the app), there's only room for a round button next to
              a usable search box: initials when signed in, an icon when not.
              From md up, a signed-in user's button also shows their name
              and role, and signed-out visitors get plain Log in / Sign up
              links. Either way the account links live in AccountMenu. */}
          <div className="md:hidden">
            <AccountMenu user={user} compact />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <AccountMenu user={user} />
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
