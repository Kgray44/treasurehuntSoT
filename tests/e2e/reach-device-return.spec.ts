// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { expect, test, type Locator, type Page } from "@playwright/test";

async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 40; count += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

async function finishGuidedTargets(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await expect(page.getByLabel(`Target ${index + 1} of ${count}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Move demo hand to target", exact: true }).click();
    if (index < count - 1) {
      await expect(page.getByLabel(`Target ${index + 2} of ${count}`, { exact: true })).toBeVisible({ timeout: 7000 });
    }
  }
  await expect(page.getByRole("button", { name: "Recalibrate", exact: true })).toBeVisible({ timeout: 7000 });
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`device connections return keeps its doorway clear of the header: ${viewport.name}, ${reducedMotion}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/devices/pair");
      await page.getByRole("link", { name: "Find the Hand interaction laboratory", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Find your point.", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Explore guided demo", exact: true }).click();
      const status = page.getByRole("status", { name: "Reach status", exact: true });
      await expect(status).toContainText("Your hand is ready");
      await page.getByRole("radio", { name: /Absolute pointing/ }).check();
      await page.getByRole("button", { name: "Begin nine-point calibration", exact: true }).click();
      await finishGuidedTargets(page, 9);
      await page.getByRole("button", { name: "Check five new targets", exact: true }).click();
      await finishGuidedTargets(page, 5);
      await expect(page.getByText("Your independent check passed for this session.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Open pointing playground", exact: true }).click();
      await page.getByRole("button", { name: "Show a practice target", exact: true }).click();
      await page.getByRole("button", { name: "Move demo hand to target", exact: true }).click();
      await page.getByRole("checkbox", { name: "Show raw pointer alongside filtered pointer", exact: true }).check();
      const condition = page.getByRole("combobox", { name: "Demo tracking condition", exact: true });
      await condition.selectOption("TWO_HANDS");
      await expect(status).toContainText("2 detected");

      // Match the captured lower-control keyboard path. No synthetic scroll,
      // component-ref injection, or forced viewport offset creates the failure.
      await condition.press("Enter");
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(condition).toHaveValue("EDGE");
      await expect(status).toContainText("Move your hand slightly toward the center");
      const returnLink = page.getByRole("link", { name: "← Device connections", exact: true });
      await tabTo(page, returnLink);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/devices\/pair$/);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const layer = document.querySelector('[data-route-layer="/devices/pair"]');
            return layer?.closest("[data-route-state]")?.getAttribute("data-route-state") ?? null;
          }),
        )
        .toBe("settled");

      // Do not focus, click, hover, or scroll this doorway before measuring it:
      // Playwright's actionability scrolling could otherwise repair the defect.
      const doorway = page.getByRole("link", { name: "Find the Hand interaction laboratory", exact: true });
      const layout = await doorway.evaluate((element) => {
        const header = document.querySelector(".product-shell-header");
        if (!header) throw new Error("Real product shell header is missing");
        const bounds = element.getBoundingClientRect();
        const headerBounds = header.getBoundingClientRect();
        const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
        const hit = document.elementFromPoint(center.x, center.y);
        return {
          scrollY: window.scrollY,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          link: { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right },
          header: { top: headerBounds.top, bottom: headerBounds.bottom },
          center,
          centerHitsDoorway: hit === element || (hit !== null && element.contains(hit)),
        };
      });
      const detail = JSON.stringify(layout);
      expect(layout.link.top, detail).toBeGreaterThanOrEqual(layout.header.bottom);
      expect(layout.link.left, detail).toBeGreaterThanOrEqual(0);
      expect(layout.link.right, detail).toBeLessThanOrEqual(layout.viewport.width);
      expect(layout.link.bottom, detail).toBeLessThanOrEqual(layout.viewport.height);
      expect(layout.centerHitsDoorway, detail).toBe(true);

      // Only after the untouched returned viewport passes, prove keyboard return.
      await tabTo(page, doorway);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/devices\/reach$/);
      await expect(page.getByRole("heading", { name: "Find your point.", exact: true })).toBeVisible();
    });
  }
}
