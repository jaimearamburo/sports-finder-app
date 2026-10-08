"use client";

import { useActionState } from "react";
import { signup, type SignupFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// `useActionState` needs a starting value for state before the form has
// ever been submitted — matches the `undefined` branch of SignupFormState.
const initialState: SignupFormState = undefined;

export function SignupForm() {
  // `formAction` (not the raw `signup` function) is what gets wired to the
  // form's `action` prop — React intercepts submissions through it so it
  // can call `signup` with the previous state and update `state`/`pending`
  // for us on each submit, without us managing that by hand.
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Jane Smith" required />
        {state?.errors?.name && (
          <p className="text-sm text-destructive">{state.errors.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="jane@example.com" required />
        {state?.errors?.email && (
          <p className="text-sm text-destructive">{state.errors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        {/* `minLength` here is just an early client-side hint — actions.ts
            re-checks length server-side, which is the check that actually
            matters since a client can always skip/bypass HTML validation. */}
        <Input id="password" name="password" type="password" required minLength={8} />
        {state?.errors?.password && (
          <p className="text-sm text-destructive">{state.errors.password}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Sign up"}
      </Button>
    </form>
  );
}
