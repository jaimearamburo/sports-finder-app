"use client";

import { useActionState, useState, type ChangeEvent, type FormEvent } from "react";
import { signup, type SignupErrors, type SignupFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupSchema } from "@/lib/validation/auth";
import { getFieldErrors } from "@/lib/validation/field-errors";

const initialState: SignupFormState = undefined;

export function SignupForm() {
  // formAction calls `signup` with the previous state and updates
  // `state`/`pending` on each submit.
  const [state, formAction, pending] = useActionState(signup, initialState);
  const [clientErrors, setClientErrors] = useState<SignupErrors | null>(null);
  // Controlled so the fields survive a server error (React resets uncontrolled
  // forms after an action).
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  // The action's schema, run first for instant feedback; the action
  // re-validates. noValidate stops the browser's own popups.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const result = signupSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!result.success) {
      e.preventDefault();
      setClientErrors(getFieldErrors(result.error));
      return;
    }
    setClientErrors(null);
  }

  // A fresh client-side failure wins; otherwise show the server's last errors
  // (e.g. "email already exists").
  const errors = clientErrors ?? state?.errors;

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Each error has an id its input references (aria-describedby), so
          screen readers say why a field is invalid. */}
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

      {/* A form-wide message has no field, so it's announced on appearance. */}
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
