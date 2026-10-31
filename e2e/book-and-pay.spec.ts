import { test, expect } from "@playwright/test";
import { ACCOUNTS, authFile, fixtureIds } from "./fixtures";
import { query } from "./db";

// The whole booking journey in a real browser: pick a court slot, hold it,
// fill in the attendee, pay with Stripe's 4242 test card, land on the
// confirmation page and find the booking in My Bookings. Talks to Stripe's
// test mode for real (the keys in .env); the payment is tagged with this
// environment, so the production webhook leaves it alone (PAYMENT_ENV).

test.use({ storageState: authFile("user") });

const TEST_CARD = { number: "4242 4242 4242 4242", expiry: "12 / 34", cvc: "123" };

async function userId(): Promise<string> {
  const [row] = await query<{ id: string }>("select id from users where email = $1", [ACCOUNTS.user.email]);
  return row.id;
}

// Tomorrow at the test venue, as the calendar labels it ("Tuesday 3
// November 2026"). Tomorrow rather than today, so a run late in the venue's
// day still finds start times that haven't passed.
async function venueTomorrow(): Promise<{ label: string; nextMonth: boolean }> {
  const [row] = await query<{ timezone: string }>(
    "select c.timezone from cities c join venues v on v.city_id = c.id where v.id = $1",
    [fixtureIds().venueA]
  );
  const part = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: row.timezone, ...options }).format(date);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const label = `${part(tomorrow, { weekday: "long" })} ${part(tomorrow, { day: "numeric" })} ${part(tomorrow, { month: "long" })} ${part(tomorrow, { year: "numeric" })}`;
  return { label, nextMonth: part(tomorrow, { month: "numeric" }) !== part(now, { month: "numeric" }) };
}

test.afterEach(async () => {
  // The fixture booking at this court stays; global teardown removes it.
  const id = await userId();
  await query("delete from booking_holds where user_id = $1", [id]);
  await query("delete from bookings where user_id = $1 and attendee_name = $2", [id, ACCOUNTS.user.name]);
});

test("book a court and pay with the test card", async ({ page }) => {
  test.slow(); // Stripe's iframe and the payment round trips take a while.

  await page.goto(`/listings/${fixtureIds().listingA}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Court A");

  const { label, nextMonth } = await venueTomorrow();
  if (nextMonth) await page.getByRole("button", { name: /next month/i }).click();
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("button", { name: "60 min" }).click();
  await page.getByRole("button", { name: "10:00 AM" }).click();
  await expect(page.getByText("1 hr × $20.00")).toBeVisible();
  await page.getByRole("button", { name: "Book Now" }).click();

  await page.waitForURL(/\/checkout\//);
  await page.getByRole("button", { name: "Booking for myself" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue(ACCOUNTS.user.name);
  await page.getByRole("checkbox", { name: "I agree to E2E Venue A's Terms and Conditions" }).check();

  // Stripe's card fields live in its own iframe (Stripe sometimes adds a
  // second one with the same title; the card fields are in the first).
  const card = page.frameLocator('iframe[title="Secure payment input frame"]').first();
  await card.getByPlaceholder("1234 1234 1234 1234").fill(TEST_CARD.number);
  await card.getByPlaceholder("MM / YY").fill(TEST_CARD.expiry);
  await card.getByPlaceholder("CVC").fill(TEST_CARD.cvc);

  // Scrolled into view first: with focus still in Stripe's iframe, a click
  // that has to scroll the button into view itself never reaches the page
  // (no pointer events at all, seen in every such run); a separate scroll
  // and then the click works every time.
  const pay = page.getByRole("button", { name: "Pay $20.00" });
  await pay.scrollIntoViewIfNeeded();
  await pay.click();

  await page.waitForURL(/\/bookings\/confirmation\//, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  const orderId = page.url().split("/").pop()!;
  const reference = orderId.slice(0, 8).toUpperCase();
  await expect(page.getByText(reference)).toBeVisible();

  const bookings = await query<{ status: string; amount_paid: string; stripe_payment_intent_id: string | null }>(
    "select status, amount_paid, stripe_payment_intent_id from bookings where order_id = $1",
    [orderId]
  );
  expect(bookings).toHaveLength(1);
  expect(bookings[0]).toMatchObject({ status: "confirmed", amount_paid: "20.00" });
  expect(bookings[0].stripe_payment_intent_id).toMatch(/^pi_/);

  await page.goto("/account");
  await expect(page.getByRole("button", { name: reference }).first()).toBeVisible();
});
