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
  await expect(admin.page.getByRole("heading", { name: "Raise the Colors" })).toBeVisible();
  await expect(admin.page.getByText("92 governed floor entries", { exact: true })).toBeVisible();
  await expect(admin.page.getByText("Base administrative access", { exact: true })).toBeVisible();
  await expect(admin.page.getByText(credentials.accounts.ADMINISTRATOR.accountId, { exact: true })).toBeVisible();
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM1-EV-B-ADMIN-SHELL");

  let overview = await getOverview(admin.page);
  const assuranceRequired = await adminPost(admin.page, overview.operator.csrfToken, "/api/admin/support/read", {
    grantId: "adm1-no-grant",
    targetAccountId: credentials.accounts.SUPPORT_TARGET.accountId,
    scope: "ACCOUNT_STATE",
  });
  expect(assuranceRequired.status).toBe(403);
  expect(assuranceRequired.body.code).toBe("ADMIRALTY_ASSURANCE_REQUIRED");

  await admin.page.getByLabel("Confirm current password").fill(credentials.password);
  await admin.page.getByRole("button", { name: "Verify for privileged work" }).click();
  await expect(admin.page.getByText("Recently verified", { exact: true })).toBeVisible();
  await expect(admin.page.getByText("Privileged assurance is active for this session.", { exact: true })).toBeVisible();
  await capture(admin.page, "ADM1-EV-C-ASSURANCE-ACTIVE");
  overview = await getOverview(admin.page);
  await db.privilegedAssurance.updateMany({
    where: { accountId: credentials.accounts.ADMINISTRATOR.accountId, revokedAt: null },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });
  const assuranceExpired = await adminPost(admin.page, overview.operator.csrfToken, "/api/admin/support/read", {
    grantId: "adm1-no-grant",
    targetAccountId: credentials.accounts.SUPPORT_TARGET.accountId,
    scope: "ACCOUNT_STATE",
  });
  expect(assuranceExpired.status).toBe(403);
  expect(assuranceExpired.body.code).toBe("ADMIRALTY_ASSURANCE_EXPIRED");
  await admin.page.reload();
  await expect(admin.page.getByText("Base administrative access", { exact: true })).toBeVisible();
  await admin.page.getByLabel("Confirm current password").fill(credentials.password);
  await admin.page.getByRole("button", { name: "Verify for privileged work" }).click();
  await expect(admin.page.getByText("Recently verified", { exact: true })).toBeVisible();

  const approvedPurpose = "Review synthetic account and authentication diagnostics for a sign-in report.";
  await createSupportRequest(admin.page, credentials.accounts.SUPPORT_TARGET.accountId, approvedPurpose);
  const approvedRequest = await db.supportAccessRequest.findFirstOrThrow({
    where: { targetAccountId: credentials.accounts.SUPPORT_TARGET.accountId, purpose: approvedPurpose },
  });
  const target = await signedInPage(browser, "SUPPORT_TARGET", "/account/support-access");
  await expect(target.page.getByText(approvedPurpose, { exact: true })).toBeVisible();
  await expect(target.page.getByText("Account state", { exact: true })).toBeVisible();
  await expect(target.page.getByText("Authentication events", { exact: true })).toBeVisible();
  await expect(target.page.locator("p").filter({ hasText: "Never included:" })).toContainText("passwords or hashes");
  await assertNoSeriousAxeViolations(target.page);
  await capture(target.page, "ADM1-EV-D-CONSENT-REVIEW");
  await target.page.getByRole("button", { name: "Approve exact categories" }).click();
  await expect(target.page.getByText("Your Support Access decision is in effect.", { exact: true })).toBeVisible();
  await expect(target.page.getByText(/^ACTIVE$/u)).toBeVisible();
  const grant = await db.supportAccessGrant.findUniqueOrThrow({ where: { requestId: approvedRequest.id } });

  await admin.page.reload();
  const activeRequestCard = admin.page.locator("article").filter({ hasText: approvedPurpose });
  await expect(activeRequestCard.getByText("ACTIVE", { exact: true })).toBeVisible();
  await activeRequestCard.getByRole("button", { name: "Account state", exact: true }).click();
  await expect(admin.page.getByText("Authorized support projection", { exact: true })).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("must-never-appear");
  await activeRequestCard.getByRole("button", { name: "Authentication events", exact: true }).click();
  await expect(admin.page.locator("body")).not.toContainText("must-never-appear");
  await expect
    .poll(() =>
      db.platformAuditEvent.count({
        where: { action: "ADMIRALTY_SUPPORT_SCOPE_READ", resourceId: credentials.accounts.SUPPORT_TARGET.accountId },
      }),
    )
    .toBeGreaterThanOrEqual(2);
  await capture(admin.page, "ADM1-EV-E-AUTHORIZED-PROJECTION");

  const deniedPurpose = "Review a synthetic access problem that the account owner may decline.";
  await createSupportRequest(admin.page, credentials.accounts.DENIAL_TARGET.accountId, deniedPurpose);
  const deniedRequest = await db.supportAccessRequest.findFirstOrThrow({
    where: { targetAccountId: credentials.accounts.DENIAL_TARGET.accountId, purpose: deniedPurpose },
  });
  const denialTarget = await signedInPage(browser, "DENIAL_TARGET", "/account/support-access");
  await expect(denialTarget.page.getByText(deniedPurpose, { exact: true })).toBeVisible();
  await denialTarget.page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(denialTarget.page.getByText(/^DENIED$/u)).toBeVisible();
  expect(await db.supportAccessGrant.count({ where: { requestId: deniedRequest.id } })).toBe(0);
  overview = await getOverview(admin.page);
  const deniedRead = await adminPost(admin.page, overview.operator.csrfToken, "/api/admin/support/read", {
    grantId: deniedRequest.id,
    targetAccountId: credentials.accounts.DENIAL_TARGET.accountId,
    scope: "ACCOUNT_STATE",
  });
  expect(deniedRead.status).toBe(403);
  expect(deniedRead.body.code).toBe("SUPPORT_GRANT_REQUIRED");
  await admin.page.reload();
  const deniedCard = admin.page.locator("article").filter({ hasText: deniedPurpose });
  await expect(deniedCard.getByText("DENIED", { exact: true })).toBeVisible();
  await expect(deniedCard.getByRole("button", { name: "Account state", exact: true })).toHaveCount(0);
  await capture(admin.page, "ADM1-EV-F-SUPPORT-DENIED");
  await denialTarget.context.close();

  await target.page.reload();
  await target.page.getByRole("button", { name: "Revoke now" }).click();
  await expect(target.page.getByText(/^REVOKED$/u)).toBeVisible();
  overview = await getOverview(admin.page);
  const revokedRead = await adminPost(admin.page, overview.operator.csrfToken, "/api/admin/support/read", {
    grantId: grant.id,
    targetAccountId: credentials.accounts.SUPPORT_TARGET.accountId,
    scope: "ACCOUNT_STATE",
  });
  expect(revokedRead.status).toBe(403);
  expect(revokedRead.body.code).toBe("SUPPORT_GRANT_REVOKED");
  expect(
    await db.platformAuditEvent.count({ where: { action: "ADMIRALTY_SUPPORT_GRANT_REVOKED", resourceId: grant.id } }),
  ).toBe(1);

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

async function createSupportRequest(page: Page, targetAccountId: string, purpose: string) {
  await page.getByLabel("Target canonical account ID").fill(targetAccountId);
  await page.getByLabel("Plain-language purpose").fill(purpose);
  const authEvents = page.getByLabel("Authentication events", { exact: true });
  if (!(await authEvents.isChecked())) await authEvents.check();
  await page.getByRole("button", { name: "Create scoped request", exact: true }).click();
  await expect(
    page.getByText("The scoped request is ready for the account owner to review.", { exact: true }),
  ).toBeVisible();
}

async function getOverview(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!response.ok) throw new Error(`overview failed: ${response.status}`);
    return response.json();
  });
}

async function adminPost(page: Page, csrfToken: string, url: string, body: Record<string, unknown>) {
  return page.evaluate(
    async ({ csrfToken: token, url: target, body: payload }) => {
      const response = await fetch(target, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json() };
    },
    { csrfToken, url, body },
  );
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
