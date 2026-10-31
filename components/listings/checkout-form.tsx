"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Check, Copy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tagTextColor } from "@/lib/label-styles";
import { HoldExpiredNotice } from "@/components/listings/hold-expired-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { confirmHoldPaymentAction, startHoldPaymentAction } from "@/app/listings/[id]/actions";
import type { z } from "zod";
import { attendeeSchema } from "@/lib/validation/booking";
import { getFieldErrors } from "@/lib/validation/field-errors";

type AttendeeInput = z.input<typeof attendeeSchema>;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Loaded once per page load, outside any component, so re-renders don't reload
// Stripe.js. Without a publishable key the form says payments are unavailable.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

// The Payment Element renders in Stripe's iframe, out of reach of the site's
// CSS; these variables match it to the shared Input component.
const STRIPE_APPEARANCE: Appearance = {
  theme: "stripe",
  variables: {
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
    // 16px on phones (see checkoutAppearance), 14px from md up.
    fontSizeBase: "14px",
    colorPrimary: "#1857c4",
    colorText: "#0a0a0a",
    colorTextSecondary: "#6a6a6a",
    colorDanger: "#e7000b",
    colorBackground: "#f5f7f4",
    borderRadius: "6px",
    spacingUnit: "4px",
  },
  rules: {
    // White fields like the attendee inputs, to stand out from the grey page.
    // colorBackground stays the page colour because it also paints around the
    // fields.
    ".Input": { backgroundColor: "#ffffff", border: "1px solid #e5e5e5", boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" },
    ".Input:focus": { borderColor: "#1857c4", boxShadow: "0 0 0 3px rgba(24, 87, 196, 0.5)" },
    ".Label": { fontWeight: "500", color: "#0a0a0a" },
  },
};

// iPhones zoom into inputs under 16px. The site's Input uses text-base below
// md; the same rule reaches Stripe's iframe through its appearance settings.
// Read once on first render, as Stripe does.
const NARROW_SCREEN = "(max-width: 767px)";
function checkoutAppearance(): Appearance {
  const narrow = typeof window !== "undefined" && window.matchMedia(NARROW_SCREEN).matches;
  return { ...STRIPE_APPEARANCE, variables: { ...STRIPE_APPEARANCE.variables, fontSizeBase: narrow ? "16px" : "14px" } };
}

// The site's font, loaded into Stripe's iframe.
const STRIPE_FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" }];

type CheckoutFormProps = {
  orderId: string;
  expiresAt: Date;
  listingId: string;
  listingName: string;
  activityName: string;
  // The listing's primary tag colour for the category label; undefined falls
  // back to grey.
  accentColor?: string;
  venueName: string;
  cityName: string;
  scheduleLines: string[];
  quantity: number;
  total: number;
  // The total in cents, computed exactly as startHoldPayment computes the
  // PaymentIntent amount.
  amountMinor: number;
  currency: string;
  breakdown: string | null;
  defaultName: string;
  defaultEmail: string;
};

// <Elements> in deferred mode (amount and currency, no PaymentIntent yet): the
// PaymentIntent is created on submit, so a page view that never pays creates
// nothing on Stripe. captureMethod and the payment method list must match
// startHoldPayment, or Stripe rejects the confirmation. A free order gets no
// Stripe instance.
export function CheckoutForm(props: CheckoutFormProps) {
  const free = props.amountMinor === 0;
  const [appearance] = useState(checkoutAppearance);
  return (
    <Elements
      stripe={free ? null : stripePromise}
      options={{
        mode: "payment",
        amount: props.amountMinor,
        currency: props.currency,
        captureMethod: "manual",
        allowedPaymentMethodTypes: ["card"],
        appearance,
        fonts: STRIPE_FONTS,
      }}
    >
      <CheckoutFormContent {...props} />
    </Elements>
  );
}

function CheckoutFormContent({
  orderId,
  expiresAt,
  listingId,
  listingName,
  activityName,
  accentColor,
  venueName,
  cityName,
  scheduleLines,
  quantity,
  total,
  amountMinor,
  breakdown,
  defaultName,
  defaultEmail,
}: CheckoutFormProps) {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const free = amountMinor === 0;
  // Whether the card fields are valid (reported by the Payment Element) and
  // whether it has loaded.
  const [cardComplete, setCardComplete] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  // Lets the expired-hold screen reassure the customer they weren't charged.
  const [paymentAttempted, setPaymentAttempted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AttendeeInput, string>>>({});
  const [isPending, startTransition] = useTransition();

  // Recomputed from the wall clock every second, so it stays correct when a
  // background tab's timers are throttled.
  const [remainingMs, setRemainingMs] = useState(() => expiresAt.getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => setRemainingMs(expiresAt.getTime() - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Client-side UX only; the payment actions re-check expiry on the server.
  // Navigating away never releases the hold: only finishing, the active-hold
  // banner's Cancel, or expiry ends it.
  const expired = remainingMs <= 0;

  function bookForMyself() {
    setName(defaultName);
    setEmail(defaultEmail);
  }

  function bookForSomeoneElse() {
    setName("");
    setEmail("");
    setPhone("");
    nameInputRef.current?.focus();
  }

  // router.back(), not push: pushing a URL already in history adds a duplicate
  // entry, so the listing's own Back button would return to checkout.
  // RefreshOnHistoryNavigation re-fetches the listing after back().
  function handleBackToListing() {
    router.back();
  }

  const paymentAvailable = free || stripePromise !== null;

  const canSubmit =
    !expired &&
    !isPending &&
    name.trim() !== "" &&
    email.trim() !== "" &&
    agreedToTerms &&
    paymentAvailable &&
    (free || (stripe !== null && elements !== null && cardComplete));

  // Paying runs in one transition, so the button stays disabled throughout:
  // 1. startHoldPaymentAction re-checks the attendee and hold and creates a
  //    PaymentIntent (or confirms a free order).
  // 2. stripe.confirmPayment authorizes the card, including 3-D Secure in
  //    Stripe's pop-up. Card only, so no redirect.
  // 3. confirmHoldPaymentAction secures the booking, then captures. If the hold
  //    expired, the authorization is released.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    // Same rules the server re-checks; run first for inline errors without a
    // round trip.
    const attendee = attendeeSchema.safeParse({ attendeeName: name, attendeeEmail: email, attendeePhone: phone });
    if (!attendee.success) {
      setFieldErrors(getFieldErrors(attendee.error));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      try {
        // Validates the card fields and shows Stripe's inline errors before
        // anything is created.
        if (!free) {
          const { error: submitError } = await elements!.submit();
          if (submitError) {
            setError(submitError.message ?? "Check your card details.");
            return;
          }
        }

        const started = await startHoldPaymentAction({
          orderId,
          attendeeName: name,
          attendeeEmail: email,
          attendeePhone: phone || undefined,
        });
        if (!started.ok) {
          setError(started.error);
          return;
        }
        if ("free" in started) {
          router.push(`/bookings/confirmation/${started.orderId}`);
          return;
        }

        setPaymentAttempted(true);
        const { error: confirmError, paymentIntent } = await stripe!.confirmPayment({
          elements: elements!,
          clientSecret: started.clientSecret,
          redirect: "if_required",
          // Only used by payment methods that redirect, which card-only
          // checkout doesn't.
          confirmParams: { return_url: `${window.location.origin}/bookings/confirmation/${orderId}` },
        });
        if (confirmError) {
          // Declined cards, failed verification, etc.; Stripe's messages are
          // written for customers.
          setError(confirmError.message ?? "Your card couldn't be charged. Try another card.");
          return;
        }

        const completed = await confirmHoldPaymentAction({ orderId, paymentIntentId: paymentIntent.id });
        if (!completed.ok) {
          setError(completed.error);
          return;
        }
        router.push(`/bookings/confirmation/${completed.orderId}`);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  // Never shown mid-payment: the server decides whether a last-second payment
  // counts, and its answer must reach the customer.
  if (expired && !isPending) {
    return <HoldExpiredNotice listingId={listingId} notCharged={paymentAttempted} />;
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-7 sm:px-6">
      <button
        type="button"
        onClick={handleBackToListing}
        className="mb-4 inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to listing
      </button>

      <div className="mb-6 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>Complete your booking before your hold expires.</span>
        {/* Server and browser render a second apart; the interval corrects it
            immediately. */}
        <span suppressHydrationWarning className="font-mono font-semibold text-red-600 tabular-nums">
          {formatCountdown(remainingMs)}
        </span>
      </div>

      <div className="mb-6 rounded-md border bg-card p-4">
        <p
          className={cn("text-xs font-bold tracking-wide uppercase", !accentColor && "text-muted-foreground")}
          style={{ color: accentColor && tagTextColor(accentColor) }}
        >
          {activityName}
        </p>
        {/* The page's h1, styled like the rest of the summary card. */}
        <h1 className="font-semibold">{listingName}</h1>
        <p className="text-sm text-muted-foreground">
          {venueName}, {cityName}
        </p>

        <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
          {scheduleLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {quantity > 1 && <p className="text-muted-foreground">Quantity: {quantity}</p>}
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">{breakdown ?? "Total"}</span>
          <span className="font-mono text-lg font-semibold">${total.toFixed(2)}</span>
        </div>
      </div>

      {/* noValidate: attendeeSchema is the only client-side check, so the
          browser's own popups don't fire with different wording. */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={bookForMyself}
              className="bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
            >
              Booking for myself
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={bookForSomeoneElse}
              className="bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
            >
              Booking for someone else
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendeeName">Full name</Label>
              <Input
                ref={nameInputRef}
                id="attendeeName"
                className="bg-card"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!fieldErrors.attendeeName}
                aria-describedby={fieldErrors.attendeeName ? "attendeeName-error" : undefined}
              />
              {fieldErrors.attendeeName && <p id="attendeeName-error" className="text-sm text-destructive">{fieldErrors.attendeeName}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendeeEmail">Email</Label>
              <Input
                id="attendeeEmail"
                className="bg-card"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldErrors.attendeeEmail}
                aria-describedby={fieldErrors.attendeeEmail ? "attendeeEmail-error" : undefined}
              />
              {fieldErrors.attendeeEmail && <p id="attendeeEmail-error" className="text-sm text-destructive">{fieldErrors.attendeeEmail}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendeePhone">Phone (optional)</Label>
              <Input
                id="attendeePhone"
                className="bg-card"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!fieldErrors.attendeePhone}
                aria-describedby={fieldErrors.attendeePhone ? "attendeePhone-error" : undefined}
              />
              {fieldErrors.attendeePhone && <p id="attendeePhone-error" className="text-sm text-destructive">{fieldErrors.attendeePhone}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="agreeToTerms"
            checked={agreedToTerms}
            onCheckedChange={setAgreedToTerms}
            required
            className="mt-0.5"
            // Named by the label and Terms button together so screen readers
            // hear the full sentence. Not aria-label: Base UI labels the
            // checkbox through aria-labelledby, which takes precedence.
            aria-labelledby="agreeToTerms-label agreeToTerms-terms"
          />
          {/* Only "I agree to {venueName}'s" is inside the <label>: clicking
              anywhere in a label toggles its checkbox, so the Terms trigger
              sits outside it. */}
          <span className="text-sm">
            <Label id="agreeToTerms-label" htmlFor="agreeToTerms" className="inline font-normal">
              I agree to {venueName}&apos;s{" "}
            </Label>
            <Dialog>
              <DialogTrigger id="agreeToTerms-terms" className="underline underline-offset-2">
                Terms and Conditions
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{venueName}&apos;s Terms and Conditions</DialogTitle>
                  <DialogDescription>Sample terms for this demo booking.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 text-sm text-foreground">
                  <p>
                    {`PlayBook is a portfolio project: ${venueName} is sample data, nothing is really reserved, and payments run in Stripe's test mode, so you're never charged.`}
                  </p>
                  <p>
                    In a live version, each venue would write its own booking terms here, covering cancellations,
                    no-shows and conduct.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </span>
        </div>

        {!free && (
          <div className="border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold">Payment</h2>
            {stripePromise ? (
              <>
                <TestCardHint />
                {/* Reserves space while Stripe's iframe loads, so the button
                    doesn't jump. */}
                {!paymentReady && (
                  <div className="flex flex-col gap-3" aria-hidden>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                )}
                <PaymentElement
                  onReady={() => setPaymentReady(true)}
                  onChange={(event) => setCardComplete(event.complete)}
                  options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Online payment isn&apos;t available right now.</p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {isPending ? "Processing..." : free ? "Confirm booking" : `Pay $${total.toFixed(2)}`}
        </Button>
      </form>
    </div>
  );
}

const TEST_CARD_NUMBER = "4242 4242 4242 4242";

// Test mode only: real cards are declined, so demo visitors need the test
// number. Blue, not amber (reserved for hold warnings). Copy rather than
// autofill: Stripe's iframe is out of the page's reach.
function TestCardHint() {
  // Result of the last copy, shown in a fading bubble above the button; the
  // button text never changes, so nothing shifts. `shown` drives the fade; the
  // bubble unmounts after.
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  const [shown, setShown] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function copy() {
    let next: "copied" | "failed";
    try {
      await navigator.clipboard.writeText(TEST_CARD_NUMBER.replaceAll(" ", ""));
      next = "copied";
    } catch {
      // Clipboard blocked: the number is on screen to type.
      next = "failed";
    }
    timers.current.forEach(clearTimeout);
    setResult(next);
    setShown(true);
    // Visible for 2 seconds, then a 300ms fade.
    timers.current = [
      window.setTimeout(() => setShown(false), 2000),
      window.setTimeout(() => setResult(null), 2300),
    ];
  }

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 sm:flex-row sm:items-center">
      <Info aria-hidden className="hidden size-4 shrink-0 text-blue-700 sm:block" />
      <p className="flex-1">
        <span className="font-semibold">Test mode, no real charges.</span> Use card{" "}
        <span className="font-mono font-semibold whitespace-nowrap">{TEST_CARD_NUMBER}</span>, any future date and any
        CVC.
      </p>
      <div className="relative shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={copy} className="w-full bg-card">
          <Copy aria-hidden />
          Copy card number
        </Button>
        {result && (
          // Overlaid, so it moves nothing. Hidden from screen readers; the
          // status line announces the same.
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white shadow-md transition-opacity duration-300",
              shown ? "opacity-100" : "opacity-0"
            )}
          >
            {result === "copied" && <Check className="size-3.5" />}
            {result === "copied" ? "Copied" : "Couldn't copy"}
          </span>
        )}
      </div>
      <span role="status" className="sr-only">
        {result === "copied" ? "Card number copied" : result === "failed" ? "Couldn't copy the card number" : ""}
      </span>
    </div>
  );
}
