import type Stripe from "stripe";
import { completeOrderPayment } from "@/lib/bookings";
import { getStripe } from "@/lib/stripe";

// Stripe's server-to-server notifications about payments. The browser
// normally completes a booking itself right after the card is authorized
// (confirmHoldPayment), but it can't be relied on: the tab can close, the
// network can drop, the server action can fail half-way. This route
// finishes the same work from Stripe's side, through the same
// completeOrderPayment, which is idempotent - whichever arrives first does
// the work and the other finds it done.
//
// Outside the auth proxy (it matches no /api routes) because Stripe has no
// session; the signature check below is what proves a request is Stripe's.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  // The signature covers the exact raw body, so it must be read as text -
  // parsing it as JSON first would change the bytes and fail verification.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    // The card is authorized: the browser normally completes the booking
    // first, so this is the backup for when it doesn't.
    case "payment_intent.amount_capturable_updated":
    // The capture went through: confirms bookings left "pending" if the
    // capture settled after the browser's request had already returned.
    case "payment_intent.succeeded": {
      // Re-fetched rather than trusting the event's copy, which is a
      // snapshot that may be out of date by the time it arrives (events
      // aren't guaranteed to arrive in order).
      const paymentIntent = await getStripe().paymentIntents.retrieve(event.data.object.id);
      const result = await completeOrderPayment(paymentIntent);
      if (!result.ok) console.warn(`Webhook ${event.id}: ${result.error}`);
      break;
    }
  }

  // 200 for every verified event, including ones not handled above and
  // payments that couldn't be applied (already released, nothing to
  // retry). Only a thrown error - a database or Stripe outage - becomes a
  // 500, which makes Stripe retry the event later.
  return new Response(null, { status: 200 });
}
