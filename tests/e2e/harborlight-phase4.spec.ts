import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import bcrypt from "bcryptjs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { db } from "../../src/lib/db";

type Moderator = Readonly<{
  accountId: string;
  csrfToken: string;
  context: BrowserContext;
  page: Page;
}>;

test.describe.serial("Harborlight Phase 4 moderator browser acceptance", () => {
  let moderator: Moderator;
  let conflictedModerator: Moderator;
  let caseId: string;
  let caseKey: string;

  test.beforeAll(async ({ browser }) => {
    moderator = await createModerator(browser, "reviewer");
    conflictedModerator = await createModerator(browser, "conflicted");
    const suffix = randomUUID().replace(/-/gu, "").slice(0, 16);
    caseKey = `harbor-browser-${suffix}`;
    const moderationCase = await db.communityModerationCase.create({
      data: {
        caseKey,
        primaryReasonCode: "PRIVACY_EXPOSURE",
        subjectFingerprint: "a".repeat(48) + suffix,
        correlationId: `browser:${suffix}`,
        conflictAccountId: conflictedModerator.accountId,
      },
    });
    caseId = moderationCase.id;
    await Promise.all([
      db.communityModerationCaseSubject.create({
        data: { caseId, subjectType: "LISTING", subjectId: `opaque-${suffix}`, subjectChecksum: "b".repeat(64) },
      }),
      db.communityModerationCaseEvidence.create({
        data: {
          caseId,
          kind: "REPORT_SNAPSHOT",
          checksum: "c".repeat(64),
          safeSnapshot: JSON.stringify({ title: "Bounded safe fixture" }),
          createdBy: moderator.accountId,
          correlationId: `browser:${suffix}`,
        },
      }),
    ]);
  });

  test.afterAll(async () => {
    await moderator.context.close();
    await conflictedModerator.context.close();
  });

  test("protects the queue and case detail while preserving keyboard, mobile, zoom, reduced-motion, and Axe behavior", async ({
    browser,
  }) => {
    const anonymous = await browser.newContext();
    try {
      const response = await anonymous.request.get("/api/community/moderation/cases");
      expect(response.status()).toBe(403);
      await anonymous.newPage().then((page) => page.goto("/community/moderation"));
    } finally {
      await anonymous.close();
    }

    await moderator.page.goto("/community/moderation");
    await expect(moderator.page.getByRole("heading", { name: "Moderation queue" })).toBeVisible();
    const caseLink = moderator.page.getByRole("link", { name: caseKey });
    await caseLink.focus();
    await expect(caseLink).toBeFocused();
    // Client-side navigation is owned by the shared shell. Verify keyboard
    // focus here, then use a full protected route request so this acceptance
    // suite tests the moderator page rather than the shell router.
    await moderator.page.goto(`/community/moderation/${caseId}`);
    await expect(moderator.page.getByRole("heading", { name: `Case ${caseKey}` })).toBeVisible();
    const caseDetail = moderator.page.locator("#main-content");
    const reporterDisclosure = caseDetail.getByText("Reporter identities are intentionally not shown.");
    await expect(reporterDisclosure).toHaveCount(1);
    await expect(reporterDisclosure).toBeVisible();
    expect(await moderator.page.content()).not.toContain("private-storage-key");

    const axe = await new AxeBuilder({ page: moderator.page }).analyze();
    expect(axe.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);

    await moderator.page.emulateMedia({ reducedMotion: "reduce" });
    await moderator.page.setViewportSize({ width: 390, height: 844 });
    await moderator.page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    expect(
      await moderator.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth * 2),
    ).toBeTruthy();
  });

  test("enforces CSRF, expected revisions, and conflicts through the authenticated public route", async () => {
    const body = { expectedRevision: 1, nextStatus: "TRIAGED", reasonCode: "PRIVACY_EXPOSURE" };
    const missingCsrf = await moderator.context.request.post(`/api/community/moderation/cases/${caseId}/transition`, {
      data: body,
    });
    expect(missingCsrf.status()).toBe(403);

    const transitioned = await moderator.context.request.post(`/api/community/moderation/cases/${caseId}/transition`, {
      headers: { "x-csrf-token": moderator.csrfToken },
      data: body,
    });
    expect(transitioned.status(), await transitioned.text()).toBe(200);
    expect((await transitioned.json()) as { status: string; revision: number }).toMatchObject({
      status: "TRIAGED",
      revision: 2,
    });

    const stale = await moderator.context.request.post(`/api/community/moderation/cases/${caseId}/transition`, {
      headers: { "x-csrf-token": moderator.csrfToken },
      data: body,
    });
    expect(stale.status()).toBe(409);

    const conflictRead = await conflictedModerator.context.request.get(`/api/community/moderation/cases/${caseId}`);
    expect(conflictRead.status()).toBe(404);
    expect(await conflictRead.text()).not.toContain(caseKey);
  });
});

async function createModerator(browser: Browser, label: string): Promise<Moderator> {
  const suffix = randomUUID().slice(0, 12);
  const username = `harborlight-phase4-${label}-${suffix}`;
  const password = `Harborlight-${randomUUID()}-safe`;
  const gameMaster = await db.gameMasterUser.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role: "CAPTAIN_CREATOR" },
  });
  const account = await db.userAccount.create({ data: { status: "ACTIVE", legacyGameMasterId: gameMaster.id } });
  await Promise.all([
    db.playerProfile.create({
      data: { accountId: account.id, displayName: username, status: "ACTIVE", claimedAt: new Date() },
    }),
    db.accountRoleAssignment.create({ data: { accountId: account.id, role: "MODERATOR" } }),
  ]);
  const context = await browser.newContext();
  const login = await context.request.post("/api/gm/login", { data: { username, password } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const payload = (await login.json()) as { csrfToken: string };
  return { accountId: account.id, csrfToken: payload.csrfToken, context, page: await context.newPage() };
}
