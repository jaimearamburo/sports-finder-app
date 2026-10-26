import { PackageX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BackButton } from "@/components/listings/back-button";

// Renders whenever page.tsx calls notFound() - a nonexistent id or an
// archived listing both land here (see page.tsx's comment on that). Loud
// and unmissable on purpose, matching how a marketplace-style app
// (Facebook Marketplace, etc.) surfaces a dead listing link rather than a
// plain, easy-to-miss 404.
export default function ListingNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <PackageX className="size-14 text-destructive" />
      <h1 className="text-2xl font-bold text-destructive">This listing could not be found</h1>
      <p className="text-muted-foreground">
        It may have been removed by the venue, or the link you followed might be out of date.
      </p>
      <BackButton className={buttonVariants({ variant: "default", className: "mt-3" })}>
        Go back
      </BackButton>
    </div>
  );
}
