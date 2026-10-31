import { cn } from "@/lib/utils";

// The pulsing placeholder used across the app; size and shape come from
// className.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-foreground/10", className)} />;
}
