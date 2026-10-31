import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// For a dashboard record that doesn't exist or isn't the user's: one message
// for both, so other owners' records are never confirmed. Renders inside the
// dashboard nav.
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
