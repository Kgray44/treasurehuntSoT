import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import bcrypt from "bcryptjs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";

const evidenceRoot = path.resolve(
  process.env.BRIGHTWORK_WAVE4_EVIDENCE_ROOT ?? "artifacts/screenshots/brightwork-stage8-wave4",
);

async function createSyntheticCreator(browser: import("@playwright/test").Browser): Promise<BrowserContext> {
  const unique = randomUUID().slice(0, 12);
  const username = `brightwork-wave4-${unique}`;
  const password = `Brightwork-Wave4-${unique}-safe`;
  const activatedAt = new Date();
  const gm = await db.gameMasterUser.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role: "CAPTAIN_CREATOR" },
  });
  const account = await db.userAccount.create({
    data: {
      status: "ACTIVE",
      legacyGameMasterId: gm.id,
      claimedAt: activatedAt,
      ordinaryWorkspaceEntryAt: activatedAt,
    },
  });
  await db.$transaction([
    db.accountEmail.create({
      data: {
        accountId: account.id,
        normalizedEmail: `${username}@example.test`,
        displayEmail: `${username}@example.test`,
        verificationState: "VERIFIED",
        verifiedAt: activatedAt,
        isPrimary: true,
      },
    }),
    db.playerProfile.create({
      data: {
        accountId: account.id,
        displayName: "Synthetic Wave 4 Creator",
        status: "ACTIVE",
        claimedAt: activatedAt,
      },
    }),
    db.accountRoleAssignment.create({ data: { accountId: account.id, role: "CREATOR", scopeType: "GLOBAL" } }),
  ]);
  const context = await browser.newContext();
  const login = await context.request.post("/api/gm/login", { data: { username, password } });
  expect(login.ok(), await login.text()).toBeTruthy();
  return context;
}

async function assertAccessible(page: Page) {
  const analysis = await new AxeBuilder({ page }).analyze();
  expect(analysis.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(evidenceRoot, `${name}.png`), fullPage: true, caret: "hide" });
}

test("Brightwork Stage 8 Wave 4 presents Community and Studio workflows as bounded, accessible production surfaces", async ({
  browser,
}) => {
  await mkdir(evidenceRoot, { recursive: true });
  const context = await createSyntheticCreator(browser);
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto("/community?q=synthetic-wave4-no-match");
    const discovery = page.locator(".community-discovery").first();
    await expect(discovery).toHaveAttribute("data-search-active", "true");
    await expect(discovery.getByRole("heading", { name: "No public charts match these criteria" })).toBeVisible();
    await expect(page.locator(".community-shelves").first()).toBeHidden();
    await assertAccessible(page);
    await capture(page, "01-community-active-search-desktop");

    await page.goto("/community/voyage-logs/owner");
    await expect(page.getByRole("heading", { level: 1, name: "Your Voyage Log drafts", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No Voyage Log drafts yet", exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "02-voyage-log-private-workflow-desktop");

    await page.goto("/studio/exchange");
    await expect(page.getByRole("heading", { name: "Open the Exchange", exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Community Exchange workflow" })).toBeVisible();
    const previewPoster = page.locator('[data-testid="studio-community-exchange"] figure img');
    await expect(previewPoster).toHaveAttribute("src", "/animations/stills/compass-fallback.svg");
    await expect(previewPoster).toHaveJSProperty("complete", true);
    expect(
      await previewPoster.evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
    ).toBeTruthy();
    await page.getByRole("radio", { name: "Preview sandbox (no changes)" }).check();
    await page.getByRole("button", { name: "Open preview sandbox" }).click();
    await expect(page.getByText("Preview sandbox opened. No content was installed.")).toBeVisible();
    await assertAccessible(page);
    await capture(page, "03-studio-exchange-desktop");

    await page.goto("/studio/private-content");
    await expect(page.getByRole("heading", { name: "Private content", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inspect an encrypted package", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verified private export", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Private import history", exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "04-studio-private-content-desktop");

    await page.goto("/studio/tales/new");
    await expect(page.getByRole("heading", { name: "Create Chronicle", exact: true })).toBeVisible();
    await expect(page.locator(".new-tale-sheet .form-grid")).toBeVisible();
    await assertAccessible(page);
    await capture(page, "05-new-chronicle-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/community?q=synthetic-wave4-no-match");
    await expect(
      page
        .locator(".community-discovery")
        .first()
        .getByRole("heading", { name: "No public charts match these criteria" }),
    ).toBeVisible();
    await assertAccessible(page);
    await capture(page, "06-community-active-search-mobile");

    await page.goto("/studio/tales/new");
    await expect(page.getByRole("heading", { name: "Create Chronicle", exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "07-new-chronicle-mobile");
  } finally {
    await context.close();
  }
});
