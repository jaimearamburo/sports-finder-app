"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleUserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAccountLinks, getInitials, getRoleBadge } from "@/lib/account-nav";
import type { UserRole } from "@/generated/prisma/enums";

const MENU_LINK_CLASS = cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-start");

// What the header knows about the signed-in user. Plain values rather than
// the session object, so this Client Component's props stay serialisable
// and the app doesn't need a SessionProvider for a few fields SiteHeader
// already has from auth() on the server.
export type AccountMenuUser = { name: string | null; email: string | null; role: UserRole };

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary">
      {label}
    </span>
  );
}

function Initials({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {text}
    </span>
  );
}

// The header's account control, so it's always visible which account is
// signed in, and as which kind of user.
//
// Signed in: a button showing the user's initials - plus their name and a
// role badge on wider screens (`compact` hides those on phones) - that
// opens a menu with name, email and role, the account links and Log out.
// Signed out: on phones a round icon with Log in / Sign up in the menu (on
// wider screens SiteHeader shows those as plain links instead).
export function AccountMenu({ user, compact = false }: { user: AccountMenuUser | null; compact?: boolean }) {
  // Controlled, not the Popover's own state: SiteHeader stays mounted
  // across client-side navigations, so without closing it on click the
  // menu would still be open over the page it just navigated to.
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  if (!user) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Account menu"
          className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <CircleUserRound className="size-5" />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <Link href="/login" className={MENU_LINK_CLASS} onClick={close}>
            Log in
          </Link>
          <Link href="/signup" className={MENU_LINK_CLASS} onClick={close}>
            Sign up
          </Link>
        </PopoverContent>
      </Popover>
    );
  }

  const displayName = user.name || user.email || "Your account";
  const roleBadge = getRoleBadge(user.role);
  const initials = getInitials(user.name, user.email);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex items-center gap-2 rounded-full hover:bg-muted",
          compact ? "p-0.5" : "py-1 pr-2 pl-1"
        )}
      >
        <Initials text={initials} />
        {/* On phones only the initials show, so screen readers get the
            button's name from hidden text. Not an aria-label: a name that
            leaves out what's visible fails WCAG's "label in name" rule
            (voice-control users say what they see), and the initials are
            purely visual (aria-hidden). On wider screens the visible name
            and role are the button's own text. */}
        {compact && <span className="sr-only">Account menu for {displayName}</span>}
        {!compact && (
          <>
            {/* Long names are cut short with "…" so the header never wraps;
                the full name is in the menu. */}
            <span className="max-w-40 truncate text-sm font-medium">{displayName}</span>
            {roleBadge && <RoleBadge label={roleBadge} />}
            <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="mb-2 border-b px-2 pt-1 pb-3">
          <p className="truncate font-medium">{displayName}</p>
          {user.email && user.email !== displayName && (
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          )}
          {roleBadge && (
            <div className="mt-2">
              <RoleBadge label={roleBadge} />
            </div>
          )}
        </div>
        {getAccountLinks(user.role).map((link) => (
          <Link key={link.href} href={link.href} className={MENU_LINK_CLASS} onClick={close}>
            {link.label}
          </Link>
        ))}
        {/* The logout confirmation page, not an immediate sign-out, same as
            before. */}
        <Link href="/logout" className={MENU_LINK_CLASS} onClick={close}>
          Log out
        </Link>
      </PopoverContent>
    </Popover>
  );
}
