"use server";

import { confirmHoldPayment, createBookingHold, releaseBookingHold, startHoldPayment } from "@/lib/bookings";

export type {
  CompletePaymentResult,
  CreateBookingHoldResult,
  ReleaseBookingHoldResult,
  StartHoldPaymentResult,
} from "@/lib/bookings";

// Thin: Server Actions are reachable by direct POST, so all logic (auth,
// availability, capacity, payment checks) lives in lib/bookings.ts.
export async function createBookingHoldAction(input: {
  listingId: string;
  slots: { startsAt: Date; endsAt: Date }[];
  quantity?: number;
}) {
  return createBookingHold(input);
}

export async function startHoldPaymentAction(input: {
  orderId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
}) {
  return startHoldPayment(input);
}

export async function confirmHoldPaymentAction(input: { orderId: string; paymentIntentId: string }) {
  return confirmHoldPayment(input);
}

export async function releaseBookingHoldAction(input: { orderId: string }) {
  return releaseBookingHold(input);
}
