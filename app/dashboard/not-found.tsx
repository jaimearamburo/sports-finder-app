import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// For a dashboard record that doesn't exist or isn't the user's to manage
// (e.g. another owner's venue) - deliberately the same message for both, so
// the dashboard never confirms that someone else's record exists. Renders
// inside the dashboard layout, so the nav stays available.
export default function DashboardNotFound() {
  return (
    <NoticePage
      icon={SearchX}
      tone="muted"
      title="Not found"
      actions={
        <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
          Back to overview
        </Link>
      }
    >
      <p>This page doesn&apos;t exist, or it isn&apos;t one you manage.</p>
    </NoticePage>
  );
}
