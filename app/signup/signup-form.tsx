"use client";

import { useActionState, useState, type FormEvent } from "react";
import { signup, type SignupErrors, type SignupFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupSchema } from "@/lib/validation/auth";
import { getFieldErrors } from "@/lib/validation/field-errors";

// `useActionState` needs a starting value for state before the form has
// ever been submitted, matching the `undefined` branch of SignupFormState.
const initialState: SignupFormState = undefined;

export function SignupForm() {
  // `formAction`, not the raw `signup` function, is wired to the form's
  // `action` prop. React intercepts submissions through it so it can call
  // `signup` with the previous state and update `state`/`pending` on each
  // submit automatically.
  const [state, formAction, pending] = useActionState(signup, initialState);
  const [clientErrors, setClientErrors] = useState<SignupErrors | null>(null);

  // Runs the exact schema the server action uses, before anything is sent,
  // so obvious mistakes get the same messages instantly with no round
  // trip. Only a convenience - the action re-validates regardless. The
  // form is `noValidate` so the browser's own required/type="email"
  // popups don't fire first with different wording; this is the single
  // client-side check.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const result = signupSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!result.success) {
      e.preventDefault();
      setClientErrors(getFieldErrors(result.error));
      return;
    }
    setClientErrors(null);
  }

  // A fresh client-side failure wins; otherwise show whatever the server
  // last returned (e.g. "email already exists," which only it can know).
  const errors = clientErrors ?? state?.errors;

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Jane Smith" autoFocus aria-invalid={!!errors?.name} />
        {errors?.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="jane@example.com"
          aria-invalid={!!errors?.email}
        />
        {errors?.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" aria-invalid={!!errors?.password} />
        {errors?.password && <p className="text-sm text-destructive">{errors.password}</p>}
      </div>

      {state?.message && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Sign up"}
      </Button>
    </form>
  );
}
