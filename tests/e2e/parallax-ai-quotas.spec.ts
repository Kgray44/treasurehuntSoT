import { test, expect } from "@playwright/test";
import { hash } from "bcryptjs";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { mkdir } from "node:fs/promises";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ actionTimeout: 30000, video: "on" });
test.afterAll(() => db.$disconnect());
test("Admiralty changes an AI allowance through the existing People dossier", async ({ page, context, baseURL }) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_QUOTA_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const operator = await closureAccount("Synthetic A1 quota operator"),
    creator = await closureAccount("Synthetic A1 quota Creator");
  await db.accountRoleAssignment.create({ data: { accountId: operator.id, role: "ADMINISTRATOR" } });
  const password = "Synthetic-A1-Quota-Only-2026!";
  await db.accountCredential.create({ data: { accountId: operator.id, passwordHash: await hash(password, 10) } });
  await authenticateClosure(context, operator, baseURL!);
  await page.goto("/admin/ai-usage");
  await expect(page.getByRole("heading", { name: "AI Usage & Quotas", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Users", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Search users", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Provider Health", exact: true }).click();
  await expect(page.getByRole("heading", { name: "OpenAI provider health" })).toBeVisible();
  const overview = await (await page.request.get("/api/admin/ai-usage")).json();
  expect(overview.provider).not.toHaveProperty("key");
  expect(overview.provider).not.toHaveProperty("OPENAI_API_KEY");
  const captureRoot = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(captureRoot, { recursive: true });
  if (overview.daily.every((day: { requests: number }) => day.requests === 0)) {
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page.getByRole("figure", { name: "Requests per day by UTC day", exact: true })).toBeVisible();
    await page.screenshot({ path: `${captureRoot}/owner-daily-empty.png`, fullPage: true });
  }
  const unauthorized = await page.request.post("/api/admin/commands/ai-quota-policy/preview", { data: {} });
  expect(unauthorized.status()).toBe(403);
  await page.goto("/admin/people");
  await page.getByLabel("Search", { exact: true }).fill(creator.id);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("link", { name: "Synthetic A1 quota Creator", exact: true }).click();
  const panel = page
    .locator("section.chartroom-panel")
    .filter({ has: page.getByRole("heading", { name: "AI usage & quotas", exact: true }) });
  await expect(panel.getByText("0 / 500", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${captureRoot}/owner-people-ai-dossier-desktop.png`, fullPage: true });
  await panel.getByLabel("Monthly request allowance (blank inherits)").fill("250");
  await panel.getByLabel("Reason for user policy change").fill("Synthetic browser allowance exception");
  await panel.getByRole("button", { name: "Preview user policy", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Confirm & apply policy" })).toBeDisabled();
  await panel.getByLabel("Current password for privileged assurance").fill(password);
  await panel.getByRole("button", { name: "Verify current password" }).click();
  await expect(panel.getByRole("button", { name: "Confirm & apply policy" })).toBeEnabled();
  await panel.getByRole("button", { name: "Confirm & apply policy" }).click();
  await expect(panel.getByText(/Policy applied at revision 1/)).toBeVisible();
  await expect(panel.getByText("0 / 250", { exact: true })).toBeVisible();
  expect(
    JSON.parse((await db.aIQuotaUserPolicy.findUniqueOrThrow({ where: { accountId: creator.id } })).policy)
      .monthlyRequests,
  ).toBe(250);
  expect(await db.aIQuotaPolicyRevision.count({ where: { targetAccountId: creator.id } })).toBe(1);
  await panel.getByLabel("Reason for user policy change").fill("Synthetic restore inherited allowance");
  await panel.getByRole("button", { name: "Preview restore inherited policy" }).click();
  await panel.getByLabel("Current password for privileged assurance").fill(password);
  await panel.getByRole("button", { name: "Verify current password" }).click();
  await expect(panel.getByRole("button", { name: "Confirm & apply policy" })).toBeEnabled();
  await panel.getByRole("button", { name: "Confirm & apply policy" }).click();
  await expect(panel.getByText("0 / 500", { exact: true })).toBeVisible();
  expect(
    JSON.parse((await db.aIQuotaUserPolicy.findUniqueOrThrow({ where: { accountId: creator.id } })).policy),
  ).toBeNull();
  expect(await db.aIQuotaPolicyRevision.count({ where: { targetAccountId: creator.id } })).toBe(2);
  expect(await db.aIUsageLedger.count({ where: { accountId: creator.id } })).toBe(0);
  await panel.evaluate((element) => element.setAttribute("data-parallax-ai-quota-fixture", "true"));
  const accessibility = await new AxeBuilder({ page }).include("[data-parallax-ai-quota-fixture]").analyze();
  expect(accessibility.violations.filter((finding) => ["serious", "critical"].includes(finding.impact ?? ""))).toEqual(
    [],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  await panel.screenshot({ path: test.info().outputPath("account-ai-quotas-mobile.png") });
  await page.screenshot({ path: `${captureRoot}/owner-people-ai-dossier-mobile.png`, fullPage: true });
  await page.goto("/admin/ai-usage");
  await page.getByRole("button", { name: "Global Policy", exact: true }).click();
  await page.getByLabel("Global spending cap (USD)", { exact: true }).fill("8");
  await page.getByLabel("Reason for change", { exact: true }).fill("Synthetic global resource ceiling");
  await page.getByRole("button", { name: "Preview global policy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm & apply policy" })).toBeDisabled();
  await page.getByLabel("Current password for privileged assurance").fill(password);
  await page.getByRole("button", { name: "Verify current password" }).click();
  await expect(page.getByRole("button", { name: "Confirm & apply policy" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm & apply policy" }).click();
  await expect(page.getByText(/Policy applied at revision 1/)).toBeVisible();
  const global = await db.aIQuotaControl.findUniqueOrThrow({ where: { id: "PARALLAX_SPATIAL_ASSISTANT" } });
  expect(JSON.parse(global.policy)).toMatchObject({ monthlySpendNano: 8000000000, enabled: false });
  expect(await db.aIQuotaPolicyRevision.count({ where: { targetAccountId: null } })).toBe(1);
});
