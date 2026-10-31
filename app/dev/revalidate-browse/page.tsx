import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevalidateForm } from "./revalidate-form";

/**
 * Development-only tool (see actions.ts). notFound() hides the page on deployed
 * builds; the action's NODE_ENV check is the real safeguard.
 */
export default function DevRevalidateBrowsePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1><span className="text-red-500 font-bold">DEV ONLY</span> - Revalidate Browse Cache</h1>
          </CardTitle>
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
