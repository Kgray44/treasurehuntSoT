import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { runCommunityWorkerOnce } from "@/community/worker";

const db = new PrismaClient();
const taskRoot = path.resolve(required("ADMIRALTY_PHASE3_TASK_ROOT"));
const evidenceRoot = path.join(taskRoot, "browser", "evidence");
const sourceSha = process.env.ADMIRALTY_PHASE3_SOURCE_SHA ?? "0000000000000000000000000000000000000000";
const password = process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ?? "Adm3-synthetic-fixture-password-20260825!";
const evidence: Array<{ id: string; capturePath: string; sha256: string; viewport: string }> = [];
const accounts = {
  admin: { email: "administrator@admiralty.example.test", displayName: "Admiral Northstar" },
  moderator: { email: "moderation_operator@admiralty.example.test", displayName: "MODERATION OPERATOR" },
  ordinary: { email: "ordinary@admiralty.example.test", displayName: "Ordinary Mariner" },
};

test.afterAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "brightwork-wave5-manifest.json"),
    `${JSON.stringify(
      {
        status: "BRIGHTWORK_WAVE5_SYNTHETIC_BROWSER_PROOF_COMPLETE",
        sourceSha,
        fixtureVersion: "admiralty-phase3-v1",
        environment: "TASK_OWNED_SYNTHETIC",
        records: evidence,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await db.$disconnect();
});

test("Configuration uses the Harborlight owner command for a real policy change and governed revert", async ({
  browser,
}) => {
  const admin = await signedInPage(browser, accounts.admin, "/admin/configuration");
  const stale = await signedInPage(browser, accounts.admin, "/admin/configuration");
  await expect(admin.page.getByRole("heading", { name: "Configuration", exact: true })).toBeVisible();
  await expect(admin.page.getByText("Community outbox runtime", { exact: true })).toBeVisible();
  await expect(admin.page.getByText("Private worker deployment state", { exact: true })).toBeVisible();
  await expect(admin.page.getByText("Google sign-in reference", { exact: true })).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText(password);

  const policyPanel = admin.page.getByRole("region", { name: "Community outbox runtime", exact: true });
  await policyPanel.getByLabel("Accept new Community outbox work").uncheck();
  await policyPanel.getByLabel("Jobs per worker batch").fill("7");
  await policyPanel.getByLabel("Idle worker poll interval (milliseconds)").fill("5000");
  await policyPanel
    .getByLabel("Reason")
    .fill("Pause synthetic Community dispatch for the Wave 5 policy qualification.");
  await policyPanel.getByRole("button", { name: "Preview policy change", exact: true }).click();
  await expect(policyPanel.getByRole("heading", { name: "Before you apply this policy", exact: true })).toBeVisible();
  await expect(policyPanel.getByRole("button", { name: "Confirm and apply policy", exact: true })).toBeDisabled();
  await policyPanel.getByLabel("Confirm current password for privileged assurance").fill(password);
  await policyPanel.getByRole("button", { name: "Verify identity", exact: true }).click();
  await policyPanel.getByRole("button", { name: "Confirm and apply policy", exact: true }).click();
  await expect(policyPanel.getByText(/Community outbox runtime policy changed/u)).toBeVisible();
  await expect
    .poll(() =>
      db.communityOperationalPolicy.findUnique({ where: { key: "COMMUNITY_OUTBOX_RUNTIME" } }).then((policy) => ({
        dispatchEnabled: policy?.dispatchEnabled,
        batchSize: policy?.batchSize,
        pollIntervalMs: policy?.pollIntervalMs,
      })),
    )
    .toEqual({ dispatchEnabled: false, batchSize: 7, pollIntervalMs: 5_000 });
  await expect
    .poll(() => db.platformAuditEvent.count({ where: { action: "ADMIRALTY_COMMUNITY_OUTBOX_RUNTIME_POLICY_CHANGED" } }))
    .toBe(1);
  const pausedEvent = await db.communityOutboxEvent.create({
    data: {
      eventType: "AGGREGATE_RECONCILIATION",
      aggregateType: "BRIGHTWORK_WAVE5",
      aggregateId: "synthetic-policy-paused-worker",
      payload: "{}",
      idempotencyKey: `brightwork-wave5-paused-${randomUUID()}`,
      availableAt: new Date(Date.now() - 60_000),
    },
  });
  await expect(runCommunityWorkerOnce("brightwork-wave5-paused-worker")).resolves.toMatchObject({
    claimed: 0,
    processed: 0,
    dispatchPaused: true,
  });
  await expect
    .poll(() => db.communityOutboxEvent.findUnique({ where: { id: pausedEvent.id } }))
    .toMatchObject({
      processedAt: null,
      claimOwner: null,
    });
  const stalePanel = stale.page.getByRole("region", { name: "Community outbox runtime", exact: true });
  await stalePanel.getByLabel("Reason").fill("Verify that a stale Wave 5 policy revision cannot partially apply.");
  await stalePanel.getByRole("button", { name: "Preview policy change", exact: true }).click();
  await expect(stalePanel.getByRole("status")).toContainText("changed. Refresh and review it again.");
  await expect
    .poll(() =>
      db.communityOperationalPolicy
        .findUnique({ where: { key: "COMMUNITY_OUTBOX_RUNTIME" } })
        .then((policy) => policy?.revision),
    )
    .toBe(1);
  await stale.context.close();
  await capture(admin.page, "BW5-CONFIG-CHANGED");

  await policyPanel.getByRole("button", { name: "Stage governed revert", exact: true }).click();
  await policyPanel.getByRole("button", { name: "Preview policy change", exact: true }).click();
  await policyPanel.getByLabel("Confirm current password for privileged assurance").fill(password);
  await policyPanel.getByRole("button", { name: "Verify identity", exact: true }).click();
  await policyPanel.getByRole("button", { name: "Confirm and apply policy", exact: true }).click();
  await expect
    .poll(() =>
      db.communityOperationalPolicy.findUnique({ where: { key: "COMMUNITY_OUTBOX_RUNTIME" } }).then((policy) => ({
        dispatchEnabled: policy?.dispatchEnabled,
        batchSize: policy?.batchSize,
        pollIntervalMs: policy?.pollIntervalMs,
      })),
    )
    .toEqual({ dispatchEnabled: true, batchSize: 25, pollIntervalMs: 1_000 });
  await expect
    .poll(() => db.platformAuditEvent.count({ where: { action: "ADMIRALTY_COMMUNITY_OUTBOX_RUNTIME_POLICY_CHANGED" } }))
    .toBe(2);
  await expectNoSeriousAxeViolations(admin.page);
  await admin.context.close();
});

test("Operations exposes only the safe Harborlight expired-lease recovery command", async ({ browser }) => {
  const event = await db.communityOutboxEvent.create({
    data: {
      eventType: "AGGREGATE_RECONCILIATION",
      aggregateType: "BRIGHTWORK_WAVE5",
      aggregateId: "synthetic-expired-lease",
      payload: "{}",
      idempotencyKey: `brightwork-wave5-${randomUUID()}`,
      availableAt: new Date(Date.now() - 60_000),
      claimedAt: new Date(Date.now() - 60_000),
      claimOwner: "synthetic-expired-worker",
      claimExpiresAt: new Date(Date.now() - 30_000),
    },
  });
  const admin = await signedInPage(browser, accounts.admin, "/admin/operations");
  const recoveryPanel = admin.page.getByRole("region", { name: "Release expired Community leases", exact: true });
  await expect(recoveryPanel.getByText(/expired lease/u)).toBeVisible();
  await recoveryPanel
    .getByLabel("Reason")
    .fill("Recover the synthetic expired lease through the Harborlight owner command.");
  await recoveryPanel.getByRole("button", { name: "Preview lease recovery", exact: true }).click();
  await expect(recoveryPanel.getByRole("heading", { name: "Before you release leases", exact: true })).toBeVisible();
  await recoveryPanel.getByLabel("Confirm current password for privileged assurance").fill(password);
  await recoveryPanel.getByRole("button", { name: "Verify identity", exact: true }).click();
  await recoveryPanel.getByRole("button", { name: "Confirm and release expired leases", exact: true }).click();
  await expect
    .poll(() =>
      db.communityOutboxEvent.findUnique({ where: { id: event.id } }).then((current) => current?.claimOwner ?? null),
    )
    .toBeNull();
  await expect
    .poll(() =>
      db.platformAuditEvent.count({ where: { action: "ADMIRALTY_COMMUNITY_EXPIRED_OUTBOX_CLAIMS_RELEASED" } }),
    )
    .toBe(1);
  await expectNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "BW5-OPERATIONS-LEASE-RECOVERY");
  await admin.context.close();
});

test("Overview, Providers, and grouped mobile navigation retain safe status and access boundaries", async ({
  browser,
}) => {
  const admin = await signedInPage(browser, accounts.admin, "/admin");
  await expect(admin.page.getByRole("heading", { name: "Platform Overview", exact: true })).toBeVisible();
  await capture(admin.page, "BW5-OVERVIEW-DESKTOP");
  await admin.page.goto("/admin/providers");
  await expect(admin.page.getByRole("heading", { name: "Providers", exact: true })).toBeVisible();
  await capture(admin.page, "BW5-PROVIDERS-DESKTOP");
  await admin.context.close();

  const mobile = await signedInPage(browser, accounts.admin, "/admin/configuration", { width: 390, height: 844 });
  await expect(mobile.page.getByText("Stations", { exact: true })).toBeVisible();
  const navigation = mobile.page.getByRole("navigation", { name: "Admiralty navigation" });
  await expect(navigation.getByRole("link", { name: "Operations", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Audit", exact: true })).toBeVisible();
  expect(await mobile.page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  await capture(mobile.page, "BW5-CONFIGURATION-MOBILE");
  await expectNoSeriousAxeViolations(mobile.page);
  await mobile.context.close();

  const ordinary = await signedInPage(browser, accounts.ordinary, "/");
  expect((await ordinary.page.goto("/admin/configuration"))?.status()).toBe(404);
  await ordinary.context.close();

  const moderator = await signedInPage(browser, accounts.moderator, "/admin/community");
  await moderator.page.goto("/admin/configuration");
  await expect(moderator.page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(moderator.page.getByRole("heading", { name: "Configuration", exact: true })).toHaveCount(0);
  await moderator.context.close();
});

async function signedInPage(
  browser: Browser,
  account: { email: string; displayName: string },
  returnTo: string,
  viewport = { width: 1440, height: 900 },
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo);
  return { context, page } satisfies { context: BrowserContext; page: Page };
}

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

async function capture(page: Page, id: string) {
  await mkdir(evidenceRoot, { recursive: true });
  const capturePath = path.join(evidenceRoot, `${id}.png`);
  await page.screenshot({ path: capturePath, fullPage: true });
  evidence.push({
    id,
    capturePath,
    sha256: createHash("sha256")
      .update(await readFile(capturePath))
      .digest("hex"),
    viewport: `${page.viewportSize()?.width ?? 0}x${page.viewportSize()?.height ?? 0}`,
  });
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
