import type Stripe from "stripe";
import { completeOrderPayment } from "@/lib/bookings";
import { getStripe, PAYMENT_ENV } from "@/lib/stripe";

// Stripe's payment notifications. The browser normally completes a booking
// right after authorization (confirmHoldPayment), but the tab can close or the
// request can fail; this finishes the same work through the idempotent
// completeOrderPayment. Whichever arrives first does the work.
//
// Outside the auth proxy (no session); the signature check proves the request
// is from Stripe.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  // The signature covers the raw body, so it's read as text.
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
    // Card authorized: the backup for when the browser didn't complete the
    // booking.
    case "payment_intent.amount_capturable_updated":
    // Capture settled: confirms bookings left pending when the capture finished
    // after the browser's request returned.
    case "payment_intent.succeeded": {
      // Re-fetched: the event's copy can be stale, and events can arrive out of
      // order.
      const paymentIntent = await getStripe().paymentIntents.retrieve(event.data.object.id);
      // Another environment's payment (development shares this Stripe account,
      // not this database); that environment completes it. Untagged payments
      // are handled here.
      const paymentEnv = paymentIntent.metadata.env;
      if (paymentEnv && paymentEnv !== PAYMENT_ENV) break;
      const result = await completeOrderPayment(paymentIntent);
      if (!result.ok) console.warn(`Webhook ${event.id}: ${result.error}`);
      break;
    }
  }

  // 200 for every verified event, handled or not. Only a thrown error (database
  // or Stripe outage) returns 500, so Stripe retries.
  return new Response(null, { status: 200 });
}
