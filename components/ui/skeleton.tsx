import { cn } from "@/lib/utils";

// The one pulsing-placeholder primitive used across the app, so the browse
// page's detailed skeletons and the route-level loading.tsx files share the
// same colour and animation. Size and shape come entirely from className.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-foreground/10", className)} />;
}
