import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { authFile, fixtureIds } from "./fixtures";

// Automated accessibility checks of every dashboard page with axe-core, at
// phone and desktop widths - the same bar as the rest of the site (WCAG 2.2
// AA plus axe's best-practice rules; see the accessibility notes in
// CLAUDE.md). Dialogs and the listing form's different kinds are checked
// open, since axe only sees what's on the page. Automated checks catch a
// good share of problems, not all of them: a real screen reader pass is
// still worth doing by hand.

const RULE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const WIDTHS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 900 },
];

async function expectNoViolations(page: Page) {
  // The Next.js dev overlay is development-only chrome, not part of the app.
  const results = await new AxeBuilder({ page }).withTags(RULE_TAGS).exclude("nextjs-portal").analyze();
  // A readable summary on failure: rule, impact and the offending elements.
  const summary = results.violations.map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
  expect(summary).toEqual([]);
}

async function chooseActivity(page: Page, name: string) {
  await page.locator("#activityId").click();
  // Exact accessible name ("Tennis", not "Table Tennis"); the emoji in each
  // option is aria-hidden, so it isn't part of the name.
  await page.getByRole("option", { name, exact: true }).click();
}

test.describe("dashboard accessibility", () => {
  test.use({ storageState: authFile("ownerA") });

  for (const size of WIDTHS) {
    test.describe(size.name, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      // Pages checked as they load.
      const pages = () => {
        const { venueA, listingA } = fixtureIds();
        return [
          ["overview", "/dashboard"],
          ["venues", "/dashboard/venues"],
          ["add venue", "/dashboard/venues/new"],
          ["venue page", `/dashboard/venues/${venueA}`],
          ["edit venue", `/dashboard/venues/${venueA}/edit`],
          ["add listing", `/dashboard/venues/${venueA}/listings/new`],
          ["edit listing", `/dashboard/listings/${listingA}`],
          ["bookings", "/dashboard/bookings?when=all"],
          ["not found", "/dashboard/no-such-page"],
        ] as const;
      };

      test("pages", async ({ page }) => {
        for (const [name, path] of pages()) {
          await test.step(name, async () => {
            await page.goto(path);
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            await expectNoViolations(page);
          });
        }
      });

      test("listing form, each kind", async ({ page }) => {
        await page.goto(`/dashboard/venues/${fixtureIds().venueA}/listings/new`);
        for (const activity of ["Tennis", "Yoga Class", "Gym Day Pass", "Camping"]) {
          await test.step(activity, async () => {
            await chooseActivity(page, activity);
            await expect(page.locator("#name")).toBeVisible();
            await expectNoViolations(page);
          });
        }
      });

      test("form errors", async ({ page }) => {
        await page.goto(`/dashboard/venues/${fixtureIds().venueA}/listings/new`);
        await chooseActivity(page, "Tennis");
        await page.getByRole("button", { name: "Add listing" }).click();
        await expect(page.locator("#name-error")).toBeVisible();
        await expectNoViolations(page);
      });

      test("dialogs", async ({ page }) => {
        await test.step("archive listing", async () => {
          await page.goto(`/dashboard/venues/${fixtureIds().venueA}`);
          await page.getByRole("button", { name: "Archive E2E Court A" }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await expectNoViolations(page);
          await page.keyboard.press("Escape");
        });
        await test.step("booking details", async () => {
          await page.goto("/dashboard/bookings?when=all");
          await page.getByRole("button", { name: /details$/ }).filter({ visible: true }).first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await expectNoViolations(page);
        });
      });
    });
  }
});
