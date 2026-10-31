import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { HeaderSearch, HeaderSearchFallback } from "@/components/layout/header-search";
import { AccountMenu, type AccountMenuUser } from "@/components/layout/account-menu";

/**
 * Global header: logo, search and account actions. A Server Component so auth()
 * decides the links on the server, with no signed-out/signed-in flicker. No
 * cart: bookings are checked out one at a time (one active hold per user).
 */
export async function SiteHeader() {
  const session = await auth();
  const user: AccountMenuUser | null = session
    ? { name: session.user.name ?? null, email: session.user.email ?? null, role: session.user.role }
    : null;

  return (
    // will-change-transform promotes the sticky header to its own layer up
    // front, avoiding a stutter when scrolling starts.
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-card will-change-transform">
      {/* From md up the first column, gap and padding match BrowsePageShell's
          sidebar so the search box lines up with the tag chips; keep them in
          sync. Below md the header keeps its compact layout. */}
      <div className="mx-auto grid h-17 max-w-[1800px] grid-cols-[auto_minmax(0,640px)_auto] items-center gap-4 px-4 sm:gap-5 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)_auto] md:gap-x-8">
        <Logo />

        {/* HeaderSearch reads useSearchParams, which needs a Suspense boundary. */}
        <Suspense fallback={<HeaderSearchFallback />}>
          <HeaderSearch />
        </Suspense>

        <div className="flex items-center justify-self-end gap-2">
          {/* Below md (the app's mobile cutoff) there's only room for a round
              account button beside the search box: initials signed in, an icon
              signed out. From md up the button adds name and role, and
              signed-out visitors get Log in / Sign up links. */}
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
