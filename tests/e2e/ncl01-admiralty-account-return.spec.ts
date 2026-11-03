import { expect, test } from "@playwright/test";
import { accessible, signIn, workspace, registerNcl01ConsumerIsolation } from "./fixtures/ncl01-consumer";

// The three unchanged Administrator journeys use the canonical focused full-file route.
registerNcl01ConsumerIsolation();

for (const scenario of [
  { name: "DESKTOP NORMAL", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
  { name: "MOBILE NORMAL", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" },
  { name: "MOBILE REDUCED", viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
] as const) {
  test(`Administrator uses the real privacy-preserving People empty state and returns to the same account — ${scenario.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(scenario.viewport);
    await page.emulateMedia({ reducedMotion: scenario.reducedMotion });
    await signIn(page, "Administrator");
    await workspace(page, "Administrator", "Admiralty");
    await page.getByRole("link", { name: "People", exact: true }).click();
    await expect(page.getByRole("heading", { name: "People", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByText("Start with a known clue", { exact: true })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await accessible(page);

    const returnLink = page.getByRole("link", { name: "Return to account", exact: true });
    const signOut = page.getByRole("button", { name: "Sign out", exact: true });
    await expect(returnLink).toBeVisible();
    // Navigation focuses main content; reveal the earlier header with ordinary scrolling.
    await returnLink.scrollIntoViewIfNeeded();
    for (const control of [returnLink, signOut]) {
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
      // Check the actual view before an actionability check can scroll it.
      await expect
        .poll(() =>
          control.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return {
              inViewport:
                rect.width > 0 &&
                rect.height > 0 &&
                rect.left >= 0 &&
                rect.top >= 0 &&
                rect.right <= window.innerWidth &&
                rect.bottom <= window.innerHeight,
              unobscured: hit === element || (hit !== null && element.contains(hit)),
            };
          }),
        )
        .toEqual({ inViewport: true, unobscured: true });
      await control.click({ trial: true });
    }
    const width = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
    expect(width.body).toBeLessThanOrEqual(width.viewport + 1);

    // Reach and activate the return with real keyboard input, without DOM focus.
    for (let presses = 0; presses < 40; presses++) {
      await page.keyboard.press("Tab");
      if (await returnLink.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(returnLink).toBeFocused();
    expect(await returnLink.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/account$/u);
    await expect(page.getByRole("heading", { name: "Synthetic NCL01 Administrator", exact: true })).toBeVisible();
  });
}
