import { Skeleton } from "@/components/ui/skeleton";

// Shown while My Bookings fetches the user's orders. A segment's
// loading.tsx doesn't wrap that segment's own layout.tsx, so the account
// sidebar (app/account/layout.tsx, no data access) stays on screen and
// only the content column becomes this placeholder: a heading-sized box
// and one block where the table/cards go.
export default function AccountLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}
