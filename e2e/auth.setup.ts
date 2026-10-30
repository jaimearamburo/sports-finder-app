import { test as setup, expect } from "@playwright/test";
import { ACCOUNTS, ROLES, authFile, testPassword } from "./fixtures";

// Signs each test account in once and saves the session (cookies) to a
// file, so tests start already signed in as whichever account they need
// (`test.use({ storageState: authFile("ownerA") })`) instead of logging in
// every time. Playwright's recommended pattern.
for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(ACCOUNTS[role].email);
    await page.locator("#password").fill(testPassword());
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.context().storageState({ path: authFile(role) });
  });
}
