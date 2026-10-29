import { PackageX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BackButton } from "@/components/listings/back-button";
import { NoticePage } from "@/components/notice-page";

// Renders whenever page.tsx calls notFound() - a nonexistent id or an
// archived listing both land here (see page.tsx's comment on that). A full
// notice page rather than a bare 404, matching how a marketplace-style app
// (Facebook Marketplace, etc.) surfaces a dead listing link. Same muted
// tone as the site-wide 404: a missing listing isn't an error on the
// visitor's part.
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
