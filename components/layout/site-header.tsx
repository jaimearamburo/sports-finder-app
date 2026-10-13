import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";

/**
 * Global site header: brand link, search, and auth-aware actions. An
 * async Server Component, not a Client Component, because it needs
 * auth() to decide which links to show. That call reads the session
 * cookie server-side, so there is no loading flicker between logged-out
 * and logged-in states the way a client-side useSession() version would
 * have.
 *
 * The search box and cart button are visual only for now.
 */
export async function SiteHeader() {
  const session = await auth();

  return (
    // [will-change:transform] hints the browser to promote this sticky
    // element to its own GPU compositing layer at paint time instead of
    // lazily on the first scroll gesture - that lazy promotion is a real,
    // common cause of a brief stutter right as scrolling starts, since
    // allocating the layer competes with the scroll's own first frames.
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-card will-change-transform">
      <div className="mx-auto grid h-17 max-w-[1800px] grid-cols-[auto_minmax(0,640px)_auto] items-center gap-4 px-4 sm:gap-5 sm:px-6 lg:px-8">
        <Logo />

        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Ask anything..."
            className="h-11 rounded-xl bg-muted/40 pl-10"
          />
        </div>

        <div className="flex items-center justify-self-end gap-2">
          <Button variant="ghost" size="icon" aria-label="Cart" className="relative rounded-full">
            <ShoppingCart className="size-5" />
          </Button>

          {/* Below md (the same mobile cutoff BrowsePageShell/
              MobileFilterBar use, so the whole page's "mobile" boundary
              stays one width, not several), the full Dashboard/Log out or
              Log in/Sign up links don't fit next to a usable search box -
              UserMenu collapses them into one round avatar button that
              opens a small menu instead. */}
          <div className="md:hidden">
            <UserMenu loggedIn={!!session} />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {session ? (
              <>
                <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Dashboard
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
