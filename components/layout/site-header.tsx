import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";

/**
 * Global site header — brand link, search, and auth-aware actions. An
 * async Server Component (not a Client Component) because it needs
 * `auth()` to decide which links to show; that call reads the session
 * cookie server-side, so there's no loading flicker between "logged out"
 * and "logged in" states the way a client-side `useSession()` version
 * would have.
 *
 * The search box and cart button are visual only for now.
 */
export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b">
      <div className="mx-auto grid h-17 max-w-[1800px] grid-cols-[auto_minmax(0,640px)_auto] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />

        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search courts, classes, campsites…"
            className="h-11 rounded-xl bg-muted/40 pl-10"
          />
        </div>

        <div className="flex items-center justify-self-end gap-2">
          <Button variant="ghost" size="icon" aria-label="Cart" className="relative rounded-full">
            <ShoppingCart className="size-5" />
          </Button>

          {session ? (
            <>
              <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Dashboard
              </Link>
              {/* Links to the test logout page with confirmation rather than signing out
                  directly — signOut()  for now. */}
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
    </header>
  );
}
