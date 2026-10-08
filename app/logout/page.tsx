import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LogoutPage() {
  const session = await auth();

  // Reachable directly (typed URL, bookmark, etc.) even with no session —
  // show something useful instead of a "log out" button that would just
  // fail, since signOut() on an already-empty session is a harmless no-op
  // but a confusing thing to present as an action.
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>You&apos;re not logged in</CardTitle>
            <CardDescription>There&apos;s no active session to log out of.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log out</CardTitle>
          <CardDescription>
            Signed in as {session.user.email ?? session.user.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* signOut() clears the session cookie — it has to run inside a
              Server Action (not directly in this component's render), since
              writing/clearing cookies is only allowed there or in a Route
              Handler, not during a plain Server Component render. */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" className="w-full">
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
