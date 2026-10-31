import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The site's accessibility bar: WCAG 2.2 AA plus axe's best-practice rules.
const RULE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

export async function expectNoViolations(page: Page) {
  // The Next.js dev overlay isn't part of the app.
  const results = await new AxeBuilder({ page }).withTags(RULE_TAGS).exclude("nextjs-portal").analyze();
  // Readable failure summary: rule, impact and offending elements.
  const summary = results.violations.map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
  expect(summary).toEqual([]);
}

// Rewrites `from` to `to` in the next Server Action request body, simulating a
// crafted request naming someone else's record. Waits for the response.
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
