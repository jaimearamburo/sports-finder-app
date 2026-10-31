import { Skeleton } from "@/components/ui/skeleton";

// Shown while a dashboard page loads. The dashboard nav stays (loading.tsx
// doesn't wrap its own layout); only the content becomes placeholders.
export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}
