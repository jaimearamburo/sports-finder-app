"use client";

import { useActionState } from "react";
import { devRevalidateBrowse, type DevRevalidateBrowseState } from "./actions";
import { Button } from "@/components/ui/button";

const initialState: DevRevalidateBrowseState = undefined;

export function RevalidateForm() {
  const [state, formAction, pending] = useActionState(devRevalidateBrowse, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.success && <p className="text-sm text-emerald-600">Cache cleared — refresh the browse page.</p>}

      <Button type="submit" aria-disabled={pending}>
        {pending ? "Revalidating..." : "Revalidate tags and cities"}
      </Button>
    </form>
  );
}
