import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("first arrival supports skip, replay, reduced motion, and a semantic destination", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter as Player" })).toBeVisible();
  await expect(page.getByRole("link", { name: /TEST ANIMATIONS/ })).toBeVisible();
  const replay = page.getByRole("button", { name: "Replay presentation" });
  await expect(replay).toBeEnabled();
  await replay.click();
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(replay).toBeEnabled();

  await page.getByRole("button", { name: "Motion: full. Change motion setting" }).click();
  await expect(page.getByRole("button", { name: "Motion: gentle. Change motion setting" })).toBeVisible();
  await page.getByRole("button", { name: "Motion: gentle. Change motion setting" }).click();
  await expect(page.getByRole("button", { name: "Motion: reduced. Change motion setting" })).toBeVisible();
  await replay.click();
  const reducedSkip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await reducedSkip.isVisible().catch(() => false)) {
    try {
      await reducedSkip.click({ force: true, timeout: 2_500 });
    } catch {
      // Reduced-motion completion can detach the optional skip control while its click is dispatched.
    }
  }
  await expect(replay).toBeEnabled();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("development showcase exercises transport, trailer, assets, page turns, and local-only network policy", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "The heavy development lab runs once; landing behavior remains cross-browser.");
  const forbiddenRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(gm|player)\//.test(request.url())) forbiddenRequests.push(request.url());
  });

  await page.goto("/dev/animations");
  await expect(page.getByRole("heading", { name: "Forever Treasure Animation Showcase" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Animation playback controls" })).toBeVisible();
  await expect(page.getByText("No runtime errors.")).toBeVisible();

  await page.getByRole("button", { name: "reduced" }).click();
  await page.getByLabel("Scene").selectOption("release");
  await page.getByRole("button", { name: "Play selected scene" }).click();
  await expect(page.getByText("No scene")).toBeVisible({ timeout: 4_000 });

  await page.getByRole("button", { name: "Next journal page" }).click();
  await expect(page.getByText("Page 2 of 4")).toBeVisible();
  const lottiePanel = page.getByRole("heading", { name: "Lottie controls" }).locator("..");
  await lottiePanel.getByRole("button", { name: "Play", exact: true }).click();
  await lottiePanel.getByRole("button", { name: "Pause", exact: true }).click();
  await lottiePanel.getByRole("button", { name: "Segment" }).click();
  await lottiePanel.getByRole("button", { name: "2x" }).click();
  await lottiePanel.getByRole("button", { name: "Reverse", exact: true }).click();
  await lottiePanel.getByRole("button", { name: "Destroy" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("No runtime errors.")).toBeVisible();

  await page.getByRole("button", { name: "PLAY TRAILER" }).click();
  await expect(page.getByRole("button", { name: "STOP TRAILER" })).toBeVisible();
  await page.getByRole("button", { name: "STOP TRAILER" }).click();
  await expect(page.getByRole("button", { name: "PLAY TRAILER" })).toBeVisible({ timeout: 5_000 });
  expect(forbiddenRequests).toEqual([]);
});
