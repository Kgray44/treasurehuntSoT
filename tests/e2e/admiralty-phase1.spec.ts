import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = { accountId: string; email: string; displayName: string };
type Credentials = { fixtureVersion: string; password: string; accounts: Record<string, Alias> };
type Evidence = {
  id: string;
  capturePath: string;
  sha256: string;
  viewport: string;
  sourceSha: string;
  fixtureVersion: string;
};

const db = new PrismaClient();
const taskRoot = process.env.ADMIRALTY_PHASE1_TASK_ROOT
  ? path.resolve(process.env.ADMIRALTY_PHASE1_TASK_ROOT)
  : process.cwd();
const sourceSha = process.env.ADMIRALTY_PHASE1_SOURCE_SHA ?? "0000000000000000000000000000000000000000";
const credentialPath = path.join(taskRoot, "credentials", "admiralty-phase1-walkthrough.private.json");
let credentials: Credentials;
const evidenceRoot = path.join(taskRoot, "browser", "evidence");
const evidence: Evidence[] = [];

test.beforeAll(() => {
  credentials = JSON.parse(readFileSync(credentialPath, "utf8")) as Credentials;
});

test.afterAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "manifest.json"),
    `${JSON.stringify({ status: "AUTOMATED_BROWSER_PROOF_COMPLETE_OWNER_WALKTHROUGH_PENDING", sourceSha, fixtureVersion: credentials.fixtureVersion, records: evidence }, null, 2)}\n`,
    "utf8",
  );
  await db.$disconnect();
});

test("Journeys A-G: governed authority, assurance, consent, denial, revocation, and accessible responsive surfaces", async ({
  browser,
}) => {
  expect(credentials.fixtureVersion).toBe("admiralty-phase1-v1");
  const ordinary = await signedInPage(browser, "ORDINARY_USER", "/");
  await ordinary.page.goto("/account");
  await expect(ordinary.page.getByRole("link", { name: "Support Access", exact: true })).toBeVisible();
  await expect(ordinary.page.getByRole("link", { name: /Admiralty/u })).toHaveCount(0);
  const deniedResponse = await ordinary.page.goto("/admin");
  expect(deniedResponse?.status()).toBe(404);
  await expect(ordinary.page.getByRole("heading", { name: "Raise the Colors" })).toHaveCount(0);
  await expect(ordinary.page.locator("body")).not.toContainText(credentials.accounts.SUPPORT_TARGET.accountId);
  await capture(ordinary.page, "ADM1-EV-A-ORDINARY-ADMIN-DENIED");
  await ordinary.context.close();

  const admin = await signedInPage(browser, "ADMINISTRATOR", "/admin");
  await expect(admin.page.getByRole("heading", { name: "Platform Overview" })).toBeVisible();
  await expect(admin.page.getByText("Command center", { exact: true })).toBeVisible();
  await expect(admin.page.getByRole("heading", { name: "Your watch" })).toBeVisible();
  await expect(
    admin.page.locator("main").getByText(credentials.accounts.ADMINISTRATOR.displayName, { exact: true }),
  ).toBeVisible();
  await expect(admin.page.getByRole("link", { name: /Bridgewatch Open read-only station/u })).toBeVisible();
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM1-EV-B-ADMIN-SHELL");

  await admin.page.getByRole("link", { name: "Support cases", exact: true }).click();
  await admin.page.waitForURL((url) => url.pathname === "/admin/support/cases");
  await expect(admin.page.getByRole("heading", { name: "Support cases", exact: true })).toBeVisible();
  await expect(admin.page.getByText(/registered, bounded repair authority/u)).toBeVisible();

  const approvedTitle = "Synthetic sign-in diagnosis";
  const approvedPurpose = "Review synthetic account state and session diagnostics for a sign-in report.";
  await createSupportCase(admin.page, credentials.accounts.SUPPORT_TARGET.accountId, approvedTitle, approvedPurpose);
  const target = await signedInPage(browser, "SUPPORT_TARGET", "/account/support-access");
  await expect(target.page.getByText(approvedPurpose, { exact: true })).toBeVisible();
  await expect(target.page.getByText("Account state", { exact: true })).toBeVisible();
  await expect(target.page.getByText("Session diagnostics", { exact: true })).toBeVisible();
  await expect(target.page.locator("p").filter({ hasText: "Never included:" })).toContainText("passwords or hashes");
  await assertNoSeriousAxeViolations(target.page);
  await capture(target.page, "ADM1-EV-D-CONSENT-REVIEW");
  await target.page.getByRole("button", { name: "Approve exact categories" }).click();
  await expect(target.page.getByText("Your Support Access decision is in effect.", { exact: true })).toBeVisible();
  await expect(target.page.getByText(/^ACTIVE$/u)).toBeVisible();
  const approvedCase = await db.supportCase.findFirstOrThrow({
    where: {
      targetAccountId: credentials.accounts.SUPPORT_TARGET.accountId,
      title: approvedTitle,
      safeSummary: approvedPurpose,
    },
  });

  await admin.page.reload();
  const activeCase = admin.page.getByRole("article").filter({ hasText: approvedPurpose });
  await expect(activeCase.getByText(approvedTitle, { exact: false })).toBeVisible();
  await expect(activeCase.getByText("READY_FOR_DIAGNOSIS", { exact: true })).toBeVisible();
  await expect(activeCase.getByText("ACTIVE", { exact: true })).toBeVisible();
  const privilegedWork = admin.page.getByRole("region", { name: "Confirm privileged work" }).last();
  await privilegedWork.getByLabel("Confirm current password").fill(credentials.password);
  await privilegedWork.getByRole("button", { name: "Verify for governed repair work" }).click();
  await expect(admin.page.getByText("Recent privileged assurance is active for governed repair work.")).toBeVisible();
  await capture(admin.page, "ADM1-EV-C-ASSURANCE-ACTIVE");
  const grantId = await activeCase.getByLabel("Approved grant ID").inputValue();
  expect(grantId).toMatch(/^[A-Za-z0-9_-]+$/u);
  await activeCase.getByRole("button", { name: "Run read-only diagnosis" }).click();
  await expect(admin.page.getByRole("heading", { name: "Latest diagnostic execution · COMPLETE" })).toBeVisible();
  await expect(admin.page.getByText("INSUFFICIENT_SANITIZED_EVIDENCE", { exact: true })).toBeVisible();
  await expect(admin.page.getByText(/Proposed next action \(INFORMATION_ONLY\)/u)).toBeVisible();
  await expect(admin.page.getByText(/Auditable receipt digest:/u)).toBeVisible();
  await expect(admin.page.getByRole("button", { name: "Execute registered repair" })).toHaveCount(0);
  await expect(admin.page.locator("body")).not.toContainText("must-never-appear");
  await expect
    .poll(() =>
      db.platformAuditEvent.count({
        where: { action: "ADMIRALTY_SUPPORT_CASE_DIAGNOSED", resourceId: approvedCase.id },
      }),
    )
    .toBe(1);
  await capture(admin.page, "ADM1-EV-E-AUTHORIZED-PROJECTION");

  const deniedPurpose = "Review a synthetic access problem that the account owner may decline.";
  await createSupportCase(
    admin.page,
    credentials.accounts.DENIAL_TARGET.accountId,
    "Synthetic declined support diagnosis",
    deniedPurpose,
  );
  const denialTarget = await signedInPage(browser, "DENIAL_TARGET", "/account/support-access");
  await expect(denialTarget.page.getByText(deniedPurpose, { exact: true })).toBeVisible();
  await denialTarget.page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(denialTarget.page.getByText(/^DENIED$/u)).toBeVisible();
  await admin.page.reload();
  const deniedCase = admin.page.getByRole("article").filter({ hasText: deniedPurpose });
  await expect(deniedCase.getByText("CONSENT_DENIED", { exact: true })).toBeVisible();
  await expect(deniedCase.getByRole("button", { name: "Run read-only diagnosis" })).toHaveCount(0);
  await capture(admin.page, "ADM1-EV-F-SUPPORT-DENIED");
  await denialTarget.context.close();

  await target.page.reload();
  await target.page.getByRole("button", { name: "Revoke now" }).click();
  await expect(target.page.getByText(/^REVOKED$/u)).toBeVisible();
  await admin.page.reload();
  const revokedCase = admin.page.getByRole("article").filter({ hasText: approvedPurpose });
  await expect(revokedCase.getByText("CONSENT_REVOKED", { exact: true })).toBeVisible();
  await expect(revokedCase.getByText("REVOKED", { exact: true })).toBeVisible();
  await expect(revokedCase.getByRole("button", { name: "Run read-only diagnosis" })).toHaveCount(0);

  await target.page.setViewportSize({ width: 390, height: 844 });
  await target.page.emulateMedia({ reducedMotion: "reduce" });
  await target.page.reload();
  await expect(target.page.getByRole("heading", { name: "Support Access", exact: true })).toBeVisible();
  expect(
    await target.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  ).toBe(true);
  await target.page.keyboard.press("Tab");
  expect(await target.page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  await assertNoSeriousAxeViolations(target.page);
  await capture(target.page, "ADM1-EV-G-MOBILE-REDUCED-MOTION");
  await target.page.setViewportSize({ width: 720, height: 450 });
  await target.page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(target.page.getByRole("heading", { name: "Support Access", exact: true })).toBeVisible();
  await capture(target.page, "ADM1-EV-G-EFFECTIVE-200-PERCENT");

  const adminRole = await db.accountRoleAssignment.findFirstOrThrow({
    where: { accountId: credentials.accounts.ADMINISTRATOR.accountId, role: "ADMINISTRATOR", revokedAt: null },
  });
  await db.accountRoleAssignment.update({ where: { id: adminRole.id }, data: { revokedAt: new Date() } });
  const roleRevokedResponse = await admin.page.goto("/admin");
  expect(roleRevokedResponse?.status()).toBe(404);
  await db.accountRoleAssignment.update({ where: { id: adminRole.id }, data: { revokedAt: null } });
  const adminSession = await db.accountSession.findFirstOrThrow({
    where: { accountId: credentials.accounts.ADMINISTRATOR.accountId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  await db.accountSession.update({ where: { id: adminSession.id }, data: { revokedAt: new Date() } });
  const revokedSessionOverview = await admin.page.evaluate(async () => {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  expect(revokedSessionOverview.status).toBe(401);
  expect(revokedSessionOverview.body.code).toBe("ADMIRALTY_AUTH_REQUIRED");

  await target.context.close();
  await admin.context.close();
});

async function signedInPage(browser: Browser, key: string, returnTo: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const account = credentials.accounts[key];
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo);
  return { context, page } satisfies { context: BrowserContext; page: Page };
}

async function createSupportCase(page: Page, targetAccountId: string, title: string, summary: string) {
  await page.getByLabel("Target canonical account ID").fill(targetAccountId);
  await page.getByLabel("Case title").fill(title);
  await page.getByLabel("Safe case summary visible to the account owner").fill(summary);
  await page.getByRole("button", { name: "Open support case and request consent" }).click();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByText("AWAITING_CONSENT", { exact: true })).toBeVisible();
}

async function assertNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

async function capture(page: Page, id: string) {
  await mkdir(evidenceRoot, { recursive: true });
  const target = path.join(evidenceRoot, `${id}.png`);
  await page.screenshot({ path: target, fullPage: true });
  evidence.push({
    id,
    capturePath: target,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    viewport: `${page.viewportSize()?.width ?? 0}x${page.viewportSize()?.height ?? 0}`,
    sourceSha,
    fixtureVersion: credentials.fixtureVersion,
  });
}
