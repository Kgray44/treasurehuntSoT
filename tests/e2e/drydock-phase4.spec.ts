import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";

test.skip(({ browserName }) => browserName !== "chromium", "The task-owned mutable Drydock journey runs once.");

test("Drydock Phase 4 exposes current launch and compatibility decisions without enabling a broken Chronicle", async ({ browser }) => {
  test.setTimeout(90_000);
  const identifier = `drydock-phase4-${randomUUID().slice(0, 12)}`;
  const password = "Mooring-97!caraway";
  const account = await db.userAccount.create({ data: { status: "ACTIVE", claimedAt: new Date(), ordinaryWorkspaceEntryAt: new Date() } });
  await db.playerProfile.create({ data: { accountId: account.id, displayName: "Synthetic Drydock Creator", status: "ACTIVE", claimedAt: new Date() } });
  await db.accountEmail.create({ data: { accountId: account.id, normalizedEmail: `${identifier}@example.test`, displayEmail: `${identifier}@example.test`, isPrimary: true, verificationState: "VERIFIED", verifiedAt: new Date() } });
  await db.accountCredential.create({ data: { accountId: account.id, passwordHash: await bcrypt.hash(password, 10), changedAt: new Date() } });
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "CREATOR", scopeType: "GLOBAL" } });
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = await page.request.post("/api/auth/sign-in", { data: { login: `${identifier}@example.test`, password } });
  expect(login.ok(), await login.text()).toBeTruthy();

  await page.goto("/studio");
  await expect(page).toHaveURL(/\/studio\/library/u);
  await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();
  const studioReady = page.waitForResponse((response) => response.url().endsWith("/api/studio/tales") && response.request().method() === "GET");
  await page.getByRole("link", { name: "Create Chronicle", exact: true }).click();
  expect((await studioReady).ok()).toBeTruthy();
  await expect(page.getByRole("button", { name: "Create and open Chronicle" })).toBeEnabled();
  await page.getByLabel("Title", { exact: true }).fill("Synthetic Drydock browser Chronicle");
  await page.getByLabel(/Address/).fill(identifier);
  await page.getByLabel("Short description", { exact: true }).fill("A task-owned browser acceptance Chronicle.");
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect(page).toHaveURL(/\/studio\/tales\/(?!new(?:\/|$))[^/]+\/?$/u, { timeout: 30_000 });
  await page.getByRole("navigation", { name: "Chronicle authoring sections" }).getByRole("link", { name: "Sea Trials" }).click();
  await expect(page.getByRole("heading", { name: "Launch Gate" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compatibility" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sea Trials" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Publish Chronicle" })).toBeDisabled();
  await expect(page.getByText("NEEDS REPAIR")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Launch Gate" })).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  const axe = await new AxeBuilder({ page }).exclude("nextjs-portal").analyze();
  expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await context.close();
});
