"use client";

import { useActionState, useState, type ChangeEvent, type FormEvent } from "react";
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
  // Controlled, so the fields survive a server-side error: React resets an
  // uncontrolled form after its action runs, which wiped everything typed
  // when the server said e.g. "an account with this email already exists".
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

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
      {/* Each error has an id its input points at (aria-describedby), so a
          screen reader reads out *why* a field is invalid when it's
          focused, not just that it is. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          {...field("name")}
          placeholder="Jane Smith"
          autoFocus
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? "name-error" : undefined}
        />
        {errors?.name && (
          <p id="name-error" className="text-sm text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          {...field("email")}
          type="email"
          placeholder="jane@example.com"
          aria-invalid={!!errors?.email}
          aria-describedby={errors?.email ? "email-error" : undefined}
        />
        {errors?.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          {...field("password")}
          type="password"
          aria-invalid={!!errors?.password}
          aria-describedby={errors?.password ? "password-error" : undefined}
        />
        {errors?.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password}
          </p>
        )}
      </div>

      {/* role="alert": a form-wide message has no field to be attached to,
          so it's announced as soon as it appears instead. */}
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Sign up"}
      </Button>
    </form>
  );
}
