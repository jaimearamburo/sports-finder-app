"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Small form building blocks shared by the dashboard's forms (venues,
// listings), so every field looks and behaves the same way: label on top,
// hint and error underneath, all tied to the control for screen readers.

export const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm";

// One labelled field with its error and optional hint. The error and hint
// are tied to the control with aria-describedby (passed to `children`), so
// a screen reader reads out why a field is invalid when it's focused.
// `labelFor` is the control's id - leave it out for a group of buttons,
// which is labelled by its own aria-labelledby instead.
export function Field({
  id,
  label,
  hint,
  error,
  className,
  labelFor = id,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  labelFor?: string | null;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {labelFor ? (
        <Label htmlFor={labelFor}>{label}</Label>
      ) : (
        <span id={`${id}-label`} className="text-sm leading-none font-medium">
          {label}
        </span>
      )}
      {children(describedBy)}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// A titled group of related fields, drawn as a card - the sections a long
// form is broken into so it reads as a few small steps, not one wall.
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-5 sm:p-6">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

// A money amount: "$" inside the box on the left, the unit ("per hour")
// outside on the right, so it's clear what the number means.
export function MoneyInput({
  id,
  value,
  onChange,
  unit,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  invalid: boolean;
  describedBy?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-40">
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          // No up/down arrows: nobody adjusts a price a cent at a time, and
          // they crowd a short box.
          className="[appearance:textfield] pl-6 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      <span className="text-sm text-muted-foreground">{unit}</span>
    </div>
  );
}

// A row of buttons where exactly one is selected - quicker than a dropdown
// for a handful of short choices (15 / 30 / 60 min, the days of the week).
// A real radio group for assistive technology: arrow keys move the
// selection, and only the selected button is in the tab order.
export function SegmentedControl<T extends string | number>({
  labelledBy,
  options,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  labelledBy: string;
  options: { value: T; label: string; srLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  function handleKeyDown(e: KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      // 36px tall overall (28px buttons + 3px padding + 1px border, each
      // side) - the same height as inputs and dropdowns, so labels in a row
      // of mixed controls line up.
      className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-lg border bg-muted/50 p-0.75"
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex && option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.srLabel}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "h-7 min-w-11 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
