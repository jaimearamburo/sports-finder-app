"use client";

import { useActionState, useState, type FormEvent } from "react";
import { login, type LoginFormState } from "./actions";
import { LOGIN_INVALID_INPUT_MESSAGE } from "./utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/lib/validation/auth";

const initialState: LoginFormState = undefined;

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [clientMessage, setClientMessage] = useState<string | null>(null);
  // Controlled so the email survives a failed login (React resets uncontrolled
  // forms after an action). The password is uncontrolled so it clears.
  const [email, setEmail] = useState("");

  // The same schema the action re-checks, run first for instant feedback.
  // noValidate stops the browser's own popups.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const result = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!result.success) {
      e.preventDefault();
      setClientMessage(LOGIN_INVALID_INPUT_MESSAGE);
      return;
    }
    setClientMessage(null);
  }

  const message = clientMessage ?? state?.message;

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Passes the sanitised callbackUrl to the action, which only sees form
          fields. */}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="jane@example.com"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" />
      </div>

      {/* Announced as soon as it appears. */}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}
