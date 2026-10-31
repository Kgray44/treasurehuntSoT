import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { expectUnavailableHtml } from "./fixtures/parallax-unavailable-html";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("PARALLAX_AVAILABILITY_OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`Owned Showcase controls and owner-only pilot preserve their distinct boundaries · ${viewport.name}`, async ({
    page,
    context,
    baseURL,
    browser,
  }) => {
    const name = "Synthetic non-pilot Creator";
    const creator = await closureAccount(name);
    await activateWorkspaceCapability(creator.id, "CREATOR");
    await authenticateClosure(context, creator, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // The guarded task-owned production build explicitly enables its animation lab.
    expect((await page.goto("/dev/animations"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Forever Treasure Animation Showcase", exact: true })).toBeVisible();
    const controls = page.getByRole("region", { name: "Animation playback controls", exact: true });
    const reduced = controls.getByRole("button", { name: "reduced", exact: true });
    await reduced.click();
    await expect(reduced).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Return to harbor", exact: true }).click();
    await expect(page).toHaveURL(new URL("/", baseURL!).href);
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    {
      const response = await page.goto("/dev/spatial-pilot");
      await expectUnavailableHtml(response, [
        "<h1>The Lost Navigator’s Chart</h1>",
        "Prepare the adventure",
        "Export one feedback report",
        'aria-label="Session preparation"',
      ]);
      await expect(page.getByRole("heading", { name: "This page could not be found.", exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: "Animation playback controls", exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "The Lost Navigator’s Chart", exact: true })).toHaveCount(0);
      const homeReturn = page.getByRole("link", { name: "Return", exact: true });
      await expect(homeReturn).toHaveAttribute("href", "/");
      await homeReturn.click();
      await expect(page).toHaveURL(new URL("/", baseURL!).href);
      await page.getByRole("button", { name, exact: true }).click();
      await page
        .locator("#shell-account-disclosure")
        .getByRole("link", { name: "Personal Harbor", exact: true })
        .click();
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Return to Home", exact: true }).click();
      await expect(page).toHaveURL(new URL("/", baseURL!).href);
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const visitor = await anonymous.newPage();
      expect((await visitor.goto(new URL("/dev/animations", baseURL!).href))?.status()).toBe(200);
      await expect(
        visitor.getByRole("heading", { name: "Forever Treasure Animation Showcase", exact: true }),
      ).toBeVisible();
      await expect(visitor.getByRole("region", { name: "Animation playback controls", exact: true })).toBeVisible();
      await expectUnavailableHtml(await visitor.goto(new URL("/dev/spatial-pilot", baseURL!).href), [
        "<h1>The Lost Navigator’s Chart</h1>",
        "Prepare the adventure",
        "Export one feedback report",
        'aria-label="Session preparation"',
      ]);
      await expect(visitor.getByRole("heading", { name: "This page could not be found.", exact: true })).toBeVisible();
    } finally {
      await anonymous.close();
    }
  });
}
