import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { authenticateAccount, registerAccount } from "../../src/wayfarer/accounts";
import { WAYFARER_COOKIE } from "../../src/wayfarer/http";

type Actor = { context: BrowserContext; profileId: string };

const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
const password = "Compass-Quartz-Lantern-9";
const evidenceRoot = path.resolve(process.env.BRIGHTWORK_WAVE3_EVIDENCE_ROOT ?? "artifacts/brightwork-stage8-wave3");

async function register(browser: import("@playwright/test").Browser, label: string): Promise<Actor> {
  const context = await browser.newContext();
  const email = `brightwork-wave3-${label.toLowerCase()}-${suffix}@example.test`;
  const registration = await registerAccount({
    displayName: `Wave 3 ${label}`,
    email,
    password,
    confirmPassword: password,
  });
  const profile = await db.playerProfile.findUniqueOrThrow({
    where: { id: registration.account.profile.id },
    select: { accountId: true },
  });
  if (!profile.accountId) throw new Error("The synthetic Wave 3 account was not linked to an account.");
  const verifiedAt = new Date();
  await db.$transaction([
    db.userAccount.update({
      where: { id: profile.accountId },
      data: { status: "ACTIVE", claimedAt: verifiedAt, ordinaryWorkspaceEntryAt: verifiedAt },
    }),
    db.accountEmail.updateMany({
      where: { accountId: profile.accountId, isPrimary: true },
      data: { verificationState: "VERIFIED", verifiedAt },
    }),
  ]);
  const session = await authenticateAccount(email, password, `Brightwork Wave 3 ${label} browser`);
  if (!session) throw new Error("The synthetic Wave 3 account could not start an ordinary account session.");
  await context.addCookies([
    {
      name: WAYFARER_COOKIE,
      value: session.session.token,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return { context, profileId: registration.account.profile.id };
}

async function seedHistory(ownerId: string, crewId: string) {
  const seed = randomUUID().replaceAll("-", "");
  const taleId = `brightwork-wave3-tale-${seed}`;
  const chapterId = `brightwork-wave3-chapter-${seed}`;
  const blockId = `brightwork-wave3-block-${seed}`;
  const chronicle = await db.chronicle.create({
    data: { id: taleId, slug: `brightwork-wave3-${seed}`, title: "The Copper Lantern", creatorId: ownerId },
  });
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: taleId,
      slug: chronicle.slug,
      title: chronicle.title,
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: [
      {
        id: chapterId,
        title: "Beacon Hill",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: blockId,
        completionBlockId: blockId,
        blocks: [
          {
            id: blockId,
            chapterId,
            blockType: "NARRATIVE",
            title: "Arrival",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 0,
            nextBlockId: null,
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: "2026-08-13T00:00:00.000Z",
  };
  const checksum = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: chronicle.id,
      versionNumber: 1,
      versionLabel: "Lantern edition",
      publishedBy: ownerId,
      checksum,
      contentSnapshot: JSON.stringify(snapshot),
    },
  });
  const records = await Promise.all(
    [
      ["First Light", "2025-12-31T10:00:00.000Z"],
      ["The Copper Lantern", "2026-08-12T10:00:00.000Z"],
    ].map(async ([title, startedAt], index) => {
      const timestamp = new Date(startedAt);
      const record = await db.playerChronicleRecord.create({
        data: {
          id: `brightwork-wave3-record-${seed}-${index}`,
          playerProfileId: ownerId,
          sourcePlaythroughId: `brightwork-wave3-playthrough-${seed}-${index}`,
          sourceMembershipId: `brightwork-wave3-owner-${seed}-${index}`,
          publishedVersionId: version.id,
          publishedVersionChecksum: checksum,
          chronicleTitleSnapshot: title,
          creatorAttributionSnapshot: "Wave 3 Owner",
          playerNameSnapshot: "Wave 3 Owner",
          participationRole: "CAPTAIN",
          crewRoleSnapshot: "Navigator",
          lifecycleStatus: "COMPLETED",
          outcome: "COMPLETED",
          startedAt: timestamp,
          joinedAt: timestamp,
          completedAt: new Date(timestamp.valueOf() + 3_600_000),
          wallClockSeconds: 3600,
          wallClockAccuracy: "EXACT",
          activeSeconds: 3300,
          activeAccuracy: "EXACT",
          pausedSeconds: 300,
          pausedAccuracy: "EXACT",
          connectedSeconds: 3600,
          connectedAccuracy: "EXACT",
          interactiveSeconds: 3300,
          interactiveAccuracy: "EXACT",
          captainWaitSeconds: 0,
          captainWaitAccuracy: "EXACT",
          completedChapters: JSON.stringify([
            {
              schemaVersion: 1,
              blockId,
              chapterId,
              title: "Beacon Hill",
              completedAt: new Date(timestamp.valueOf() + 3_600_000).toISOString(),
              sourceSequence: 1,
              accuracy: "EXACT",
            },
          ]),
          optionalObjectives: "[]",
          choiceSummary: JSON.stringify([
            {
              schemaVersion: 1,
              state: "AVAILABLE",
              label: "Light the beacon",
              chapterTitle: "Beacon Hill",
              kind: "CHOICE",
            },
          ]),
          artifactSummary: "[]",
          sourceFingerprint: `brightwork-wave3-fingerprint-${seed}-${index}`,
        },
      });
      await db.playerChronicleParticipantSnapshot.createMany({
        data: [
          {
            historyRecordId: record.id,
            sourceMembershipId: `brightwork-wave3-owner-${seed}-${index}`,
            participantProfileId: ownerId,
            displayNameSnapshot: "Wave 3 Owner",
            participationRole: "CAPTAIN",
            crewRoleSnapshot: "Navigator",
            joinedAt: record.joinedAt,
            completedAt: record.completedAt,
          },
          {
            historyRecordId: record.id,
            sourceMembershipId: `brightwork-wave3-crew-${seed}-${index}`,
            participantProfileId: crewId,
            displayNameSnapshot: "Harbor Lookout",
            participationRole: "PLAYER",
            crewRoleSnapshot: "Lookout",
            joinedAt: record.joinedAt,
            completedAt: record.completedAt,
          },
        ],
      });
      return record;
    }),
  );
  return { detailRecordId: records[1]!.id };
}

async function assertAccessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(evidenceRoot, `${name}.png`), fullPage: true, caret: "hide" });
}

test("Brightwork Stage 8 Wave 3 renders Personal Harbor and Chronicle Passport as separate, truthful private surfaces", async ({
  browser,
}) => {
  await mkdir(evidenceRoot, { recursive: true });
  const owner = await register(browser, "Owner");
  const crew = await register(browser, "Crew");
  const { detailRecordId } = await seedHistory(owner.profileId, crew.profileId);
  const page = await owner.context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Return to what you experienced" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Chronicle Passport" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Chronicle Passport sections" })).toHaveCount(0);
    await expect(page.locator(".product-shell")).toHaveAttribute("data-theme-applicability", "LIGHT_AND_DARK");
    await assertAccessible(page);
    await capture(page, "01-harbor-desktop-dark");
    await page.locator("html").evaluate((element) => element.setAttribute("data-voyage-theme", "light"));
    await capture(page, "02-harbor-desktop-light");
    await page.locator("html").evaluate((element) => element.removeAttribute("data-voyage-theme"));

    await page.goto("/passport");
    await expect(page.getByRole("heading", { name: "Chronicle Passport", exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "A record you can return to" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Chronicle Passport sections" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Chronicle History/u })).toContainText("2");
    await assertAccessible(page);
    await capture(page, "03-passport-desktop-dark");
    await page.locator("html").evaluate((element) => element.setAttribute("data-voyage-theme", "light"));
    await capture(page, "04-passport-desktop-light");
    await page.locator("html").evaluate((element) => element.removeAttribute("data-voyage-theme"));

    await page.goto("/passport/history");
    await expect(page.getByRole("heading", { name: "Your Voyages", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Copper Lantern", exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "05-voyages-desktop");

    await page.goto(`/passport/history/${detailRecordId}`);
    await expect(page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Memory", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Artifact Cabinet", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Technical details", exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "06-voyage-detail-desktop");

    await page.goto("/passport/timeline");
    await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2026", exact: true })).toBeVisible();
    await expect(page.getByText("Archive year", { exact: true }).first()).toBeVisible();
    await assertAccessible(page);
    await capture(page, "07-timeline-desktop");

    await page.goto("/passport/people");
    await expect(page.getByRole("heading", { name: "People", exact: true })).toBeVisible();
    await expect(page.getByText("Harbor Lookout", { exact: true })).toBeVisible();
    await expect(page.getByText("First shared Voyage", { exact: true })).toBeVisible();
    await expect(page.getByText("Most recent shared Voyage", { exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "08-people-desktop");

    await page.goto("/passport/statistics");
    await expect(page.getByRole("heading", { name: "Statistics", exact: true })).toBeVisible();
    await expect(page.getByText("Recorded Voyages", { exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "09-statistics-desktop");

    await page.goto("/passport/atlas");
    await expect(page.getByRole("heading", { name: "Voyage Atlas", exact: true })).toBeVisible();
    await expect(page.getByText("Journey geography is not available yet", { exact: true })).toBeVisible();
    await expect(page.getByText("About geography availability", { exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "10-atlas-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Return to what you experienced" })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "11-harbor-mobile");

    await page.goto("/passport");
    await expect(page.getByRole("heading", { name: "A record you can return to" })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "12-passport-mobile");

    await page.goto(`/passport/history/${detailRecordId}`);
    await expect(page.getByLabel("Jump to a Voyage section")).toBeVisible();
    await page.getByLabel("Jump to a Voyage section").selectOption("wakebook-provenance");
    await expect(page).toHaveURL(/#wakebook-provenance$/u);
    await assertAccessible(page);
    await capture(page, "13-voyage-detail-mobile-navigation");

    await page.goto("/passport/timeline");
    await expect(page.getByRole("heading", { name: "2026", exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "14-timeline-mobile");

    await page.goto("/passport/people");
    await expect(page.getByText("Harbor Lookout", { exact: true })).toBeVisible();
    await expect(page.getByText("First shared Voyage", { exact: true })).toBeVisible();
    await assertAccessible(page);
    await capture(page, "15-people-mobile");
  } finally {
    await owner.context.close();
    await crew.context.close();
  }
});
