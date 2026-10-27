"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { finalizeBookingHoldAction } from "@/app/listings/[id]/actions";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Fills the billing fields with plausible, obviously-fake test values -
// a convenience for repeatedly exercising this flow during development,
// since nothing here is ever actually validated or charged (see the
// "stub billing" scope decision for this ticket). 4242 4242 4242 is
// Stripe's own canonical test card prefix, kept here so the number still
// reads as a test card even though no real Stripe integration exists yet.
function randomCardDetails() {
  const randomDigits = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const year = String((new Date().getFullYear() % 100) + 1 + Math.floor(Math.random() * 4)).padStart(2, "0");
  return {
    cardNumber: `4242 4242 4242 ${randomDigits(4)}`,
    cardExpiry: `${month}/${year}`,
    cardCvc: randomDigits(3),
  };
}

export function CheckoutForm({
  orderId,
  expiresAt,
  listingId,
  listingName,
  activityName,
  venueName,
  cityName,
  scheduleLines,
  quantity,
  total,
  breakdown,
  defaultName,
  defaultEmail,
}: {
  orderId: string;
  expiresAt: Date;
  listingId: string;
  listingName: string;
  activityName: string;
  venueName: string;
  cityName: string;
  scheduleLines: string[];
  quantity: number;
  total: number;
  breakdown: string | null;
  defaultName: string;
  defaultEmail: string;
}) {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-syncs to the real wall clock every second rather than counting
  // down from a fixed number, so the displayed time stays correct even
  // if this tab is backgrounded and its timers get throttled for a while.
  const [remainingMs, setRemainingMs] = useState(() => expiresAt.getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => setRemainingMs(expiresAt.getTime() - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Checked client-side purely for instant feedback - finalizeBookingHoldAction
  // re-checks this server-side regardless, since a stalled background tab
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

  function fillRandomCard() {
    const card = randomCardDetails();
    setCardNumber(card.cardNumber);
    setCardExpiry(card.cardExpiry);
    setCardCvc(card.cardCvc);
  }

  // router.back(), not router.push - pushing a fresh entry for a URL
  // already in history is what caused a real reported bug: going back to
  // the listing, then clicking "Back to browse" there, only popped this
  // new pushed entry and landed back on checkout instead of browse.
  // router.refresh() right after is also required, not optional - back()
  // restores the listing page from Next's in-memory navigation history
  // rather than always re-fetching, which could otherwise show its
  // pre-hold render (no active-hold banner) even though the hold this
  // page was just holding is still genuinely active.
  function handleBackToListing() {
    router.back();
    // Deferred one tick - back() triggers the history pop asynchronously,
    // and calling refresh() in the same tick races against that, often
    // refreshing whatever route the router still considers current at
    // that exact instant rather than the one just navigated back to.
    setTimeout(() => router.refresh(), 0);
  }

  // Billing fields are required but never actually validated or charged -
  // see the "stub billing" scope decision for this ticket. They exist so
  // the full checkout flow can be tried end to end; real Stripe test-mode
  // processing is its own later ticket.
  const canSubmit =
    !expired &&
    !isPending &&
    name.trim() !== "" &&
    email.trim() !== "" &&
    agreedToTerms &&
    cardNumber.trim() !== "" &&
    cardExpiry.trim() !== "" &&
    cardCvc.trim() !== "";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await finalizeBookingHoldAction({
        orderId,
        attendeeName: name,
        attendeeEmail: email,
        attendeePhone: phone || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/bookings/confirmation/${result.orderId}`);
    });
  }

  if (expired) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <TriangleAlert className="size-14 text-destructive" />
        <h1 className="text-2xl font-bold text-destructive">Your hold has expired</h1>
        <p className="text-muted-foreground">
          Your checkout session timed out and this slot is no longer reserved for you. Go back and pick a slot
          again - it may still be available.
        </p>
        <Link
          href={`/listings/${listingId}`}
          className={buttonVariants({ variant: "default", className: "mt-3" })}
        >
          Back to slot selection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-7 sm:px-6">
      <button
        type="button"
        onClick={handleBackToListing}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to listing
      </button>

      <div className="mb-6 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>Complete your booking before your hold expires.</span>
        <span className="font-mono font-semibold text-red-600 tabular-nums">{formatCountdown(remainingMs)}</span>
      </div>

      <div className="mb-6 rounded-md border bg-card p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{activityName}</p>
        <p className="font-semibold">{listingName}</p>
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <div className="mb-3 flex gap-2">
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
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendeeEmail">Email</Label>
              <Input
                id="attendeeEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendeePhone">Phone (optional)</Label>
              <Input id="attendeePhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

        <div className="border-t pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Billing details</h2>
            <Button type="button" variant="destructive" size="sm" onClick={fillRandomCard}>
              Generate random card details
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cardNumber">Card number</Label>
              <Input
                id="cardNumber"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cardExpiry">Expiry</Label>
                <Input
                  id="cardExpiry"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="MM/YY"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cardCvc">CVC</Label>
                <Input
                  id="cardCvc"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  placeholder="123"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {isPending ? "Confirming..." : `Pay $${total.toFixed(2)}`}
        </Button>
      </form>
    </div>
  );
}
