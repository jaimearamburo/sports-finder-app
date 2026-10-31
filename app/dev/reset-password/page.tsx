import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Development-only tool (see actions.ts). notFound() hides the page on deployed
 * builds; the action's NODE_ENV check is the real safeguard.
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
