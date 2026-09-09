"use client";

import { useActionState } from "react";
import { devResetPassword, type DevResetPasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: DevResetPasswordState = undefined;

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(devResetPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Account email</Label>
        <Input id="email" name="email" type="email" placeholder="jane@example.com" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-emerald-600">Password updated — you can log in with it now.</p>
      )}

      <Button type="submit" aria-disabled={pending}>
        {pending ? "Updating..." : "Set new password"}
      </Button>
    </form>
  );
}
