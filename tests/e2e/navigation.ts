import type { Page } from "@playwright/test";

const interruptedNavigation = (error: unknown) =>
  /is interrupted by another navigation/u.test(error instanceof Error ? error.message : String(error));

/**
 * A freshly started Next development server can finish compiling a route by
 * replacing its first navigation. Retry that one bounded interruption, while
 * letting every other navigation error remain visible to the test.
 */
export async function gotoStable(page: Page, path: string) {
  let interruption: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      if (!interruptedNavigation(error)) throw error;
      interruption = error;
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    }
  }
  throw interruption;
}
