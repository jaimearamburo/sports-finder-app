import { PackageX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BackButton } from "@/components/listings/back-button";
import { NoticePage } from "@/components/notice-page";

// For a nonexistent or archived listing (page.tsx calls notFound() for both). A
// full notice page in the muted tone of the site-wide 404.
export default function ListingNotFound() {
  return (
    <NoticePage
      icon={PackageX}
      tone="muted"
      title="This listing could not be found"
      actions={<BackButton className={buttonVariants({ variant: "default" })}>Go back</BackButton>}
    >
      <p>It may have been removed by the venue, or the link you followed might be out of date.</p>
    </NoticePage>
  );
}
