import type { ReactNode } from "react";

// The layout shared by the short text pages linked from the footer (Terms,
// Privacy, Contact): a heading, an optional one-line summary, then plain
// sections. One component so the three pages can't drift apart.
export function InfoPage({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {summary && <p className="mt-2 text-muted-foreground">{summary}</p>}
      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
