import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { registerAccount } from "../../src/wayfarer/accounts";

let creatorEmail = process.env.SHIPWRIGHT_TEST_CREATOR_EMAIL ?? "shipwright.phase2.creator@example.test";
let creatorPassword = process.env.SHIPWRIGHT_TEST_CREATOR_PASSWORD ?? "Shipwright Phase2 2026!";

test.beforeAll(async ({ request }) => {
  if (process.env.SOUNDING_LINE_INTERNAL_RUNTIME !== "1") return;
  const identity = await request.get("/api/dev/validation/database-identity");
  expect(identity.status()).toBe(200);
  expect(await identity.json()).toEqual({ validationDatabase: true, nonceMatch: true });
  const nonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH;
  expect(nonceHash).toMatch(/^[a-f0-9]{64}$/u);
  expect(
    await db.platformAuditEvent.count({
      where: {
        action: "VALIDATION_DATABASE_IDENTITY",
        resourceType: "VALIDATION_DATABASE",
        resourceId: nonceHash,
        correlationId: nonceHash,
      },
    }),
  ).toBe(1);
  const fixtureId = randomUUID();
  creatorEmail = `shipwright-phase2-${fixtureId}@example.invalid`;
  creatorPassword = `Quartz-${fixtureId}!`;
  const { account } = await registerAccount({
    email: creatorEmail,
    password: creatorPassword,
    displayName: "Shipwright Synthetic Creator",
    deviceLabel: "Isolated Shipwright fixture",
  });
  await db.$transaction([
    db.userAccount.update({
      where: { id: account.id },
      data: { status: "ACTIVE", ordinaryWorkspaceEntryAt: new Date() },
    }),
    db.accountEmail.updateMany({
      where: { accountId: account.id },
      data: { verificationState: "VERIFIED", verifiedAt: new Date() },
    }),
    db.accountRoleAssignment.create({ data: { accountId: account.id, role: "CREATOR", grantedAt: new Date() } }),
  ]);
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.skip(({ browserName }) => browserName !== "chromium", "The task-owned mutable Studio journey runs once.");

test("Shipwright Phase 2 keeps contract-aware authoring usable across modes and responsive Inspector states", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const taleSlug = `shipwright-contract-aware-${Date.now()}`;

  await page.goto("/");
  await Promise.all([
    page.waitForURL(/\/studio\/sign-in(?:\?.*)?$/u),
    page.getByRole("link", { name: "Enter as Creator", exact: true }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Open Voyagewright Studio" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Continue to account sign-in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email or Player name", { exact: true }).fill(creatorEmail);
  await page.getByLabel("Password").fill(creatorPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/library/u);
  await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();

  await page.getByLabel("Studio destinations").getByRole("link", { name: "Create Chronicle" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Shipwright contract-aware browser proof");
  await page.getByLabel(/Address/).fill(taleSlug);
  await page.getByLabel("Short description", { exact: true }).fill("A disposable Creator Studio authoring proof.");
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect(page).toHaveURL(/\/studio\/tales\//u);
  await expect(page.getByRole("tab", { name: "Passages" })).toBeVisible({ timeout: 15_000 });
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

  // An authoritative Drydock issue must lead back to its ordinary Passage.
  // Exact field focus and local repair are covered by the component contract
  // because this first synthetic Chronicle intentionally has no terminal yet.
  await page.getByRole("button", { name: "Validate Chronicle" }).click();
  const validationPanel = page.getByRole("region", { name: "Chronicle validation results" });
  await expect(validationPanel).toBeVisible();
  await validationPanel.locator(".validation-issue").first().click();
  await expect(page.locator(".timeline-block").first()).toBeFocused();
  await validationPanel.getByRole("button", { name: "Close validation results", exact: true }).click();
  await expect(validationPanel).toBeHidden();

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

  const choiceLabel = page.getByLabel("Choice 1 label");
  const originalChoiceLabel = await choiceLabel.inputValue();
  await choiceLabel.fill("Follow the lantern");
  await page.getByRole("button", { name: "Undo last edit" }).click();
  await expect(choiceLabel).toHaveValue(originalChoiceLabel);
  await page.getByRole("button", { name: "Redo edit" }).click();
  await expect(choiceLabel).toHaveValue("Follow the lantern");
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.reload();
  await expect(page.locator(".timeline-block")).toHaveCount(4);
  await page.locator(".timeline-block").last().click();
  await expect(page.getByLabel("Choice 1 label")).toHaveValue("Follow the lantern");
  await expect(page.getByRole("button", { name: "Publish Chronicle" })).toBeVisible();

  await page.getByRole("button", { name: "Preview Passage" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close Passage preview" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Close Passage inspector" })).toBeVisible();
  await expect(authoringLevel).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(authoringLevel).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(authoringLevel).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include(".contract-aware-inspector").analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});
