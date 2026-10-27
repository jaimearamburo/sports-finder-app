import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * TEMPORARY DEV-ONLY TOOL. Delete this whole directory once a real
 * forgot-password flow exists. See actions.ts for why this is safe to
 * keep around only in non-production: `notFound()` here is defense in
 * depth, hiding the page even if someone guesses the URL on a deployed
 * build, while the actual enforcement is the `NODE_ENV` check in the
 * server action itself, since that is what would run the real password
 * change.
 */
export default function DevResetPasswordPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1><span className="text-red-500 font-bold">DEV ONLY</span> - Reset Password</h1>
          </CardTitle>
          <CardDescription>
            Local development only. Sets an account&apos;s password directly, no email
            verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
