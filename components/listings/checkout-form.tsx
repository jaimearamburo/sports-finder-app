"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
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

// Loaded once per page load, outside any component, so re-renders never
// re-download Stripe.js. null when the publishable key isn't configured -
// the form then says payments are unavailable rather than crashing.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

// The Payment Element renders inside Stripe's own iframe, so the site's CSS
// can't reach it - these variables restyle it to match the shared Input
// component (globals.css tokens): same font, border, radius, focus ring and
// error colour, so the card fields read as part of this form.
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
    ".Input": { border: "1px solid #e5e5e5", boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" },
    ".Input:focus": { borderColor: "#1857c4", boxShadow: "0 0 0 3px rgba(24, 87, 196, 0.5)" },
    ".Label": { fontWeight: "500", color: "#0a0a0a" },
  },
};

// iPhones zoom the page in when an input under 16px gets focus. The site's
// own Input avoids that with text-base below md and text-sm from md up;
// the card fields are in Stripe's iframe, out of reach of that CSS, so the
// same rule is applied through the appearance settings. Read once, when the
// form first renders in the browser (Stripe only reads it then too).
const NARROW_SCREEN = "(max-width: 767px)";
function checkoutAppearance(): Appearance {
  const narrow = typeof window !== "undefined" && window.matchMedia(NARROW_SCREEN).matches;
  return { ...STRIPE_APPEARANCE, variables: { ...STRIPE_APPEARANCE.variables, fontSizeBase: narrow ? "16px" : "14px" } };
}

// Same font as the rest of the site, loaded into Stripe's iframe.
const STRIPE_FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" }];

type CheckoutFormProps = {
  orderId: string;
  expiresAt: Date;
  listingId: string;
  listingName: string;
  activityName: string;
  // The listing's primary tag colour, for the category label - same source
  // as the listing page's own label. Undefined falls back to grey.
  accentColor?: string;
  venueName: string;
  cityName: string;
  scheduleLines: string[];
  quantity: number;
  total: number;
  // The total in cents and its currency, computed on the server exactly as
  // the PaymentIntent's amount will be (see startHoldPayment), so the
  // Payment Element is set up for the same charge.
  amountMinor: number;
  currency: string;
  breakdown: string | null;
  defaultName: string;
  defaultEmail: string;
};

// The Payment Element needs a surrounding <Elements> provider. It's set up
// in "deferred" mode (amount and currency only, no PaymentIntent yet): the
// PaymentIntent is created at submit time, once the attendee details are
// final, so a page view that never pays creates nothing on Stripe's side.
// captureMethod and the card-only method list must match what
// startHoldPayment creates, or Stripe rejects the confirmation. A free order
// has nothing to pay, so it gets no Stripe instance at all.
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
  // Whether the card fields are filled in validly (reported by the Payment
  // Element itself) and whether the element has finished loading.
  const [cardComplete, setCardComplete] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  // Set once a payment has been attempted, so an expired-hold screen can
  // reassure the customer their card wasn't charged.
  const [paymentAttempted, setPaymentAttempted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AttendeeInput, string>>>({});
  const [isPending, startTransition] = useTransition();

  // Re-syncs to the real wall clock every second rather than counting
  // down from a fixed number, so the displayed time stays correct even
  // if this tab is backgrounded and its timers get throttled for a while.
  const [remainingMs, setRemainingMs] = useState(() => expiresAt.getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => setRemainingMs(expiresAt.getTime() - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Checked client-side purely for instant feedback - the payment actions
  // re-check this server-side regardless, since a stalled background tab
  // can't be trusted to notice its own countdown hit zero. Deliberately
  // never released by just navigating away, including "Back to listing"
  // below (plain navigation, no side effect) - the hold is meant to stay
  // in force until it's either finalized, explicitly cancelled via the
  // listing page's own active-hold banner, or it naturally expires, so a
  // user who wanders off without deciding stays genuinely locked out of
  // starting a second booking, not quietly let back in. Cancelling only
  // from the banner (not here too) means there's exactly one place that
  // can end a hold early, and clicking "back" is never a surprise.
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

  // router.back(), not router.push - pushing a fresh entry for a URL
  // already in history is what caused a real reported bug: going back to
  // the listing, then clicking "Back to browse" there, only popped this
  // new pushed entry and landed back on checkout instead of browse. No
  // refresh needed here: back() is a history navigation, so
  // RefreshOnHistoryNavigation (root layout) re-fetches the listing page,
  // exactly as it does for the browser's own back button.
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

  // Paying is three steps, all inside one transition so the button stays
  // disabled throughout:
  // 1. startHoldPaymentAction re-checks the attendee details and the hold,
  //    and creates a PaymentIntent for the exact amount (or, for a free
  //    order, confirms it outright).
  // 2. stripe.confirmPayment authorizes the card in Stripe's iframe,
  //    including any bank verification (3-D Secure) in Stripe's own pop-up.
  //    Card only, so it never redirects away from this page.
  // 3. confirmHoldPaymentAction secures the booking and only then captures
  //    the money. If the hold ran out meanwhile, the authorization is
  //    released and nothing is charged.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    // Same attendee rules startHoldPayment re-checks server-side, run
    // first so a typo'd email or junk phone number is flagged inline,
    // under the field, with no round trip.
    const attendee = attendeeSchema.safeParse({ attendeeName: name, attendeeEmail: email, attendeePhone: phone });
    if (!attendee.success) {
      setFieldErrors(getFieldErrors(attendee.error));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      try {
        // Validates the card fields and shows Stripe's own inline errors
        // before anything is created server-side.
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
          // Only used if a payment method ever needs a redirect, which a
          // card-only checkout doesn't - the confirmation page can still
          // show the result if it does.
          confirmParams: { return_url: `${window.location.origin}/bookings/confirmation/${orderId}` },
        });
        if (confirmError) {
          // Declined cards, failed verification and the like - Stripe's own
          // message is written for customers.
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

  // Never swapped in while a payment is in flight: the server decides
  // whether a payment that lands at the last second still counts, and
  // its answer (including "you weren't charged") must reach the customer.
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
        {/* The server and the browser render this a moment apart, so the
            seconds can differ by one; that's expected for a clock, and the
            interval corrects it straight away. Without this, React treats
            the difference as a hydration error and re-renders the form. */}
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
        {/* The page's h1 - styled like the rest of the summary card, but a
            real heading so screen-reader users can find the page's subject. */}
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

      {/* noValidate: attendeeSchema in handleSubmit is the single
          client-side check, so the browser's own type="email" popup
          doesn't fire first with different wording. */}
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
          />
          {/* Only "I agree to {venueName}'s" sits inside the actual
              <label> - the Terms trigger is a sibling outside it on
              purpose. A click anywhere inside a <label for="..."> also
              toggles its associated control natively, so nesting the
              dialog trigger inside the label would silently flip the
              checkbox every time someone just meant to read the terms. */}
          <span className="text-sm">
            <Label htmlFor="agreeToTerms" className="inline font-normal">
              I agree to {venueName}&apos;s{" "}
            </Label>
            <Dialog>
              <DialogTrigger className="underline underline-offset-2">Terms and Conditions</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{venueName}&apos;s Terms and Conditions</DialogTitle>
                  <DialogDescription>Placeholder text</DialogDescription>
                </DialogHeader>
                <p className="text-sm text-foreground">
                  This is placeholder terms and conditions text for {venueName}. Each venue will eventually be able
                  to write and manage its own booking terms - covering things like cancellation, no-show, and
                  conduct policies - from its own dashboard. By checking the box, you agree to whatever terms this
                  venue ultimately sets here.
                </p>
              </DialogContent>
            </Dialog>
          </span>
        </div>

        {!free && (
          <div className="border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold">Payment</h2>
            {stripePromise ? (
              <>
                {/* Test mode only - real cards are declined, so visitors
                    trying the demo need to know which number to use. */}
                <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Test mode: use card <span className="font-mono text-foreground">4242 4242 4242 4242</span>, any
                  future date and any CVC.
                </p>
                {/* Held open while Stripe's iframe loads, so the button
                    below doesn't jump when the card fields appear. */}
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
