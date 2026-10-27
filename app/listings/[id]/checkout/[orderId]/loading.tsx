import { Skeleton } from "@/components/ui/skeleton";

// Must exist even though it's tiny: without it, the parent
// app/listings/[id]/loading.tsx boundary also wraps this route, and
// "Book Now" would briefly show the listing page's skeleton (wrong width,
// wrong page) before checkout appears. Same minimal shape as that one,
// sized to CheckoutForm's narrower container.
export default function CheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-7 sm:px-6">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-4 h-112 w-full rounded-md" />
    </div>
  );
}
