import { Skeleton } from "@/components/ui/skeleton";

// Shown while My Bookings loads. A segment's loading.tsx doesn't wrap its own
// layout, so the account nav stays and only the content becomes a heading box
// and one block.
export default function AccountLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}
