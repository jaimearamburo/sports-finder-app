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

  // Reachable with no session (typed URL, bookmark): show something useful
  // instead of a pointless Log out button.
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              <h1>You&apos;re not logged in</h1>
            </CardTitle>
            <CardDescription>There&apos;s no active session to log out of.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-primary underline underline-offset-4">
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
          <CardTitle className="text-xl font-semibold">
            <h1>Log out</h1>
          </CardTitle>
          <CardDescription>
            Signed in as {session.user.email ?? session.user.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* signOut() clears a cookie, which is only allowed in a Server
              Action or Route Handler, not during render. */}
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
