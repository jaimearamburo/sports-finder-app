import { test, expect, type Page } from "@playwright/test";
import { query } from "./db";
import { tamperNextAction } from "./helpers";

// Demo logins (lib/demo-login.ts). Uses the demo accounts configured in .env,
// since that configuration is under test; skipped when demo logins are off or
// the accounts don't exist.

const enabled = process.env.DEMO_LOGIN_ENABLED === "true";

async function accountName(email: string | undefined): Promise<string | null> {
  if (!email) return null;
  const [row] = await query<{ name: string | null }>("select name from users where email = $1", [email.toLowerCase()]);
  return row?.name ?? null;
}

async function demoBox(page: Page) {
  await page.goto("/login");
  const box = page.getByRole("region", { name: "Try the demo" });
  await expect(box).toBeVisible();
  return box;
}

test.describe("demo logins", () => {
  test.skip(!enabled, "DEMO_LOGIN_ENABLED is not on");
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });

  test("the page carries no credentials, only which demo to use", async ({ page }) => {
    const box = await demoBox(page);
    await expect(box.locator("input")).toHaveCount(0);
    const html = await page.content();
    for (const email of [process.env.DEMO_OWNER_EMAIL, process.env.DEMO_USER_EMAIL]) {
      if (email) expect(html).not.toContain(email);
    }
  });

  test("log in as regular user", async ({ page }) => {
    const name = await accountName(process.env.DEMO_USER_EMAIL);
    test.skip(!name, "the demo user doesn't exist in this database");
    const box = await demoBox(page);
    await box.getByRole("button", { name: "Log in as regular user" }).click();
    await expect(page.getByRole("button", { name: new RegExp(name!) })).toBeVisible();
  });

  test("log in as venue owner", async ({ page }) => {
    const name = await accountName(process.env.DEMO_OWNER_EMAIL);
    test.skip(!name, "the demo owner doesn't exist in this database");
    const box = await demoBox(page);
    await box.getByRole("button", { name: "Log in as venue owner" }).click();
    const account = page.getByRole("button", { name: new RegExp(name!) });
    await expect(account).toBeVisible();
    await expect(account).toContainText("Venue owner");
  });

  test("a crafted request for any other account is refused", async ({ page }) => {
    const box = await demoBox(page);
    // Rewrite account=owner to a non-demo value: nothing is signed in, and the
    // page says so.
    await tamperNextAction(page, "owner", "admin", () =>
      box.getByRole("button", { name: "Log in as venue owner" }).click()
    );
    await expect(box.getByRole("alert")).toContainText("isn't available");
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  });
});
