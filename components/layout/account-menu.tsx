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

// Plain values rather than the session, so props stay serialisable and no
// SessionProvider is needed.
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

// The header's account control, so it's always clear which account is signed
// in.
//
// Signed in: initials (plus name and role badge from md up; `compact` hides
// them) opening a menu with name, email, role, account links and Log out.
// Signed out, on phones: an icon with Log in / Sign up in the menu (SiteHeader
// shows plain links on wider screens).
export function AccountMenu({ user, compact = false }: { user: AccountMenuUser | null; compact?: boolean }) {
  // Controlled so it closes on navigation: SiteHeader stays mounted across
  // client-side navigations.
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
        {/* On phones only the initials (aria-hidden) show, so the name comes
            from hidden text. Not aria-label: a name that omits visible text
            fails WCAG "label in name". */}
        {compact && <span className="sr-only">Account menu for {displayName}</span>}
        {!compact && (
          <>
            {/* Long names are truncated so the header never wraps; the full
                name is in the menu. */}
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
        {/* Goes to the logout confirmation page. */}
        <Link href="/logout" className={MENU_LINK_CLASS} onClick={close}>
          Log out
        </Link>
      </PopoverContent>
    </Popover>
  );
}
