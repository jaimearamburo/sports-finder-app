"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ListingCard, type CardFields } from "@/components/browse/listing-card";
import { Field, FormSection, MoneyInput, SegmentedControl, TEXTAREA_CLASS } from "@/components/dashboard/form-controls";
import { ListingImageField } from "@/components/dashboard/listing-image-field";
import { createListingAction, updateListingAction } from "@/app/dashboard/listings/actions";
import type { ActivityOption, ListingEditorVenue } from "@/lib/dashboard/listings";
import type { ListingImpact } from "@/lib/dashboard/listing-impact";
import { getScheduleLine } from "@/lib/listing-schedule";
import {
  COURT_DURATION_MAX_MINUTES,
  DAYS_MAX,
  formatMinutes,
  KIND_DEFAULTS,
  parseListing,
  START_STEP_OPTIONS,
  type ListingFieldErrors,
  type ListingFormInput,
  type ListingKind,
} from "@/lib/validation/listing";

// Everything about each kind of listing that the form words differently.
const KIND_COPY: Record<
  ListingKind,
  {
    group: string;
    explainer: string;
    priceUnit: string;
    namePlaceholder: string;
    capacityLabel: string;
    capacityHint: string;
    allowsUnlimited: boolean;
    scheduleTitle: string;
    scheduleDescription: string;
  }
> = {
  court: {
    group: "Book a time",
    explainer: "Customers choose a day, a start time and how long they want.",
    priceUnit: "per hour",
    namePlaceholder: "e.g. Court 1",
    capacityLabel: "Bookings at the same time",
    capacityHint: "1 for an exclusive court or pitch. More if several groups can share it at once.",
    allowsUnlimited: false,
    scheduleTitle: "Opening hours and bookings",
    scheduleDescription: "When it's open, and how long people can book it for.",
  },
  class: {
    group: "Classes",
    explainer: "Customers book a place in a session that runs every week.",
    priceUnit: "per session",
    namePlaceholder: "e.g. Monday 6pm HIIT",
    capacityLabel: "Places per session",
    capacityHint: "How many people can join one session.",
    allowsUnlimited: true,
    scheduleTitle: "Session",
    scheduleDescription: "When the class runs each week. For a class on several days, add one listing per day.",
  },
  pass: {
    group: "Day passes",
    explainer: "Customers pick the days they want to come.",
    priceUnit: "per day",
    namePlaceholder: "e.g. Day Pass",
    capacityLabel: "Passes per day",
    capacityHint: "How many people can use a pass on the same day.",
    allowsUnlimited: true,
    scheduleTitle: "Opening hours and days",
    scheduleDescription: "When it's open, and how many days one booking can cover.",
  },
  stay: {
    group: "Stays",
    explainer: "Customers pick check-in and check-out dates.",
    priceUnit: "per night",
    namePlaceholder: "e.g. Campsite A",
    capacityLabel: "Bookings per night",
    capacityHint: "1 for a single site or room.",
    allowsUnlimited: false,
    scheduleTitle: "Check-in and nights",
    scheduleDescription: "The latest check-in time, and how many nights one stay can be.",
  },
};

const KIND_ORDER: ListingKind[] = ["court", "class", "pass", "stay"];
// One width for every short control (times, counts, lengths, numbers), the
// same as the price box, so fields in the two columns line up.
const CONTROL_WIDTH = "w-40 tabular-nums";
const MECHANIC: Record<ListingKind, "time_range" | "date_range" | "fixed_session"> = {
  court: "time_range",
  class: "fixed_session",
  pass: "date_range",
  stay: "date_range",
};
const WEEKDAYS = [
  { value: 1, label: "Mon", srLabel: "Monday" },
  { value: 2, label: "Tue", srLabel: "Tuesday" },
  { value: 3, label: "Wed", srLabel: "Wednesday" },
  { value: 4, label: "Thu", srLabel: "Thursday" },
  { value: 5, label: "Fri", srLabel: "Friday" },
  { value: 6, label: "Sat", srLabel: "Saturday" },
  { value: 0, label: "Sun", srLabel: "Sunday" },
];
const SESSION_LENGTHS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15 min to 4 hr
const DAY_COUNTS = Array.from({ length: DAYS_MAX }, (_, i) => i + 1);

// Number fields are kept as typed text, so a box can be empty or half-typed
// while editing; they become numbers on submit, where anything that isn't a
// number fails validation with a readable message.
type FormState = {
  [K in keyof ListingFormInput]: ListingFormInput[K] extends number | null ? string : ListingFormInput[K];
};

function toState(values: ListingFormInput): FormState {
  return {
    ...values,
    // A new listing starts with no price (NaN), shown as an empty box rather
    // than 0, which would make it easy to save a listing as free by mistake.
    price: Number.isFinite(values.price) ? String(values.price) : "",
    capacity: values.capacity === null ? "" : String(values.capacity),
    maxPerBooking: String(values.maxPerBooking),
    startStepMinutes: String(values.startStepMinutes),
    minDurationMinutes: String(values.minDurationMinutes),
    maxDurationMinutes: String(values.maxDurationMinutes),
    minDays: String(values.minDays),
    maxDays: String(values.maxDays),
    weekday: String(values.weekday),
    sessionMinutes: String(values.sessionMinutes),
  };
}

function toNumber(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

// The form's values as validated input. Capacity 1 means exactly one place,
// so the per-booking limit is 1 by definition (that field isn't shown).
function toInput(state: FormState, unlimited: boolean): ListingFormInput {
  const capacity = unlimited ? null : toNumber(state.capacity);
  return {
    ...state,
    price: toNumber(state.price),
    capacity,
    maxPerBooking: capacity === 1 ? 1 : toNumber(state.maxPerBooking),
    startStepMinutes: toNumber(state.startStepMinutes),
    minDurationMinutes: toNumber(state.minDurationMinutes),
    maxDurationMinutes: toNumber(state.maxDurationMinutes),
    minDays: toNumber(state.minDays),
    maxDays: toNumber(state.maxDays),
    weekday: toNumber(state.weekday),
    sessionMinutes: toNumber(state.sessionMinutes),
  };
}

// The card as it will appear in browse, built from what's typed so far.
function previewCard(state: FormState, unlimited: boolean, activity: ActivityOption, venue: ListingEditorVenue): CardFields {
  const price = Number(state.price);
  const kind = activity.kind;
  return {
    name: state.name.trim() || "Listing name",
    imageUrl: state.imageUrl,
    pricePerUnit: Number.isFinite(price) && price >= 0 ? String(Math.round(price * 100) / 100) : "0",
    capacity: unlimited ? null : Number(state.capacity) || null,
    minDurationMinutes: kind === "court" ? Number(state.minDurationMinutes) : null,
    maxDurationMinutes: kind === "court" ? Number(state.maxDurationMinutes) : null,
    minDurationDays: kind === "pass" || kind === "stay" ? Number(state.minDays) : null,
    maxDurationDays: kind === "pass" || kind === "stay" ? Number(state.maxDays) : null,
    sessionDurationMinutes: kind === "class" ? Number(state.sessionMinutes) : null,
    activity: {
      name: activity.name,
      bookingMechanic: MECHANIC[kind],
      isAccommodation: kind === "stay",
      tags: activity.tag ? [{ tag: activity.tag }] : [],
    },
    venue: { name: venue.name, city: { name: venue.cityName, country: { name: venue.countryName } } },
  };
}

// Plain-English lines under the preview: what booking it will look like.
function summaryLines(state: FormState, unlimited: boolean, kind: ListingKind): string[] {
  const lines: string[] = [];
  const schedule = getScheduleLine({
    operatingHoursStart: kind === "court" || kind === "pass" ? state.openingTime : null,
    operatingHoursEnd: kind === "class" ? null : state.closingTime,
    recurrenceDayOfWeek: kind === "class" ? Number(state.weekday) : null,
    recurrenceStartTime: kind === "class" ? state.startTime : null,
    activity: { bookingMechanic: MECHANIC[kind], isAccommodation: kind === "stay" },
  });
  if (schedule) lines.push(schedule);

  const range = (min: string, max: string, unit: string) =>
    min === max ? `${min} ${unit}${min === "1" ? "" : "s"}` : `${min} to ${max} ${unit}s`;
  if (kind === "court")
    lines.push(
      `Bookings of ${formatMinutes(Number(state.minDurationMinutes))} to ${formatMinutes(Number(state.maxDurationMinutes))}, starting every ${state.startStepMinutes} min`
    );
  if (kind === "class") lines.push(`${formatMinutes(Number(state.sessionMinutes))} sessions`);
  if (kind === "pass") lines.push(`${range(state.minDays, state.maxDays, "day")} per booking`);
  if (kind === "stay") lines.push(`${range(state.minDays, state.maxDays, "night")} per stay`);

  const capacity = Number(state.capacity);
  if (unlimited) lines.push(`Unlimited places, up to ${state.maxPerBooking} per booking`);
  else if (capacity === 1) lines.push("One booking at a time");
  else if (capacity > 1) lines.push(`${capacity} places, up to ${state.maxPerBooking} per booking`);
  return lines;
}

// Where focus goes for each field when it has an error: the control itself,
// or, for a button group, its selected button.
function focusField(field: keyof ListingFormInput) {
  const group = document.querySelector<HTMLElement>(`[aria-labelledby="${field}-label"] [tabindex="0"]`);
  (group ?? document.getElementById(field))?.focus();
}

const FIELD_ORDER: (keyof ListingFormInput)[] = [
  "activityId",
  "name",
  "description",
  "imageUrl",
  "price",
  "capacity",
  "maxPerBooking",
  "weekday",
  "startTime",
  "sessionMinutes",
  "openingTime",
  "closingTime",
  "startStepMinutes",
  "minDurationMinutes",
  "maxDurationMinutes",
  "minDays",
  "maxDays",
];

// The listing form, for adding a listing to a venue and for editing one.
// The fields shown follow the activity's kind (court, class, pass, stay);
// the live preview on the side is the real browse card. Validated with the
// same rules as the server for instant inline errors - the server re-checks
// everything, plus ownership.
export function ListingForm({
  venue,
  activities,
  initialValues,
  listingId,
}: {
  venue: ListingEditorVenue;
  // Every activity when adding a listing; just the listing's own when
  // editing, since the activity can't change after creation.
  activities: ActivityOption[];
  initialValues: ListingFormInput;
  // Present when editing.
  listingId?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => toState(initialValues));
  const [unlimited, setUnlimited] = useState(initialValues.capacity === null);
  const [errors, setErrors] = useState<ListingFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [impact, setImpact] = useState<ListingImpact | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activity = activities.find((option) => option.id === state.activityId) ?? null;
  const kind = activity?.kind ?? null;
  const copy = kind ? KIND_COPY[kind] : null;
  const editing = Boolean(listingId);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    // Any change means a pending warning no longer describes these values.
    setImpact(null);
  }

  // Choosing an activity of a different kind starts that kind's usual
  // settings (classes and passes are shared, courts and stays exclusive).
  function chooseActivity(activityId: string) {
    const next = activities.find((option) => option.id === activityId);
    if (!next) return;
    setState((current) => {
      const previousKind = activities.find((option) => option.id === current.activityId)?.kind;
      if (previousKind === next.kind) return { ...current, activityId };
      const defaults = toState({ ...toInput(current, false), ...KIND_DEFAULTS[next.kind] } as ListingFormInput);
      return { ...defaults, activityId, name: current.name, description: current.description, price: current.price };
    });
    setUnlimited(false);
    setErrors((current) => ({ ...current, activityId: undefined }));
  }

  // Changing the start step keeps the booking lengths valid: they snap up
  // to the next multiple, so the dropdowns always show a real choice.
  function chooseStep(step: number) {
    setState((current) => {
      const snap = (minutes: string) => String(Math.max(step, Math.ceil(Number(minutes) / step) * step));
      return { ...current, startStepMinutes: String(step), minDurationMinutes: snap(current.minDurationMinutes), maxDurationMinutes: snap(current.maxDurationMinutes) };
    });
    setImpact(null);
  }

  function submit(confirmImpact: boolean) {
    setFormError(null);
    if (!kind) {
      setErrors({ activityId: "Choose an activity." });
      focusField("activityId");
      return;
    }
    const input = toInput(state, unlimited);
    const parsed = parseListing(kind, input);
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      const first = FIELD_ORDER.find((field) => parsed.fieldErrors[field]);
      if (first) focusField(first);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = listingId
        ? await updateListingAction(listingId, input, confirmImpact)
        : await createListingAction(venue.id, input);
      if (!result.ok) {
        if ("impact" in result && result.impact) {
          setImpact(result.impact);
          return;
        }
        const fieldErrors = ("fieldErrors" in result && result.fieldErrors) || {};
        setErrors(fieldErrors);
        setFormError(result.error ?? null);
        const first = FIELD_ORDER.find((field) => fieldErrors[field]);
        if (first) focusField(first);
        return;
      }
      router.push(`/dashboard/venues/${result.venueId}`);
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(false);
  }

  const step = Number(state.startStepMinutes) || 30;
  const durationOptions = Array.from({ length: Math.floor(COURT_DURATION_MAX_MINUTES / step) }, (_, i) => (i + 1) * step);
  const sessionOptions = SESSION_LENGTHS.includes(Number(state.sessionMinutes))
    ? SESSION_LENGTHS
    : [...SESSION_LENGTHS, Number(state.sessionMinutes)].filter(Number.isFinite).sort((a, b) => a - b);
  const capacityNumber = Number(state.capacity);
  const showMaxPerBooking = unlimited || capacityNumber > 1;
  const activityGroups = KIND_ORDER.map((groupKind) => ({
    kind: groupKind,
    activities: activities.filter((option) => option.kind === groupKind),
  })).filter((group) => group.activities.length > 0);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* noValidate: the shared schema is the one client-side check, so the
          browser's own popups don't fire first with different wording. */}
      <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-6">
        <FormSection title="Activity" description="What this listing is. It decides how it's booked.">
          {editing && activity ? (
            <div className="flex items-start gap-3 rounded-md border bg-muted/40 px-3 py-3">
              <span aria-hidden className="text-xl leading-6">
                {activity.tag?.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{activity.name}</p>
                <p className="text-sm text-muted-foreground">{KIND_COPY[activity.kind].explainer}</p>
                <p className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
                  <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
                  The activity can&apos;t be changed once a listing exists.
                </p>
              </div>
            </div>
          ) : (
            <Field id="activityId" label="Activity" error={errors.activityId} hint={copy?.explainer}>
              {(describedBy) => (
                <Select
                  items={activities.map((option) => ({ label: option.name, value: option.id }))}
                  value={state.activityId || null}
                  onValueChange={(value) => chooseActivity(String(value ?? ""))}
                >
                  <SelectTrigger
                    id="activityId"
                    className="w-full sm:w-80"
                    aria-invalid={!!errors.activityId}
                    aria-describedby={describedBy}
                  >
                    <SelectValue placeholder="Choose an activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityGroups.map((group) => (
                      <SelectGroup key={group.kind}>
                        <SelectLabel className="bg-muted">{KIND_COPY[group.kind].group}</SelectLabel>
                        {group.activities.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            <span aria-hidden>{option.tag?.emoji}</span> {option.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}
        </FormSection>

        {kind && copy ? (
          <>
            <FormSection title="Details" description="How the listing appears to customers.">
              <Field id="name" label="Name" error={errors.name}>
                {(describedBy) => (
                  <Input
                    id="name"
                    value={state.name}
                    placeholder={copy.namePlaceholder}
                    onChange={(e) => set("name", e.target.value)}
                    aria-invalid={!!errors.name}
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
              <Field id="description" label="Description (optional)" error={errors.description}>
                {(describedBy) => (
                  <textarea
                    id="description"
                    value={state.description}
                    placeholder="What's included, the surface or equipment, anything to bring."
                    onChange={(e) => set("description", e.target.value)}
                    aria-invalid={!!errors.description}
                    aria-describedby={describedBy}
                    className={TEXTAREA_CLASS}
                  />
                )}
              </Field>
              <Field
                id="imageUrl"
                label="Photo (optional)"
                labelFor={null}
                hint="Shown on the listing's card and page, cropped to fit. Without one, the activity's icon is shown."
                error={errors.imageUrl}
              >
                {(describedBy) => (
                  <ListingImageField
                    venueId={venue.id}
                    value={state.imageUrl}
                    onChange={(url) => {
                      set("imageUrl", url);
                      setErrors((current) => ({ ...current, imageUrl: undefined }));
                    }}
                    onUploadingChange={setUploadingImage}
                    error={errors.imageUrl}
                    describedBy={describedBy}
                  />
                )}
              </Field>
            </FormSection>

            <FormSection title="Price and capacity" description="What it costs, and how many people can book.">
              <Field id="price" label="Price" hint="Enter 0 to make it free." error={errors.price}>
                {(describedBy) => (
                  <MoneyInput
                    id="price"
                    value={state.price}
                    onChange={(value) => set("price", value)}
                    unit={copy.priceUnit}
                    invalid={!!errors.price}
                    describedBy={describedBy}
                  />
                )}
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="capacity" label={copy.capacityLabel} hint={copy.capacityHint} error={errors.capacity}>
                  {(describedBy) => (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Input
                        id="capacity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={unlimited ? "" : state.capacity}
                        placeholder={unlimited ? "Unlimited" : undefined}
                        disabled={unlimited}
                        onChange={(e) => set("capacity", e.target.value)}
                        aria-invalid={!!errors.capacity}
                        aria-describedby={describedBy}
                        className={CONTROL_WIDTH}
                      />
                      {copy.allowsUnlimited && (
                        <Label className="w-fit font-normal">
                          <Checkbox
                            checked={unlimited}
                            onCheckedChange={(checked) => {
                              setUnlimited(checked);
                              setImpact(null);
                            }}
                          />
                          No limit
                        </Label>
                      )}
                    </div>
                  )}
                </Field>

                {showMaxPerBooking && (
                  <Field
                    id="maxPerBooking"
                    label="Most places in one booking"
                    hint="Lets groups book together, without one booking taking every place."
                    error={errors.maxPerBooking}
                  >
                    {(describedBy) => (
                      <Input
                        id="maxPerBooking"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={state.maxPerBooking}
                        onChange={(e) => set("maxPerBooking", e.target.value)}
                        aria-invalid={!!errors.maxPerBooking}
                        aria-describedby={describedBy}
                        className={CONTROL_WIDTH}
                      />
                    )}
                  </Field>
                )}
              </div>
            </FormSection>

            <FormSection title={copy.scheduleTitle} description={copy.scheduleDescription}>
              {kind === "class" && (
                <>
                  <Field id="weekday" label="Day" labelFor={null} error={errors.weekday}>
                    {(describedBy) => (
                      <SegmentedControl
                        labelledBy="weekday-label"
                        options={WEEKDAYS.map((day) => ({ ...day, value: String(day.value) }))}
                        value={state.weekday}
                        onChange={(value) => set("weekday", value)}
                        describedBy={describedBy}
                        invalid={!!errors.weekday}
                      />
                    )}
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="startTime" label="Start time" error={errors.startTime}>
                      {(describedBy) => (
                        <Input
                          id="startTime"
                          type="time"
                          step={300}
                          value={state.startTime}
                          onChange={(e) => set("startTime", e.target.value)}
                          aria-invalid={!!errors.startTime}
                          aria-describedby={describedBy}
                          className={CONTROL_WIDTH}
                        />
                      )}
                    </Field>
                    <Field id="sessionMinutes" label="Length" error={errors.sessionMinutes}>
                      {(describedBy) => (
                        <MinutesSelect
                          id="sessionMinutes"
                          options={sessionOptions}
                          value={state.sessionMinutes}
                          onChange={(value) => set("sessionMinutes", value)}
                          invalid={!!errors.sessionMinutes}
                          describedBy={describedBy}
                        />
                      )}
                    </Field>
                  </div>
                </>
              )}

              {(kind === "court" || kind === "pass") && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="openingTime" label="Opens" error={errors.openingTime}>
                    {(describedBy) => (
                      <Input
                        id="openingTime"
                        type="time"
                        step={(kind === "court" ? step : 5) * 60}
                        value={state.openingTime}
                        onChange={(e) => set("openingTime", e.target.value)}
                        aria-invalid={!!errors.openingTime}
                        aria-describedby={describedBy}
                        className={CONTROL_WIDTH}
                      />
                    )}
                  </Field>
                  <Field id="closingTime" label="Closes" error={errors.closingTime}>
                    {(describedBy) => (
                      <Input
                        id="closingTime"
                        type="time"
                        step={(kind === "court" ? step : 5) * 60}
                        value={state.closingTime}
                        onChange={(e) => set("closingTime", e.target.value)}
                        aria-invalid={!!errors.closingTime}
                        aria-describedby={describedBy}
                        className={CONTROL_WIDTH}
                      />
                    )}
                  </Field>
                </div>
              )}

              {kind === "stay" && (
                <Field
                  id="closingTime"
                  label="Latest check-in"
                  hint="Bookings for tonight close an hour before this."
                  error={errors.closingTime}
                >
                  {(describedBy) => (
                    <Input
                      id="closingTime"
                      type="time"
                      step={300}
                      value={state.closingTime}
                      onChange={(e) => set("closingTime", e.target.value)}
                      aria-invalid={!!errors.closingTime}
                      aria-describedby={describedBy}
                      className={CONTROL_WIDTH}
                    />
                  )}
                </Field>
              )}

              {kind === "court" && (
                <>
                  <Field
                    id="startStepMinutes"
                    label="Bookings can start every"
                    labelFor={null}
                    hint="Opening and closing times need to fall on this step too."
                    error={errors.startStepMinutes}
                  >
                    {(describedBy) => (
                      <SegmentedControl
                        labelledBy="startStepMinutes-label"
                        options={START_STEP_OPTIONS.map((option) => ({ value: String(option), label: `${option} min` }))}
                        value={state.startStepMinutes}
                        onChange={(value) => chooseStep(Number(value))}
                        describedBy={describedBy}
                        invalid={!!errors.startStepMinutes}
                      />
                    )}
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="minDurationMinutes" label="Shortest booking" error={errors.minDurationMinutes}>
                      {(describedBy) => (
                        <MinutesSelect
                          id="minDurationMinutes"
                          options={durationOptions}
                          value={state.minDurationMinutes}
                          onChange={(value) => set("minDurationMinutes", value)}
                          invalid={!!errors.minDurationMinutes}
                          describedBy={describedBy}
                        />
                      )}
                    </Field>
                    <Field id="maxDurationMinutes" label="Longest booking" error={errors.maxDurationMinutes}>
                      {(describedBy) => (
                        <MinutesSelect
                          id="maxDurationMinutes"
                          options={durationOptions}
                          value={state.maxDurationMinutes}
                          onChange={(value) => set("maxDurationMinutes", value)}
                          invalid={!!errors.maxDurationMinutes}
                          describedBy={describedBy}
                        />
                      )}
                    </Field>
                  </div>
                </>
              )}

              {(kind === "pass" || kind === "stay") && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="minDays" label={kind === "stay" ? "Minimum nights" : "Minimum days"} error={errors.minDays}>
                    {(describedBy) => (
                      <CountSelect
                        id="minDays"
                        unit={kind === "stay" ? "night" : "day"}
                        value={state.minDays}
                        onChange={(value) => set("minDays", value)}
                        invalid={!!errors.minDays}
                        describedBy={describedBy}
                      />
                    )}
                  </Field>
                  <Field id="maxDays" label={kind === "stay" ? "Maximum nights" : "Maximum days"} error={errors.maxDays}>
                    {(describedBy) => (
                      <CountSelect
                        id="maxDays"
                        unit={kind === "stay" ? "night" : "day"}
                        value={state.maxDays}
                        onChange={(value) => set("maxDays", value)}
                        invalid={!!errors.maxDays}
                        describedBy={describedBy}
                      />
                    )}
                  </Field>
                </div>
              )}
            </FormSection>
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Choose an activity to set up the rest of the listing.
          </p>
        )}

        {impact && <ImpactNotice impact={impact} />}

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {impact ? (
            <>
              <Button type="button" onClick={() => submit(true)} disabled={isPending || uploadingImage}>
                {isPending ? "Saving..." : "Save anyway"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setImpact(null)} disabled={isPending}>
                Keep editing
              </Button>
            </>
          ) : (
            <>
              {/* Not while a photo is uploading: the save would go without it. */}
              <Button type="submit" disabled={isPending || uploadingImage}>
                {isPending ? "Saving..." : uploadingImage ? "Uploading photo..." : editing ? "Save changes" : "Add listing"}
              </Button>
              <Link href={`/dashboard/venues/${venue.id}`} className={buttonVariants({ variant: "outline" })}>
                Cancel
              </Link>
            </>
          )}
        </div>
      </form>

      {/* The preview: the real browse card, built from what's typed. Below
          the form on phones, alongside it (and staying in view while
          scrolling) on wider screens. */}
      <aside aria-label="Preview" className="lg:sticky lg:top-24">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview in browse</p>
        {activity && kind ? (
          <>
            {/* Purely visual: the card isn't a link here, and screen
                readers get the summary below instead. */}
            <div aria-hidden className="w-full max-w-72">
              <ListingCard listing={previewCard(state, unlimited, activity, venue)} />
            </div>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm text-muted-foreground">
              {summaryLines(state, unlimited, kind).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : (
          <div className="grid h-60 w-full max-w-72 place-items-center rounded-[5px] border border-dashed text-sm text-muted-foreground">
            No activity yet
          </div>
        )}
      </aside>
    </div>
  );
}

// A dropdown of lengths ("30 min", "1 hr 30 min"), for booking and session
// lengths - only valid choices are offered, so nothing needs typing.
function MinutesSelect({
  id,
  options,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  options: number[];
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  return (
    <Select
      items={options.map((minutes) => ({ label: formatMinutes(minutes), value: String(minutes) }))}
      value={value}
      onValueChange={(next) => onChange(String(next ?? ""))}
    >
      <SelectTrigger id={id} className={CONTROL_WIDTH} aria-invalid={invalid} aria-describedby={describedBy}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((minutes) => (
          <SelectItem key={minutes} value={String(minutes)}>
            {formatMinutes(minutes)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// A dropdown of day or night counts, 1 to the most a booking can cover.
function CountSelect({
  id,
  unit,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const label = (count: number) => `${count} ${unit}${count === 1 ? "" : "s"}`;
  return (
    <Select
      items={DAY_COUNTS.map((count) => ({ label: label(count), value: String(count) }))}
      value={value}
      onValueChange={(next) => onChange(String(next ?? ""))}
    >
      <SelectTrigger id={id} className={CONTROL_WIDTH} aria-invalid={invalid} aria-describedby={describedBy}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DAY_COUNTS.map((count) => (
          <SelectItem key={count} value={String(count)}>
            {label(count)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Shown when saving would leave upcoming bookings outside the new settings.
// Neutral rather than yellow (yellow is kept for hold timers - see the
// design conventions in CLAUDE.md); the icon carries the caution.
function ImpactNotice({ impact }: { impact: ListingImpact }) {
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  return (
    <div role="alert" className="flex gap-3 rounded-lg border bg-muted/50 p-4 text-sm">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-700" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">This change affects upcoming bookings</p>
        {impact.ordersOutsideSchedule > 0 && (
          <p>
            {plural(impact.ordersOutsideSchedule, "upcoming booking")}{" "}
            {impact.ordersOutsideSchedule === 1 ? "doesn't" : "don't"} fit the new settings.
          </p>
        )}
        {impact.peakOverCapacity !== null && (
          <p>Some times already have {impact.peakOverCapacity} places booked, more than the new capacity.</p>
        )}
        <p className="text-muted-foreground">
          Existing bookings are kept as they are. Save anyway, or keep editing to change the settings.
        </p>
      </div>
    </div>
  );
}
