"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createVenueAction, updateVenueAction } from "@/app/dashboard/venues/actions";
import type { CityOptionGroup, OwnerOption, VenueFormValues } from "@/lib/dashboard/venues";
import {
  BOOKING_WINDOW_DAYS,
  HOLD_DURATION_MINUTES,
  venueSchema,
  type VenueInput,
} from "@/lib/validation/venue";
import { getFieldErrors } from "@/lib/validation/field-errors";

type FieldErrors = Partial<Record<keyof VenueInput, string>>;

// Number fields are kept as typed text, so the box can be empty or
// half-typed while editing; they become numbers only on submit, where a
// blank or non-numeric value fails the schema with a readable message.
type FormState = Omit<VenueFormValues, "bookingWindowDays" | "holdDurationMinutes"> & {
  bookingWindowDays: string;
  holdDurationMinutes: string;
};

const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm";

// One labelled field with its error and optional hint, wired up for screen
// readers the way the rest of the app's forms are: the error and hint are
// tied to the input with aria-describedby.
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
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

// The venue form, for both adding a venue and editing one. Validates with
// the same schema as the server for instant inline errors; the server
// re-checks everything (and ownership) regardless.
export function VenueForm({
  venueId,
  initialValues,
  cityGroups,
  ownerOptions,
}: {
  // Present when editing; absent when adding a new venue.
  venueId?: string;
  initialValues: VenueFormValues;
  cityGroups: CityOptionGroup[];
  // Only passed to people who may assign owners (admins), and only then is
  // the Owner field shown. Hiding it is just presentation: the server
  // ignores an owner from anyone else (see resolveOwnerId).
  ownerOptions?: OwnerOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>({
    ...initialValues,
    bookingWindowDays: String(initialValues.bookingWindowDays),
    holdDurationMinutes: String(initialValues.holdDurationMinutes),
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cities = cityGroups.flatMap((group) => group.cities);
  const selectedCity = cities.find((city) => city.id === values.cityId);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input: VenueInput = {
      ...values,
      bookingWindowDays: values.bookingWindowDays.trim() === "" ? Number.NaN : Number(values.bookingWindowDays),
      holdDurationMinutes: values.holdDurationMinutes.trim() === "" ? Number.NaN : Number(values.holdDurationMinutes),
    };
    const parsed = venueSchema.safeParse(input);
    // The owner is required only when the field is shown, which the shared
    // schema can't know - the server applies the same rule.
    const ownerMissing = ownerOptions && !values.ownerId;
    if (!parsed.success || ownerMissing) {
      setFieldErrors({
        ...(parsed.success ? {} : getFieldErrors(parsed.error)),
        ...(ownerMissing ? { ownerId: "Choose the venue's owner." } : {}),
      });
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = venueId ? await updateVenueAction(venueId, input) : await createVenueAction(input);
      if (!result.ok) {
        setFieldErrors(("fieldErrors" in result && result.fieldErrors) || {});
        setFormError(result.error ?? null);
        return;
      }
      router.push("/dashboard/venues");
    });
  }

  return (
    // noValidate: the schema above is the one client-side check, so the
    // browser's own popups don't fire first with different wording.
    <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      {ownerOptions && (
        <Field
          id="owner"
          label="Owner"
          hint="The venue owner who manages this venue. Only people with a venue owner account are listed."
          error={fieldErrors.ownerId}
        >
          {(describedBy) => (
            <Select
              items={ownerOptions.map((owner) => ({ label: owner.label, value: owner.id }))}
              value={values.ownerId || null}
              onValueChange={(value) => set("ownerId", (value as string | null) ?? "")}
            >
              <SelectTrigger
                id="owner"
                className="w-full"
                aria-invalid={!!fieldErrors.ownerId}
                aria-describedby={describedBy}
              >
                <SelectValue placeholder="Choose an owner" />
              </SelectTrigger>
              <SelectContent>
                {ownerOptions.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}

      <Field id="name" label="Name" error={fieldErrors.name}>
        {(describedBy) => (
          <Input
            id="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Field id="description" label="Description (optional)" error={fieldErrors.description}>
        {(describedBy) => (
          <textarea
            id="description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={!!fieldErrors.description}
            aria-describedby={describedBy}
            className={TEXTAREA_CLASS}
          />
        )}
      </Field>

      <Field id="address" label="Street address" error={fieldErrors.address}>
        {(describedBy) => (
          <Input
            id="address"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            aria-invalid={!!fieldErrors.address}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Field
        id="city"
        label="City"
        error={fieldErrors.cityId}
        // Each city carries its timezone, and every time at the venue is
        // shown and validated in it - worth stating where it's chosen.
        hint={selectedCity ? `Times at this venue use ${selectedCity.timezone} time.` : undefined}
      >
        {(describedBy) => (
          <Select
            items={cities.map((city) => ({ label: city.label, value: city.id }))}
            value={values.cityId || null}
            onValueChange={(value) => set("cityId", (value as string | null) ?? "")}
          >
            <SelectTrigger
              id="city"
              className="w-full"
              aria-invalid={!!fieldErrors.cityId}
              aria-describedby={describedBy}
            >
              <SelectValue placeholder="Choose a city" />
            </SelectTrigger>
            <SelectContent>
              {cityGroups.map((group) => (
                <SelectGroup key={group.countryName}>
                  <SelectLabel className="bg-muted">{group.countryName}</SelectLabel>
                  {group.cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="bookingWindowDays"
          label="Booking window (days)"
          hint={`How far ahead people can book, ${BOOKING_WINDOW_DAYS.min} to ${BOOKING_WINDOW_DAYS.max} days.`}
          error={fieldErrors.bookingWindowDays}
        >
          {(describedBy) => (
            <Input
              id="bookingWindowDays"
              type="number"
              inputMode="numeric"
              min={BOOKING_WINDOW_DAYS.min}
              max={BOOKING_WINDOW_DAYS.max}
              value={values.bookingWindowDays}
              onChange={(e) => set("bookingWindowDays", e.target.value)}
              aria-invalid={!!fieldErrors.bookingWindowDays}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field
          id="holdDurationMinutes"
          label="Checkout hold (minutes)"
          hint={`How long a slot is held while someone pays, ${HOLD_DURATION_MINUTES.min} to ${HOLD_DURATION_MINUTES.max} minutes.`}
          error={fieldErrors.holdDurationMinutes}
        >
          {(describedBy) => (
            <Input
              id="holdDurationMinutes"
              type="number"
              inputMode="numeric"
              min={HOLD_DURATION_MINUTES.min}
              max={HOLD_DURATION_MINUTES.max}
              value={values.holdDurationMinutes}
              onChange={(e) => set("holdDurationMinutes", e.target.value)}
              aria-invalid={!!fieldErrors.holdDurationMinutes}
              aria-describedby={describedBy}
            />
          )}
        </Field>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : venueId ? "Save changes" : "Add venue"}
        </Button>
        <Link href="/dashboard/venues" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
