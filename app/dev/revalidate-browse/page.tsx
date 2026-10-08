import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevalidateForm } from "./revalidate-form";

/**
 * TEMPORARY DEV-ONLY TOOL — delete this whole directory once an admin UI
 * manages tags/venues and revalidates on save instead. See actions.ts for
 * why this is safe to keep around only in non-production: `notFound()`
 * here is defense in depth (hides the page even if someone guesses the URL
 * on a deployed build), the actual enforcement is the `NODE_ENV` check in
 * the server action itself.
 */
export default function DevRevalidateBrowsePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle><span className="text-red-500 font-bold">DEV ONLY</span> - Revalidate Browse Cache</CardTitle>
          <CardDescription>
            Clears the cached tag and city lists after a database reseed, so the
            browse page reflects the new data without waiting an hour or
            restarting the dev server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevalidateForm />
        </CardContent>
      </Card>
    </div>
  );
}
