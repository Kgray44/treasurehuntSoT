import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hash } from "bcryptjs";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { seedAIEconomicsFixture } from "../../scripts/admiralty/ai-economics-fixture";

test.describe.configure({ mode: "serial", timeout: 240000 });
test.use({ video: "on" });
test.afterAll(() => db.$disconnect());
test("Administrator investigates AI economics and changes capability allowances through visible Admiralty controls", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  await db.aIUsageLedger.deleteMany({ where: { id: { startsWith: "synthetic-economics-" } } });
  const admin = await closureAccount("Synthetic economics Administrator");
  await db.accountRoleAssignment.create({ data: { accountId: admin.id, role: "ADMINISTRATOR" } });
  const password = "Synthetic-Economics-Only-2026!";
  await db.accountCredential.create({ data: { accountId: admin.id, passwordHash: await hash(password, 10) } });
  const accounts = {} as Record<"A" | "B" | "C" | "D" | "E", string>;
  for (const person of ["A", "B", "C", "D", "E"] as const)
    accounts[person] = (await closureAccount(`Synthetic Creator ${person}`)).id;
  const legacyPolicy = { ...defaultAIGlobalPolicy, enabled: true, advancedEnabled: true };
  delete legacyPolicy.roomModel;
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: {
      id: AI_CONTROL_ID,
      policy: JSON.stringify(legacyPolicy),
    },
    update: { policy: JSON.stringify(legacyPolicy), revision: 0 },
  });
  await db.aIQuotaUserPolicy.create({
    data: {
      accountId: accounts.D,
      policy: JSON.stringify({
        monthlyRequests: null,
        monthlySpendNano: null,
        advancedEnabled: true,
        requestsPerMinute: null,
        suspended: false,
        expiresAt: null,
      }),
    },
  });
  const seeded = await seedAIEconomicsFixture(db, accounts);
  await authenticateClosure(context, admin, baseURL!);
  await page.goto("/admin");
  await page.getByRole("link", { name: "AI Usage & Quotas", exact: true }).click();
  const workspace = page.getByRole("region", { name: "AI economics workspace", exact: true });
  await expect(workspace).toBeVisible({ timeout: 60000 });
  await expect(
    workspace.locator("article").filter({ hasText: "Observed AI cost" }).getByText("$3.23975", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(workspace.getByText("75 logical operations · 76 recorded provider attempts")).toBeVisible();
  const proof = "artifacts/admiralty-economics-attempt-ratios/browser";
  await mkdir(proof, { recursive: true });
  async function capture(name: string, visibleTarget?: Locator) {
    // A repeated journey records uninterrupted viewport transitions. The first
    // run retains the complete capture set; every product assertion still runs.
    if (test.info().repeatEachIndex > 0) return;
    if (visibleTarget) {
      await visibleTarget.scrollIntoViewIfNeeded();
      await visibleTarget.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      await page.screenshot({ path: `${proof}/${name}.png`, fullPage: false, animations: "disabled" });
      return;
    }
    await page.getByRole("heading", { level: 1 }).click();
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );
        return page.evaluate(() => window.scrollY);
      })
      .toBe(0);
    await page.screenshot({ path: `${proof}/${name}.png`, fullPage: true, animations: "disabled" });
  }
  await capture("overview-desktop");
  const dailyMetric = page.getByRole("combobox", { name: "Chart shows", exact: true });
  await dailyMetric.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("figure", { name: "Accounted spending per day by UTC day", exact: true })).toBeVisible();
  const dailyFallback = page.getByText("Read daily requests and costs as a table", { exact: true });
  await dailyFallback.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Daily activity table", exact: true })).toBeVisible();
  await expect(dailyFallback).toBeFocused();
  await capture("daily-fallback-keyboard-desktop", dailyFallback);
  await dailyFallback.focus();
  await page.keyboard.press("Enter");
  await dailyMetric.selectOption("requests");
  await workspace.getByRole("button", { name: "Quality & Outcomes", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(workspace.getByRole("heading", { name: "Synthetic Creator A", exact: true })).toBeVisible();
  await expect(
    workspace.getByText("40 reconstructions · 2 accepted operations · 5.0% recorded acceptance"),
  ).toBeVisible();
  await expect(workspace.getByText("does not establish a cause", { exact: false })).toBeVisible();
  const qualityControl = workspace.getByRole("button", { name: "Quality & Outcomes", exact: true });
  await expect(qualityControl).toBeFocused();
  await capture("quality-keyboard-desktop", qualityControl);
  await capture("quality-desktop");
  const ordinaryQuality = workspace.locator("article").filter({
    has: page.getByRole("heading", { name: "Grounded Assistant Edit", exact: true }),
  });
  const operationEfficiency = ordinaryQuality.locator("dl > div").filter({
    has: page.getByText("Operations per useful result", { exact: true }),
  });
  const providerEfficiency = ordinaryQuality.locator("dl > div").filter({
    has: page.getByText("Provider attempts per useful result", { exact: true }),
  });
  await expect(operationEfficiency.locator("dd")).toHaveText("1.14");
  await expect(providerEfficiency.locator("dd")).toHaveText("1.19");
  await expect(ordinaryQuality).toContainText("25 recorded provider attempts · 100.0% operation coverage");
  await capture("attempt-ratios-desktop", ordinaryQuality);
  const roomTrend = workspace.getByRole("group", { name: "Room Reconstruction quality trend", exact: true });
  const roomTrendDisclosure = roomTrend.getByRole("button", {
    name: "Room Reconstruction quality trend by UTC request day",
    exact: true,
  });
  await roomTrendDisclosure.focus();
  await page.keyboard.press("Enter");
  const dailyQuality = roomTrend.getByRole("region", { name: "Room Reconstruction daily quality table", exact: true });
  await expect(dailyQuality.getByRole("row")).toHaveCount(seeded.trendDays + 1);
  if (seeded.trendDays === 2) {
    await expect(dailyQuality.locator("tbody tr").first().getByRole("cell").nth(1)).toContainText("10.0%");
    await expect(dailyQuality.locator("tbody tr").last().getByRole("cell").nth(1)).toContainText("33.3%");
    await expect(dailyQuality.locator("tbody tr").first().getByRole("cell").last()).toHaveText("$0.64");
    await expect(dailyQuality.locator("tbody tr").last().getByRole("cell").last()).toHaveText("$0.192");
  }
  await capture("quality-trend-desktop");
  await dailyQuality.focus();
  await expect(dailyQuality).toBeFocused();
  await capture("quality-trend-keyboard-desktop", dailyQuality);
  await roomTrendDisclosure.focus();
  await page.keyboard.press("Enter");
  await workspace.getByRole("button", { name: "Inspect Synthetic Creator A", exact: true }).click();
  await expect(workspace.getByRole("button", { name: /^Inspect synthetic-economics/ })).toHaveCount(40);
  await capture("investigation-history-desktop");
  await workspace.getByRole("button", { name: "Operation History", exact: true }).click();
  await workspace.getByLabel("Person account ID", { exact: true }).fill(accounts.E);
  await workspace.getByRole("button", { name: "Search operation history", exact: true }).click();
  await expect(workspace.getByRole("button", { name: /^Inspect synthetic-economics/ })).toHaveCount(4);
  await workspace.getByRole("button", { name: "Overview", exact: true }).click();
  await workspace.getByRole("button", { name: "Apply economics filters", exact: true }).click();
  await expect(
    workspace.locator("article").filter({ hasText: "Observed AI cost" }).getByText("$3.23975", { exact: true }),
  ).toBeVisible();
  await workspace.getByRole("button", { name: "Operation History", exact: true }).click();
  await expect(workspace.getByRole("button", { name: /^Inspect synthetic-economics/ })).toHaveCount(4);
  await workspace
    .getByRole("combobox", { name: "Cost evidence", exact: true })
    .selectOption("UNKNOWN", { timeout: 15000 });
  await workspace.getByRole("button", { name: "Search operation history", exact: true }).click();
  await expect(workspace.getByRole("button", { name: /^Inspect synthetic-economics/ })).toHaveCount(2);
  await workspace.getByRole("combobox", { name: "Cost evidence", exact: true }).selectOption("", { timeout: 15000 });
  await workspace
    .getByRole("combobox", { name: "Sort operations", exact: true })
    .selectOption("COST_HIGHEST", { timeout: 15000 });
  await workspace.getByRole("button", { name: "Search operation history", exact: true }).click();
  await expect(workspace.getByRole("button", { name: /^Inspect synthetic-economics/ })).toHaveCount(4);
  await workspace
    .getByRole("button", { name: /^Inspect synthetic-economics/ })
    .first()
    .click();
  await expect(workspace.getByRole("region", { name: "AI operation inspector" })).toBeVisible();
  await capture("operation-inspector");
  await workspace.getByLabel("Person account ID", { exact: true }).clear();
  await workspace.getByRole("button", { name: "People & Allowances", exact: true }).click();
  await capture("people-desktop");
  await workspace.getByRole("link", { name: "Manage Synthetic Creator D allowances", exact: true }).click();
  const panel = page
    .locator("section.chartroom-panel")
    .filter({ has: page.getByRole("heading", { name: "AI usage & quotas", exact: true }) });
  await expect(panel.getByRole("region", { name: "Effective capability allowances" })).toBeVisible();
  await capture("allowance-effective-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("allowance-effective-mobile");
  await panel.getByLabel("Room Reconstruction monthly operations", { exact: true }).fill("3");
  await panel.getByLabel("Reason for user policy change").fill("Synthetic per-capability allowance review");
  await panel.getByRole("button", { name: "Preview user policy", exact: true }).click();
  const changes = panel.getByRole("region", { name: "Policy changes", exact: true });
  await expect(changes).toContainText("Room Reconstruction · Monthly operation allowance");
  const mobileChange = changes.getByRole("listitem").filter({
    hasText: "Room Reconstruction · Monthly operation allowance",
  });
  await expect(mobileChange.getByText("Current", { exact: true })).toBeVisible();
  await expect(mobileChange.getByText("Proposed", { exact: true })).toBeVisible();
  await expect(mobileChange.getByText("3", { exact: true })).toBeVisible();
  await capture("allowance-preview-mobile");
  await capture("allowance-preview-detail-mobile", changes);
  await page.setViewportSize({ width: 320, height: 720 });
  await expect.poll(() => changes.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(mobileChange.getByText("3", { exact: true })).toBeVisible();
  await capture("allowance-preview-320-mobile", changes);
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture("allowance-preview-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByLabel("Current password for privileged assurance").fill(password);
  await panel.getByRole("button", { name: "Verify current password", exact: true }).click();
  await panel.getByRole("button", { name: "Confirm & apply policy", exact: true }).click();
  await expect(panel.getByText(/Policy applied at revision 1/)).toBeVisible();
  await capture("allowance-applied-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture("allowance-applied-desktop");
  const override = await db.aIQuotaUserPolicy.findUniqueOrThrow({ where: { accountId: accounts.D } });
  expect(JSON.parse(override.policy).capabilityPolicies.ROOM_RECONSTRUCTION.monthlyRequests).toBe(3);
  expect(await db.aIQuotaPolicyRevision.count({ where: { targetAccountId: accounts.D } })).toBe(1);
  await page.getByRole("link", { name: "AI Usage & Quotas", exact: true }).click();
  await page.getByText("Policies, allowances & model configuration", { exact: true }).click();
  await page.getByRole("button", { name: "Global Policy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Versioned provider pricing", exact: true })).toBeVisible();
  await capture("configuration-desktop");
  await page.getByText("Policies, allowances & model configuration", { exact: true }).click();
  await workspace.getByRole("button", { name: "Capabilities", exact: true }).click();
  await expect(
    workspace
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Room Reconstruction", exact: true }) }),
  ).toContainText("gpt-6.1-sol · OPENAI");
  await capture("capabilities-desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await capture("capabilities-mobile");
  await workspace.getByRole("button", { name: "Operation History", exact: true }).click();
  await expect(workspace.getByRole("button", { name: /^Inspect synthetic-economics/ }).first()).toBeVisible();
  await capture("history-mobile");
  await workspace.getByRole("button", { name: "Overview", exact: true }).click();
  await capture("overview-mobile");
  const comparison = workspace.getByRole("region", { name: "Model cost comparison", exact: true });
  await expect(comparison.getByRole("columnheader")).toHaveCount(6);
  await comparison.focus();
  await comparison.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  for (let step = 0; step < 15; step++) await page.keyboard.press("ArrowRight");
  await expect.poll(() => comparison.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(comparison).toBeFocused();
  await expect(comparison.getByRole("columnheader", { name: "Accounted exposure", exact: true })).toBeInViewport();
  await capture("comparison-scroll-keyboard-mobile", comparison);
  await comparison.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const accessibility = await new AxeBuilder({ page }).include('[aria-label="AI economics workspace"]').analyze();
  expect(accessibility.violations.filter((finding) => ["serious", "critical"].includes(finding.impact ?? ""))).toEqual(
    [],
  );
  await workspace.getByRole("button", { name: "Quality & Outcomes", exact: true }).click();
  await capture("quality-mobile");
  await expect(operationEfficiency.locator("dd")).toHaveText("1.14");
  await expect(providerEfficiency.locator("dd")).toHaveText("1.19");
  await capture("attempt-ratios-mobile", ordinaryQuality);
  const historicCapture = await db.aIUsageLedger.findFirstOrThrow({
    where: { accountId: accounts.C },
    select: { id: true, capabilityVersion: true },
  });
  await db.aIUsageLedger.update({ where: { id: historicCapture.id }, data: { capabilityVersion: null } });
  await workspace.getByRole("button", { name: "Apply economics filters", exact: true }).click();
  await expect(providerEfficiency.locator("dd")).toHaveText("Unavailable");
  await expect(operationEfficiency.locator("dd")).toHaveText("1.14");
  await expect(ordinaryQuality).toContainText("25 recorded provider attempts · 95.8% operation coverage");
  await capture("attempt-coverage-mobile", ordinaryQuality);
  await db.aIUsageLedger.update({
    where: { id: historicCapture.id },
    data: { capabilityVersion: historicCapture.capabilityVersion },
  });
  await workspace.getByRole("button", { name: "Apply economics filters", exact: true }).click();
  await expect(providerEfficiency.locator("dd")).toHaveText("1.19");
  await roomTrendDisclosure.click();
  await expect(dailyQuality.getByRole("row")).toHaveCount(seeded.trendDays + 1);
  await capture("quality-trend-mobile");
  await dailyQuality.focus();
  for (let step = 0; step < 15; step++) await page.keyboard.press("ArrowRight");
  await expect.poll(() => dailyQuality.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(dailyQuality).toBeFocused();
  await expect(
    dailyQuality.getByRole("columnheader", { name: "Cost per useful result", exact: true }),
  ).toBeInViewport();
  await capture("quality-trend-keyboard-mobile", dailyQuality);
  const qualityAccessibility = await new AxeBuilder({ page })
    .include('[aria-label="AI economics workspace"]')
    .analyze();
  expect(
    qualityAccessibility.violations.filter((finding) => ["serious", "critical"].includes(finding.impact ?? "")),
  ).toEqual([]);
  await workspace.getByLabel("From date (UTC)").fill("2030-01-01");
  await workspace.getByLabel("Through date (UTC)").fill("2030-01-02");
  await workspace.getByRole("button", { name: "Apply economics filters", exact: true }).click();
  await expect(workspace.getByRole("heading", { name: "No AI operations in this period" })).toBeVisible();
  await capture("empty-mobile");
  await workspace.getByRole("button", { name: "This month", exact: true }).click();
  let releaseLoading!: () => void;
  const loading = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });
  await page.route("**/api/admin/ai-economics?**", async (route) => {
    await loading;
    await route.continue();
  });
  await workspace.getByRole("button", { name: "Apply economics filters", exact: true }).click();
  await expect(workspace.getByRole("button", { name: "Loading economics…", exact: true })).toBeVisible();
  await capture("loading-mobile");
  releaseLoading();
  await expect(workspace).toHaveAttribute("aria-busy", "false");
  await page.unroute("**/api/admin/ai-economics?**");
  await workspace.getByLabel("From date (UTC)").fill("2030-01-01");
  await workspace.getByLabel("Through date (UTC)").fill("2030-01-02");
  await workspace.getByRole("button", { name: "Apply economics filters", exact: true }).click();
  await expect(workspace.getByRole("heading", { name: "No AI operations in this period" })).toBeVisible();
  await workspace.getByRole("button", { name: "This month", exact: true }).click();
  await page.route("**/api/admin/ai-economics?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic accounting service interruption" }),
    }),
  );
  await workspace.getByRole("button", { name: "Apply economics filters", exact: true }).click();
  await expect(workspace.getByRole("alert")).toContainText("Synthetic accounting service interruption");
  await expect(workspace.getByRole("alert")).toContainText("Requested filter changes have not been applied");
  await capture("error-mobile");
  await page.unroute("**/api/admin/ai-economics?**");
  await workspace.getByRole("button", { name: "Retry economics", exact: true }).click();
  await expect(workspace.getByRole("alert")).toHaveCount(0);
  await expect(workspace.getByRole("heading", { name: "No AI operations in this period" })).toHaveCount(0);
  await capture("recovered-mobile");
});
