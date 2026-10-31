import Link from "next/link";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { DemoLoginButtons } from "./demo-login-buttons";
import { isDemoLoginEnabled } from "@/lib/demo-login";
import { sanitizeCallbackUrl } from "./utils";

export default async function LoginPage({
  searchParams,
}: {
  // searchParams is a Promise in this Next version.
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const redirectTarget = sanitizeCallbackUrl(callbackUrl);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            <h1>Log in</h1>
          </CardTitle>
          <CardDescription>Welcome back.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoginForm callbackUrl={redirectTarget} />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            OR
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Google sign-in and sign-up are the same action, as on the signup
              page. */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: redirectTarget });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary underline underline-offset-4">
              Sign up
            </Link>
          </p>

          {/* Only when DEMO_LOGIN_ENABLED is on (lib/demo-login.ts). */}
          {isDemoLoginEnabled() && <DemoLoginButtons callbackUrl={redirectTarget} />}
        </CardContent>
      </Card>
    </div>
  );
}
