import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, authFile, fixtureIds } from "./fixtures";
import { query, utc } from "./db";

// The "booking in progress" banner on listing pages (one active hold per
// user). Going back from checkout returns the listing at the scroll
// position it was left at - usually the bottom, where Book Now is - so the
// banner, added above, must bring the page back to the top to be seen.
// The hold is inserted directly (the slot picker isn't what's under test).

const ids = () => fixtureIds();

test.use({ storageState: authFile("user") });

let orderId: string;

async function userId(): Promise<string> {
  const [row] = await query<{ id: string }>("select id from users where email = $1", [ACCOUNTS.user.email]);
  return row.id;
}

async function insertHold() {
  orderId = randomUUID();
  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  startsAt.setUTCHours(1, 0, 0, 0);
  await query(
    `insert into booking_holds (id, order_id, listing_id, starts_at, ends_at, user_id, quantity, expires_at)
     values ($1, $2, $3, $4, $5, $6, 1, $7)`,
    [
      `e2e-${randomUUID()}`,
      orderId,
      ids().listingA,
      utc(startsAt),
      utc(new Date(startsAt.getTime() + 60 * 60 * 1000)),
      await userId(),
      utc(new Date(Date.now() + 5 * 60 * 1000)),
    ]
  );
}

test.afterEach(async () => {
  await query("delete from booking_holds where user_id = $1", [await userId()]);
});

test("going back from checkout shows the banner at the top, and it can cancel the booking", async ({ page }) => {
  // On the listing page, scrolled to the bottom as when pressing Book Now.
  await page.goto(`/listings/${ids().listingA}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Court A");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);

  // A hold now exists; go to checkout within the app, then back.
  await insertHold();
  await page.evaluate((url) => (window as unknown as { next: { router: { push(url: string): void } } }).next.router.push(url), `/listings/${ids().listingA}/checkout/${orderId}`);
  await page.waitForURL(/\/checkout\//);
  await page.goBack();
  await page.waitForURL(new RegExp(`/listings/${ids().listingA}$`));

  const banner = page.getByText("You have a booking in progress");
  await expect(banner).toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(banner).toHaveCount(0);
  const holds = await query("select id from booking_holds where order_id = $1", [orderId]);
  expect(holds).toHaveLength(0);
});
