import { Skeleton } from "@/components/ui/skeleton";

// Required: otherwise app/listings/[id]/loading.tsx also wraps checkout and
// Book Now briefly shows the listing skeleton. Sized to CheckoutForm's narrower
// container.
export default function CheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-7 sm:px-6">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-4 h-112 w-full rounded-md" />
    </div>
  );
}
