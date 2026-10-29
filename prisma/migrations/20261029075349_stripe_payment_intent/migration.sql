-- Payments use a Stripe PaymentIntent (the Payment Element on the checkout
-- page), not a hosted Checkout Session, so the never-used session column is
-- renamed rather than dropped and re-added: a rename keeps the column (all
-- null today) and is safe to apply to a database that already has bookings.
ALTER TABLE "bookings" RENAME COLUMN "stripe_checkout_session_id" TO "stripe_payment_intent_id";

-- The payment webhook looks bookings up by PaymentIntent.
CREATE INDEX "bookings_stripe_payment_intent_id_idx" ON "bookings"("stripe_payment_intent_id");
