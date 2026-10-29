import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon colour by meaning. The title always stays the normal text colour -
// these pages used to mix red and black titles for the same kind of
// message, so the icon alone now carries the tone.
const TONE_CLASS = {
  error: "text-destructive",
  muted: "text-muted-foreground",
  success: "text-emerald-600",
} as const;

// The one layout for every full-page notice: errors, not-found pages and
// an expired hold. A plain component (no "use client"), so both Server
// Components and the client-side error boundary can use it.
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
  // The explanatory paragraph(s), plus anything else that belongs between
  // the title and the buttons (e.g. an error reference).
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
