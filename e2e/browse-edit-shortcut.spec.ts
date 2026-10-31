import { test, expect, type Page } from "@playwright/test";
import { authFile, fixtureIds } from "./fixtures";
import { expectNoViolations } from "./helpers";

// The edit gear on browse cards (GitHub #94): every card for an admin, their
// own venues' listings for an owner, none for anyone else; opens the edit page
// in a new tab. Uses the e2e courts (venue A owned by owner A, venue B by owner
// B).

const ids = () => fixtureIds();

const cards = (page: Page) => page.locator('main a[href^="/listings/"]');
const gears = (page: Page) => page.locator('main a[href^="/dashboard/listings/"]');
const gearFor = (page: Page, listingId: string) => page.locator(`main a[href="/dashboard/listings/${listingId}"]`);

async function openBrowse(page: Page) {
  await page.goto("/");
  await expect(page.locator(`main a[href="/listings/${ids().listingA}"]`)).toBeVisible();
}

test.describe("admin", () => {
  test.use({ storageState: authFile("admin") });

  test("sees a gear on every card, opening the edit page in a new tab", async ({ page }) => {
    await openBrowse(page);
    const cardCount = await cards(page).count();
    expect(cardCount).toBeGreaterThan(1);
    await expect(gears(page)).toHaveCount(cardCount);

    const gear = gearFor(page, ids().listingB);
    await expect(gear).toHaveAttribute("target", "_blank");
    await expect(gear).toHaveAccessibleName("Edit E2E Court B (opens in a new tab)");
  });

  test("browse has no accessibility violations with the gears shown", async ({ page }) => {
    await openBrowse(page);
    await expectNoViolations(page);
  });
});

test.describe("venue owner", () => {
  test.use({ storageState: authFile("ownerA") });

  test("sees a gear only on their own venue's listing", async ({ page }) => {
    await openBrowse(page);
    await expect(gearFor(page, ids().listingA)).toHaveCount(1);
    await expect(gearFor(page, ids().listingB)).toHaveCount(0);
    // Owner A's only listing is venue A's court.
    await expect(gears(page)).toHaveCount(1);
  });

  test("the gear opens the editor in a new tab and leaves browse as it was", async ({ page }) => {
    await openBrowse(page);
    const gear = gearFor(page, ids().listingA);
    // Reachable by keyboard.
    await gear.focus();
    await expect(gear).toBeFocused();

    const [editor] = await Promise.all([page.waitForEvent("popup"), gear.click()]);
    await expect(editor).toHaveURL(new RegExp(`/dashboard/listings/${ids().listingA}$`));
    await expect(editor.getByRole("heading", { level: 1 })).toHaveText("E2E Court A");
    await expect(page).toHaveURL(/\/$/);
    await editor.close();
  });

  test("the rest of the card still opens the public listing", async ({ page }) => {
    await openBrowse(page);
    await page.locator(`main a[href="/listings/${ids().listingA}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/listings/${ids().listingA}$`));
  });
});

test.describe("regular user", () => {
  test.use({ storageState: authFile("user") });

  test("sees no gears", async ({ page }) => {
    await openBrowse(page);
    await expect(gears(page)).toHaveCount(0);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sees no gears", async ({ page }) => {
    await openBrowse(page);
    await expect(gears(page)).toHaveCount(0);
  });
});
