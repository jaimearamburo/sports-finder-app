import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon colour carries the tone; the title always uses the normal text colour.
const TONE_CLASS = {
  error: "text-destructive",
  muted: "text-muted-foreground",
  success: "text-emerald-600",
} as const;

// The layout for every full-page notice: errors, not-found pages and an expired
// hold. No "use client", so Server Components and the client error boundary can
// both use it.
export function NoticePage({
  icon: Icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONE_CLASS;
  title: string;
  // Explanation paragraphs, plus anything between the title and the buttons
  // (e.g. an error reference).
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <Icon className={cn("size-14", TONE_CLASS[tone])} />
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex flex-col gap-2 text-muted-foreground">{children}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  );
}
