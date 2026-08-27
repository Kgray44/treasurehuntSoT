import { expect, test } from "@playwright/test";

const creatorEmail = process.env.SHIPWRIGHT_TEST_CREATOR_EMAIL ?? "shipwright.phase5.creator@example.test";
const creatorPassword = process.env.SHIPWRIGHT_TEST_CREATOR_PASSWORD ?? "Shipwright Phase5 synthetic verifier 2026!";

test.skip(!process.env.SHIPWRIGHT_PHASE5_TASK_ROOT, "The Phase 5 browser proof requires its task-owned fixture.");
test.skip(({ browserName }) => browserName !== "chromium", "The task-owned mutable Studio journey runs once.");

// @sounding-line-registration owner=project-shipwright suite=browser.shipwright-phase5 contracts=authentication-authorization,publishing-browser browserProject=shipwright-phase5-chromium sourceProject=chromium
test("Shipwright Phase 5 lets a synthetic Creator review and publish an immutable Version", async ({ page }) => {
  test.setTimeout(300_000);
  const taleSlug = `shipwright-phase5-${Date.now()}`;

  await page.goto("/");
  await Promise.all([
    page.waitForURL(/\/studio\/sign-in(?:\?.*)?$/u),
    page.getByRole("link", { name: "Enter as Creator", exact: true }).click(),
  ]);
  await page.getByRole("link", { name: "Continue to account sign-in" }).click();
  await page.getByLabel("Email or legacy Player name").fill(creatorEmail);
  await page.getByLabel("Password").fill(creatorPassword);
  await page.getByRole("button", { name: "Continue" }).click();
  const studioReady = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/studio/tales") && response.request().method() === "GET" && response.ok(),
  );
  await page.getByLabel("Studio destinations").getByRole("link", { name: "Create Chronicle" }).click();
  await studioReady;
  await page.getByLabel("Title", { exact: true }).fill("Shipwright Phase 5 browser proof");
  await page.getByLabel(/Address/).fill(taleSlug);
  await page.getByLabel("Short description", { exact: true }).fill("A disposable staged-publication proof.");
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect(page.getByRole("tab", { name: "Passages" })).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: "Add Narrative to first chapter" }).click();
  await page.getByRole("button", { name: "Add Voyage Complete to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(2);
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });

  const previewPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Preview Voyage" }).click();
  const preview = await previewPromise;
  await preview.waitForLoadState("domcontentloaded");
  await expect(preview).toHaveURL(/\/play\//u);
  await preview.close();

  await page.getByRole("button", { name: "Validate Chronicle" }).click();
  await expect(page.locator(".save-state")).toContainText("Draft validation passed", { timeout: 15_000 });
  const taleId = new URL(page.url()).pathname.split("/").at(-1)!;

  await page.goto(`/studio/tales/${taleId}/trials`);
  await expect(page.getByRole("heading", { name: "Sea Trials" })).toBeVisible({ timeout: 90_000 });
  await page.getByLabel("Scenario title").fill("Baseline publication voyage");
  await page.getByRole("checkbox", { name: /Baseline successful path/i }).check();
  await page.getByRole("button", { name: "Add Continue" }).click();
  await page.getByRole("button", { name: "Add Continue" }).click();
  await page.getByRole("button", { name: "Save and run Sea Trial" }).click();
  await expect(page.getByRole("region", { name: "Sea Trial receipt" })).toContainText("COMPLETED", { timeout: 30_000 });
  await page.getByRole("button", { name: "Save current revisions as Suite" }).click();
  await expect(page.getByRole("button", { name: "Run Suite" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Run Suite" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Launch Gate" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Publish Chronicle" }).click();
  await expect(page).toHaveURL(new RegExp(`/studio/tales/${taleId}/versions#publication-review$`));
  await expect(page.getByRole("heading", { name: "Review and publish" })).toBeVisible();
  await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible();
  await page.getByLabel("Creator release notes").fill("Synthetic Creator staged publication proof.");
  await page.getByRole("checkbox", { name: /publishing creates an immutable Version/i }).check();
  await page.getByRole("button", { name: "Publish immutable Version" }).click();
  await expect(page.getByRole("heading", { name: "Immutable publication committed" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("status").locator("code")).toHaveText(/^[a-f0-9]{64}$/u);
  await expect(page.getByRole("link", { name: "Begin governed Community handoff" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create or start a Voyage" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Preview published edition" })).toBeVisible();
});
