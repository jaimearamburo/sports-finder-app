import { test, expect, type Page } from "@playwright/test";
import { authFile, fixtureIds } from "./fixtures";
import { query } from "./db";

// Who can reach the venue dashboard, and what each person can see and change
// there. These are the rules lib/authz enforces at three layers (proxy,
// page, data); the tests check the outcome from the outside, the way a
// person or a script would hit the app - including crafted requests that
// skip the UI, since Server Actions are public endpoints.

const ids = () => fixtureIds();

// Note: lists render twice (a table for desktop, cards for phones, one
// hidden by CSS), so "is visible" checks match the table's exact text, and
// "isn't there" checks match any text at all.

// Every dashboard page, as owner A would reach it.
const dashboardPaths = () => {
  const { venueA, listingA } = ids();
  return [
    "/dashboard",
    "/dashboard/venues",
    "/dashboard/venues/new",
    `/dashboard/venues/${venueA}`,
    `/dashboard/venues/${venueA}/edit`,
    `/dashboard/venues/${venueA}/listings/new`,
    `/dashboard/listings/${listingA}`,
    "/dashboard/bookings",
  ];
};

// Rewrites the body of the next Server Action request the page sends,
// replacing `from` with `to` - how a crafted request naming someone else's
// record would look. Waits for the action's response before returning.
async function tamperNextAction(page: Page, from: string, to: string, act: () => Promise<void>) {
  let done = false;
  await page.route("**/*", (route) => {
    const request = route.request();
    if (!done && request.method() === "POST" && request.headers()["next-action"]) {
      done = true;
      return route.continue({ postData: (request.postData() ?? "").split(from).join(to) });
    }
    return route.continue();
  });
  const response = page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
  await act();
  await response;
  await page.unroute("**/*");
}

test.describe("signed out", () => {
  test("every dashboard page sends you to log in, then back", async ({ page }) => {
    for (const path of dashboardPaths()) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=${encodeURIComponent(path).replace(/[.?]/g, "\\$&")}`));
    }
  });
});

test.describe("regular user", () => {
  test.use({ storageState: authFile("user") });

  test("has no dashboard link and is sent home from every dashboard page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /E2E User/ }).click();
    await expect(page.getByRole("link", { name: "My Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);

    for (const path of dashboardPaths()) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
    }
  });
});

test.describe("venue owner", () => {
  test.use({ storageState: authFile("ownerA") });

  test("sees only their own venue, listings and bookings", async ({ page }) => {
    const { attendeeA, attendeeB } = ids();
    await page.goto("/dashboard/venues");
    await expect(page.getByRole("link", { name: "E2E Venue A" })).toBeVisible();
    await expect(page.getByText("E2E Venue B")).toHaveCount(0);

    await page.goto("/dashboard/bookings");
    await expect(page.getByText(attendeeA, { exact: true })).toBeVisible();
    await expect(page.getByText(attendeeB)).toHaveCount(0);
  });

  test("gets Not found for another owner's venue and listing pages", async ({ page }) => {
    const { venueB, listingB } = ids();
    for (const path of [
      `/dashboard/venues/${venueB}`,
      `/dashboard/venues/${venueB}/edit`,
      `/dashboard/venues/${venueB}/listings/new`,
      `/dashboard/listings/${listingB}`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found");
    }
  });

  test("can't filter bookings to another owner's venue or listing", async ({ page }) => {
    const { venueB, listingB, attendeeA, attendeeB } = ids();
    await page.goto(`/dashboard/bookings?when=all&venue=${venueB}&listing=${listingB}`);
    // The foreign filters are dropped: owner A sees their own bookings, never B's.
    await expect(page.getByText(attendeeA, { exact: true })).toBeVisible();
    await expect(page.getByText(attendeeB)).toHaveCount(0);
    await expect(page.locator("#filter-venue")).toContainText("All venues");
  });

  test("can't archive another owner's listing with a crafted request", async ({ page }) => {
    const { venueA, listingA, listingB } = ids();
    await page.goto(`/dashboard/venues/${venueA}`);
    await page.getByRole("button", { name: "Archive E2E Court A" }).click();
    await tamperNextAction(page, listingA, listingB, () =>
      page.getByRole("dialog").getByRole("button", { name: "Archive" }).click()
    );
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("isn't one you manage");
    const rows = await query<{ id: string; archived_at: Date | null }>(
      "select id, archived_at from listings where id = any($1)",
      [[listingA, listingB]]
    );
    expect(rows.every((row) => row.archived_at === null)).toBe(true);
  });

  test("can't edit another owner's venue with a crafted request", async ({ page }) => {
    const { venueA, venueB } = ids();
    await page.goto(`/dashboard/venues/${venueA}/edit`);
    await page.locator("#name").fill("E2E Hacked");
    await tamperNextAction(page, venueA, venueB, () => page.getByRole("button", { name: "Save changes" }).click());
    await expect(page.getByRole("alert").filter({ hasText: "isn't one you manage" })).toBeVisible();
    const [venueBRow] = await query<{ name: string }>("select name from venues where id = $1", [venueB]);
    expect(venueBRow.name).toBe("E2E Venue B");
  });

  test("can't edit another owner's listing with a crafted request", async ({ page }) => {
    const { listingA, listingB } = ids();
    await page.goto(`/dashboard/listings/${listingA}`);
    await page.locator("#name").fill("E2E Hacked");
    await tamperNextAction(page, listingA, listingB, () => page.getByRole("button", { name: "Save changes" }).click());
    await expect(page.getByRole("alert").filter({ hasText: "isn't one you manage" })).toBeVisible();
    const [listingBRow] = await query<{ name: string }>("select name from listings where id = $1", [listingB]);
    expect(listingBRow.name).toBe("E2E Court B");
  });
});

test.describe("admin", () => {
  test.use({ storageState: authFile("admin") });

  test("sees and can open every venue, and every venue's bookings", async ({ page }) => {
    const { venueB, attendeeA, attendeeB } = ids();
    await page.goto("/dashboard/venues");
    await expect(page.getByRole("link", { name: "E2E Venue A" })).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E Venue B" })).toBeVisible();

    await page.goto(`/dashboard/venues/${venueB}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Venue B");
    await expect(page.getByText("E2E Owner B")).toBeVisible();

    await page.goto("/dashboard/bookings?when=all");
    await expect(page.getByText(attendeeA, { exact: true })).toBeVisible();
    await expect(page.getByText(attendeeB, { exact: true })).toBeVisible();
  });
});
