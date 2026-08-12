import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.skip(({ browserName }) => browserName !== "chromium", "The task-owned mutable Studio journey runs once.");

test("Shipwright Phase 2 keeps contract-aware authoring usable across modes and responsive Inspector states", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const creatorEmail = process.env.SHIPWRIGHT_TEST_CREATOR_EMAIL ?? "shipwright.phase2.creator@example.test";
  const creatorPassword = process.env.SHIPWRIGHT_TEST_CREATOR_PASSWORD ?? "Shipwright Phase2 2026!";
  const taleSlug = `shipwright-contract-aware-${Date.now()}`;

  await page.goto("/");
  await page.getByRole("link", { name: "Enter as Creator", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open Voyagewright Studio" })).toBeVisible();
  await page.getByRole("link", { name: "Continue to account sign-in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email or legacy Player name").fill(creatorEmail);
  await page.getByLabel("Password").fill(creatorPassword);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/studio\/library/u);
  await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();

  await page.getByLabel("Studio destinations").getByRole("link", { name: "Create Chronicle" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Shipwright contract-aware browser proof");
  await page.getByLabel(/Address/).fill(taleSlug);
  await page.getByLabel("Short description", { exact: true }).fill("A disposable Creator Studio authoring proof.");
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect(page).toHaveURL(/\/studio\/tales\//u);
  await expect(page.getByRole("tab", { name: "Passages" })).toBeVisible();
  await page.getByRole("button", { name: "Add Narrative to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(1);
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.locator(".timeline-block").first().click();

  const authoringLevel = page.getByRole("combobox", { name: "Authoring level" });
  const passageTitle = page.getByRole("textbox", { name: "Passage title" });
  await expect(passageTitle).toHaveValue("Narrative");
  await expect(authoringLevel).toHaveValue("GUIDED");
  await authoringLevel.selectOption("DETAILED");
  await expect(page.getByText(/Detailed shows all supported authoring controls/)).toBeVisible();
  await authoringLevel.selectOption("ENGINEERING");
  await expect(page.getByText(/Contract/).last()).toBeVisible();
  await authoringLevel.selectOption("GUIDED");
  await expect(authoringLevel).toHaveValue("GUIDED");
  await expect(passageTitle).toHaveValue("Narrative");

  await page.getByRole("button", { name: "Add Set Variable to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(2);
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.locator(".timeline-block").last().click();
  await page.getByRole("button", { name: "Load declared variables" }).click();
  await expect(page.getByLabel("Choose a declared variable")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Operation" })).toHaveValue("set");

  await page.getByRole("button", { name: "Add Condition to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(3);
  await page.getByRole("combobox", { name: "Variable" }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add ALL group" }).click();
  await expect(page.getByRole("group", { name: "All of these must be true" })).toBeVisible();
  await page.getByLabel("When the condition is true").selectOption({ index: 1 });
  await page.getByLabel("When the condition is false").selectOption({ index: 2 });

  await page.getByRole("button", { name: "Add Choice to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(4);
  await page.getByLabel("Choice 1 destination").selectOption({ index: 1 });
  await page.getByLabel("Choice 2 destination").selectOption({ index: 2 });
  await expect(page.getByLabel("Choice 1 destination").locator("option").nth(1)).toContainText(
    "Chapter One · Narrative",
  );

  await page.getByRole("button", { name: "Preview Passage" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close Passage preview" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Close Passage inspector" })).toBeVisible();
  await expect(authoringLevel).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include(".contract-aware-inspector").analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});
