"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { startOfLocalToday } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function formatPillLabel(date: Date): string {
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

// Presentational: QuickFiltersPanel owns the optimistic date and pending state;
// this only owns whether the popover is open.
export function DateFilterPopover({
  selectedDate,
  onCommit,
}: {
  selectedDate: Date | undefined;
  onCommit: (date: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleSelect(date: Date | undefined) {
    onCommit(date);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-pressed={!!selectedDate}
        className={cn(
          "h-9 shrink-0 rounded-md border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-foreground/50 hover:text-foreground",
          selectedDate && "border-foreground bg-foreground text-background hover:border-foreground hover:text-background"
        )}
      >
        {selectedDate ? formatPillLabel(selectedDate) : "Any date"}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={{ before: startOfLocalToday() }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="default" size="sm" className="flex-1" onClick={() => handleSelect(new Date())}>
            Today
          </Button>
          {selectedDate && (
            <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => handleSelect(undefined)}>
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
