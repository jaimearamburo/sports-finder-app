import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Helpers shared by the end-to-end specs.

// The accessibility bar for the whole site: WCAG 2.2 AA plus axe's
// best-practice rules (see the accessibility notes in CLAUDE.md).
const RULE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

export async function expectNoViolations(page: Page) {
  // The Next.js dev overlay is development-only chrome, not part of the app.
  const results = await new AxeBuilder({ page }).withTags(RULE_TAGS).exclude("nextjs-portal").analyze();
  // A readable summary on failure: rule, impact and the offending elements.
  const summary = results.violations.map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
  expect(summary).toEqual([]);
}

// Rewrites the body of the next Server Action request the page sends,
// replacing `from` with `to` - how a crafted request naming someone else's
// record would look. Waits for the action's response before returning.
export async function tamperNextAction(page: Page, from: string, to: string, act: () => Promise<void>) {
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
