import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

const creatorEmail = process.env.SHIPWRIGHT_TEST_CREATOR_EMAIL ?? "shipwright.phase3.ordinary@example.test";
const creatorPassword = process.env.SHIPWRIGHT_TEST_CREATOR_PASSWORD ?? "Shipwright Phase3 ordinary verifier 2026!";
const ordinaryVerifierCreator = {
  id: "shipwright-p3-ordinary-account-creator",
  profileId: "shipwright-p3-ordinary-profile-creator",
  email: creatorEmail,
  displayName: "Shipwright Phase 3 Ordinary Verifier",
};

let database: PrismaClient | undefined;

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL?.startsWith("file:")) return;
  database = new PrismaClient();
  const existing = await database.accountEmail.findUnique({
    where: { normalizedEmail: ordinaryVerifierCreator.email },
    select: { id: true },
  });
  if (existing) return;

  const createdAt = new Date("2026-08-24T00:00:00.000Z");
  const passwordHash = await bcrypt.hash(creatorPassword, 10);
  await database.$transaction([
    database.userAccount.create({
      data: {
        id: ordinaryVerifierCreator.id,
        status: "ACTIVE",
        claimedAt: createdAt,
        ordinaryWorkspaceEntryAt: createdAt,
        lastSeenAt: createdAt,
        createdAt,
      },
    }),
    database.playerProfile.create({
      data: {
        id: ordinaryVerifierCreator.profileId,
        accountId: ordinaryVerifierCreator.id,
        displayName: ordinaryVerifierCreator.displayName,
        normalizedDisplayName: ordinaryVerifierCreator.displayName.toLocaleLowerCase(),
        handle: "shipwright-phase3-ordinary-verifier",
        normalizedHandle: "shipwright-phase3-ordinary-verifier",
        biography: "Synthetic Shipwright Phase 3 ordinary verifier. No real person is represented.",
        defaultVisibility: "ONLY_ME",
        status: "ACTIVE",
        claimedAt: createdAt,
        createdAt,
      },
    }),
    database.accountEmail.create({
      data: {
        accountId: ordinaryVerifierCreator.id,
        normalizedEmail: ordinaryVerifierCreator.email,
        displayEmail: ordinaryVerifierCreator.email,
        verificationState: "VERIFIED",
        verifiedAt: createdAt,
        createdAt,
      },
    }),
    database.accountCredential.create({
      data: { accountId: ordinaryVerifierCreator.id, passwordHash, changedAt: createdAt, createdAt },
    }),
    database.accountRoleAssignment.create({
      data: { accountId: ordinaryVerifierCreator.id, role: "CREATOR", grantedAt: createdAt },
    }),
  ]);
});

test.afterAll(async () => {
  await database?.$disconnect();
});

// @sounding-line-registration owner=project-shipwright suite=browser.shipwright-phase3 contracts=authentication-authorization browserProject=shipwright-phase3-chromium sourceProject=chromium
test.skip(({ browserName }) => browserName !== "chromium", "The task-owned mutable Studio journey runs once.");

test("Shipwright Phase 3 lets a Creator save and safely reuse governed composition", async ({ page }) => {
  test.setTimeout(120_000);
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
  await expect(page.getByText("Narrative preset")).toBeVisible({ timeout: 15_000 });

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
  await page.getByRole("button", { name: "Add Choice to first chapter" }).click();
  await page.getByRole("button", { name: "Add Narrative to first chapter" }).click();
  await page.getByRole("button", { name: "Add Voyage Complete to first chapter" }).click();
  await page.getByRole("button", { name: "Add Narrative to first chapter" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(5);
  await page.locator(".timeline-block").nth(1).click();
  await page.getByLabel("Choice 1 destination").selectOption({ index: 2 });
  await page.getByLabel("Choice 2 destination").selectOption({ index: 4 });
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.reload();
  await expect(page.locator(".timeline-block")).toHaveCount(5, { timeout: 15_000 });

  // The Choice makes both the fragment and its external destination reachable.
  // The fragment carries its own real terminal, and the final Narrative is the
  // compatible destination for the copied fragment entry.
  await page.locator(".timeline-block").nth(2).click();
  await page
    .locator(".timeline-block")
    .nth(3)
    .click({ modifiers: ["Control"] });
  await expect(page.getByText("2 Passages selected")).toBeVisible();
  await page.getByRole("tab", { name: "Reuse" }).click();
  await page.getByRole("button", { name: "Save 2 selected Passages as fragment" }).click();
  await expect(page.getByText("2 Passage fragment")).toBeVisible();
  await page.getByRole("tab", { name: "Passages" }).click();
  await page.locator(".timeline-block").nth(4).click();
  await page.getByRole("tab", { name: "Reuse" }).click();
  await expect(page.getByRole("button", { name: "Insert into selected Chapter" })).toBeVisible();
  await page.getByRole("button", { name: "Insert into selected Chapter" }).click();
  await expect(page.getByRole("button", { name: "Insert reusable content" })).toBeVisible();
  await page.getByRole("button", { name: "Insert reusable content" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(7);
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.getByRole("button", { name: "Undo last edit" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(5);
  await page.getByRole("button", { name: "Redo edit" }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(7);
});
