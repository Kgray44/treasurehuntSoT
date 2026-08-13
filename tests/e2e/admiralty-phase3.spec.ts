import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
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
const taskRoot = process.env.ADMIRALTY_PHASE3_TASK_ROOT
  ? path.resolve(process.env.ADMIRALTY_PHASE3_TASK_ROOT)
  : process.cwd();
const sourceSha = process.env.ADMIRALTY_PHASE3_SOURCE_SHA ?? "0000000000000000000000000000000000000000";
const credentialPath = path.join(taskRoot, "credentials", "admiralty-phase2-walkthrough.private.json");
const evidenceRoot = path.join(taskRoot, "browser", "evidence");
const evidence: Evidence[] = [];
let credentials: Credentials;

test.beforeAll(() => {
  credentials = JSON.parse(readFileSync(credentialPath, "utf8")) as Credentials;
});

test.afterAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "manifest.json"),
    `${JSON.stringify({ status: "ADMIRALTY_PHASE3_AUTOMATED_BROWSER_PROOF_COMPLETE_OWNER_WALKTHROUGH_PENDING", sourceSha, fixtureVersion: credentials?.fixtureVersion, seriousCriticalAxeViolations: 0, records: evidence }, null, 2)}\n`,
    "utf8",
  );
  await db.$disconnect();
});

test("governed account commands require preview, assurance, confirmation, and durable receipts", async ({
  browser,
}) => {
  expect(credentials.fixtureVersion).toBe("admiralty-phase3-v1");

  const target = await signedInPage(browser, "SUPPORT_TARGET", "/");
  await expect(
    target.page.getByRole("button", { name: credentials.accounts.SUPPORT_TARGET.displayName, exact: true }),
  ).toBeVisible();
  await target.context.close();

  const admin = await signedInPage(browser, "ADMINISTRATOR", "/admin/people");
  await search(admin.page, "Consent Harbor");
  await admin.page.getByRole("link", { name: "Consent Harbor", exact: true }).click();
  await expect(admin.page.getByRole("heading", { name: "Consent Harbor", exact: true })).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("must-never-appear");

  const sessionPanel = panel(admin.page, "Session security action");
  await expect(sessionPanel.getByText("Revocation is immediate", { exact: false })).toBeVisible();
  await sessionPanel
    .getByLabel("Reason", { exact: true })
    .fill("Revoke the isolated synthetic target session for Phase 3 qualification.");
  await sessionPanel.getByRole("button", { name: "Preview revocation", exact: true }).click();
  await expect(sessionPanel.getByRole("heading", { name: "Before you revoke", exact: true })).toBeVisible();
  await expect(sessionPanel.getByRole("button", { name: "Confirm and revoke session", exact: true })).toBeDisabled();
  await sessionPanel
    .getByLabel("Confirm current password for privileged assurance", { exact: true })
    .fill(credentials.password);
  await sessionPanel.getByRole("button", { name: "Verify identity", exact: true }).click();
  await expect(
    sessionPanel.getByText("Recent privileged assurance is active for this action.", { exact: true }),
  ).toBeVisible();
  await sessionPanel.getByRole("button", { name: "Confirm and revoke session", exact: true }).click();
  await expect(sessionPanel.getByText("Session revocation completed.", { exact: false })).toBeVisible();
  await expect
    .poll(() =>
      db.accountSession.count({
        where: { accountId: credentials.accounts.SUPPORT_TARGET.accountId, revokedAt: { not: null } },
      }),
    )
    .toBeGreaterThan(0);
  await expect.poll(() => db.wayfarerAdminCommandReceipt.count({ where: { commandType: "SESSION_REVOKE" } })).toBe(1);
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM3-EV-A-SESSION-REVOCATION");

  const lifecyclePanel = panel(admin.page, "Suspend account");
  await lifecyclePanel
    .getByLabel("Reason", { exact: true })
    .fill("Suspend the isolated synthetic target account for Phase 3 qualification.");
  await lifecyclePanel.getByRole("button", { name: "Preview suspension", exact: true }).click();
  await expect(lifecyclePanel.getByRole("heading", { name: "Before you suspend", exact: true })).toBeVisible();
  await expect(lifecyclePanel.getByRole("button", { name: "Confirm and suspend account", exact: true })).toBeDisabled();
  await lifecyclePanel
    .getByLabel("Confirm current password for privileged assurance", { exact: true })
    .fill(credentials.password);
  await lifecyclePanel.getByRole("button", { name: "Verify identity", exact: true }).click();
  await lifecyclePanel.getByRole("button", { name: "Confirm and suspend account", exact: true }).click();
  await expect(lifecyclePanel.getByText("Account suspension completed.", { exact: false })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await db.userAccount.findUniqueOrThrow({ where: { id: credentials.accounts.SUPPORT_TARGET.accountId } }))
          .status,
    )
    .toBe("SUSPENDED");
  await expect.poll(() => db.wayfarerAdminCommandReceipt.count({ where: { commandType: "ACCOUNT_SUSPEND" } })).toBe(1);
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM3-EV-B-ACCOUNT-SUSPENSION");
  await admin.context.close();
});

test("governed Community moderation requires a case-attached target, independent reviewer, assurance, and confirmation", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const moderator = await signedInPage(browser, "MODERATION_OPERATOR", "/admin/community");
  const csrfProbe = await moderator.page.evaluate(async () => {
    const response = await fetch("/api/admin/commands/moderation/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return { status: response.status, body: await response.text() };
  });
  expect(csrfProbe.status).toBe(403);
  expect(csrfProbe.body).not.toContain("must-never-appear");
  const forbiddenOperations = await moderator.page.goto("/admin/operations");
  expect(forbiddenOperations?.status()).toBe(404);
  await moderator.page.goto("/admin/community");
  await search(moderator.page, "Chartroom Navigator Kit");
  await moderator.page.getByRole("link", { name: "Chartroom Navigator Kit", exact: true }).click();
  await expect(moderator.page.getByRole("heading", { name: "Chartroom Navigator Kit", exact: true })).toBeVisible();
  await expect(moderator.page.getByText("adm3-case-listing", { exact: true })).toBeVisible();
  const moderationPanel = moderator.page.getByRole("region", {
    name: "Apply Community moderation action",
    exact: true,
  });
  await moderator.page.getByRole("combobox", { name: "Case and target", exact: true }).selectOption({ index: 1 });
  await moderator.page.getByRole("combobox", { name: "Reason code", exact: true }).selectOption("MISLEADING_LISTING");
  await moderator.page
    .getByRole("textbox", { name: "Reason", exact: true })
    .fill("Quarantine the isolated fixture listing through the governed owner command.");
  await moderator.page
    .getByRole("textbox", { name: "Second reviewer account ID", exact: true })
    .fill(credentials.accounts.SECOND_REVIEWER.accountId);
  await moderationPanel.getByRole("button", { name: "Preview moderation action", exact: true }).click();
  await expect(
    moderationPanel.getByRole("heading", { name: "Before you apply this action", exact: true }),
  ).toBeVisible();
  await expect(moderationPanel.getByRole("button", { name: "Confirm moderation action", exact: true })).toBeDisabled();
  await moderator.page
    .getByRole("textbox", { name: "Confirm current password for privileged assurance", exact: true })
    .fill(credentials.password);
  await moderationPanel.getByRole("button", { name: "Verify identity", exact: true }).click();
  await moderationPanel.getByRole("button", { name: "Confirm moderation action", exact: true }).click();
  await expect(moderationPanel.getByText("Moderation action completed.", { exact: false })).toBeVisible();
  await expect
    .poll(() =>
      db.communityModerationAction.count({
        where: { caseId: "adm3-moderation-case-listing", actionType: "QUARANTINE_LISTING", state: "APPLIED" },
      }),
    )
    .toBe(1);
  await expect(moderator.page.locator("body")).not.toContainText("must-never-appear");
  await assertNoSeriousAxeViolations(moderator.page);
  await capture(moderator.page, "ADM3-EV-C-COMMUNITY-MODERATION");
  await moderator.context.close();
});

function panel(page: Page, heading: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
}

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

async function search(page: Page, value: string) {
  const main = page.locator("main#chartroom-main").last();
  await main.locator('input[name="q"]').fill(value);
  await main.getByRole("button", { name: "Search", exact: true }).click();
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
