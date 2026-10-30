"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAccountLinks } from "@/lib/account-nav";
import type { UserRole } from "@/generated/prisma/enums";

const MENU_LINK_CLASS = cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-start");

// Mobile-only (see SiteHeader) stand-in for the Log in/Sign up or
// account/Log out links, which don't fit next to a usable search box on
// a narrow phone. Takes a plain `role` (or null, if logged out) rather
// than the full session object - SiteHeader already resolves the real
// session server-side via auth(), and this is the only piece of it any
// of this menu's rendering actually depends on. Passing just that value
// down keeps this Client Component's props trivially serializable and
// avoids introducing this app's first SessionProvider/useSession() for
// what's a single derived value.
export function UserMenu({ role }: { role: UserRole | null }) {
  // A controlled open state, not the Popover's own uncontrolled default -
  // SiteHeader lives in the root layout, which stays mounted across
  // client-side navigations, so this component (and whatever open state
  // it held) survives a click through to /login or /signup too. Without
  // explicitly closing it on click, the popover would still be sitting
  // open over the page it just navigated to.
  const [open, setOpen] = useState(false);
  const accountLinks = role ? getAccountLinks(role) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Account menu"
        className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
      >
        <CircleUserRound className="size-5" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        {accountLinks ? (
          <>
            {accountLinks.map((link) => (
              <Link key={link.href} href={link.href} className={MENU_LINK_CLASS} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            {/* Links to the logout confirmation page rather than signing
                out directly, same as the desktop header's own link. */}
            <Link href="/logout" className={MENU_LINK_CLASS} onClick={() => setOpen(false)}>
              Log out
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className={MENU_LINK_CLASS} onClick={() => setOpen(false)}>
              Log in
            </Link>
            <Link href="/signup" className={MENU_LINK_CLASS} onClick={() => setOpen(false)}>
              Sign up
            </Link>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
