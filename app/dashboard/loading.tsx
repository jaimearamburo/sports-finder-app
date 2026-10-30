import { Skeleton } from "@/components/ui/skeleton";

// Shown while a dashboard page loads its data. Like the account area's, a
// segment's loading.tsx doesn't wrap its own layout, so the dashboard nav
// stays on screen and only the content becomes a heading box and a block.
export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}
