"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { demoLogin } from "./actions";
import type { DemoAccount } from "@/lib/demo-login";

type State = { message?: string } | undefined;

// The login page's "Try the demo" box: one click signs in as a sample venue
// owner or regular user (see lib/demo-login.ts). The buttons only say which
// demo to use - no email or password is in the page.
export function DemoLoginButtons({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> =>
      demoLogin(formData.get("account") as DemoAccount, callbackUrl),
    undefined
  );

  return (
    // Pale pastel yellow so the demo stands apart from the real login above -
    // softer than the amber kept for hold warnings (see CLAUDE.md).
    <section aria-labelledby="demo-heading" className="rounded-lg bg-yellow-100 p-4">
      <h2 id="demo-heading" className="text-sm font-semibold">
        Try the demo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Explore with a sample account, no sign‑up needed.</p>
      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <Button type="submit" name="account" value="user" variant="outline" disabled={pending} className="w-full bg-card">
          Log in as regular user
        </Button>
        <Button type="submit" name="account" value="owner" variant="outline" disabled={pending} className="w-full bg-card">
          Log in as venue owner
        </Button>
      </form>
      {state?.message && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
    </section>
  );
}
