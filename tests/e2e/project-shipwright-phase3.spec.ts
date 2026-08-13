import { expect, test } from "@playwright/test";

test.skip(({ browserName }) => browserName !== "chromium", "The task-owned mutable Studio journey runs once.");

test("Shipwright Phase 3 lets a Creator save and safely reuse governed composition", async ({ page }) => {
  test.setTimeout(120_000);
  const creatorEmail = process.env.SHIPWRIGHT_TEST_CREATOR_EMAIL ?? "shipwright.phase2.creator@example.test";
  const creatorPassword = process.env.SHIPWRIGHT_TEST_CREATOR_PASSWORD ?? "Shipwright Phase2 2026!";
  const taleSlug = `shipwright-phase3-${Date.now()}`;

  await page.goto("/");
  await Promise.all([
    page.waitForURL(/\/studio\/sign-in(?:\?.*)?$/u),
    page.getByRole("link", { name: "Enter as Creator", exact: true }).click(),
  ]);
  await page.getByRole("link", { name: "Continue to account sign-in" }).click();
  await page.getByLabel("Email or legacy Player name").fill(creatorEmail);
  await page.getByLabel("Password").fill(creatorPassword);
  await page.getByRole("button", { name: "Continue" }).click();
  const csrfReady = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/studio/tales") && response.request().method() === "GET" && response.ok(),
  );
  await page.getByLabel("Studio destinations").getByRole("link", { name: "Create Chronicle" }).click();
  await csrfReady;
  await page.getByLabel("Title", { exact: true }).fill("Shipwright Phase 3 browser proof");
  await page.getByLabel(/Address/).fill(taleSlug);
  await page.getByLabel("Short description", { exact: true }).fill("A disposable reusable-composition proof.");
  await expect(page.getByRole("button", { name: "Create and open Chronicle" })).toBeEnabled();
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect(page.getByRole("tab", { name: "Passages" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Add Narrative to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(1);
  await page.locator(".timeline-block").first().click();
  await page.getByRole("tab", { name: "Reuse" }).click();
  await page.getByLabel("Reusable parameter key").fill("opening_text");
  await page.getByLabel("Reusable parameter label").fill("Opening text");
  await page.getByLabel("Reusable parameter destination").selectOption({ index: 1 });
  await page.getByLabel("Reusable parameter help text").fill("Player-facing opening.");
  await page.getByRole("button", { name: "Add parameter slot" }).click();
  await expect(page.getByText(/Opening text \(TEXT\)/)).toBeVisible();
  await page.getByRole("button", { name: "Save selected Passage as preset" }).click();
  await expect(page.getByText("Narrative preset")).toBeVisible();

  await page.getByRole("button", { name: "Apply to selected Passage" }).click();
  await expect(page.getByRole("heading", { name: "Configure Narrative preset" })).toBeVisible();
  await page
    .getByLabel(/Opening text/)
    .last()
    .fill("The parameterized harbor opens.");
  await page.getByRole("button", { name: "Preview insertion" }).click();
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("tab", { name: "Passages" }).click();
  await page.getByRole("button", { name: "Add Narrative to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(2);
  await page.locator(".timeline-block").first().click();
  await page
    .locator(".timeline-block")
    .nth(1)
    .click({ modifiers: ["Control"] });
  await expect(page.getByText("2 Passages selected")).toBeVisible();
  await page.getByRole("tab", { name: "Reuse" }).click();
  await page.getByRole("button", { name: "Save 2 selected Passages as fragment" }).click();
  await expect(page.getByText("2 Passage fragment")).toBeVisible();
  await expect(page.getByRole("button", { name: "Insert into selected Chapter" })).toBeVisible();
});
