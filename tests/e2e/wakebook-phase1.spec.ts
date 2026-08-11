import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";

type Account = { context: import("@playwright/test").BrowserContext; profileId: string };
type VisualEvidenceRecord = {
  evidenceId: string;
  state: string;
  viewportFamily: "STANDARD_DESKTOP" | "MODERN_MOBILE";
  viewport: string;
  sourceSha: string;
  capturePath: string;
  sha256: string;
  semanticResult: string;
  overflowResult: string;
  visualReviewClassification: "PENDING_CODEX_VISUAL_REVIEW";
  limitation: string;
};

const unique = `wakebook-p1-${randomUUID().slice(0, 12)}`;
const privateMemory = "TOP-SECRET-WAKEBOOK-MEMORY";
const syntheticPassword = "T!de-9Rope-4Quartz-7Beacon";
const captureEvidence = process.env.WAKEBOOK_PHASE1_CAPTURE_EVIDENCE === "1";
const evidenceRoot = path.resolve(
  process.env.WAKEBOOK_PHASE1_EVIDENCE_ROOT ?? path.join("Development_Docs", "Project Wakebook", "evidence", "phase1"),
);
const expectedEvidenceSource = process.env.WAKEBOOK_PHASE1_EXPECTED_SOURCE_SHA;
const sourceSha = expectedEvidenceSource ?? "UNBOUND";
const visualEvidence: VisualEvidenceRecord[] = [];

async function captureEvidenceState(
  page: Page,
  input: Omit<
    VisualEvidenceRecord,
    "sourceSha" | "capturePath" | "sha256" | "visualReviewClassification" | "limitation"
  >,
) {
  if (!captureEvidence) return;
  await mkdir(evidenceRoot, { recursive: true });
  const capturePath = path.join(evidenceRoot, `${input.evidenceId}.png`);
  await page.screenshot({ path: capturePath, fullPage: true });
  const bytes = await readFile(capturePath);
  visualEvidence.push({
    ...input,
    sourceSha,
    capturePath: path.relative(process.cwd(), capturePath).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    visualReviewClassification: "PENDING_CODEX_VISUAL_REVIEW",
    limitation:
      "Synthetic task-owned browser evidence only; not owner acceptance, production, deployment, or protected-main evidence.",
  });
}

async function register(browser: import("@playwright/test").Browser, label: string): Promise<Account> {
  const context = await browser.newContext();
  const emailLabel = label.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
  const response = await context.request.post("/api/auth/register", {
    data: {
      displayName: `Synthetic ${label}`,
      email: `${unique}-${emailLabel}@example.test`,
      password: syntheticPassword,
      confirmPassword: syntheticPassword,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { player: { id: string } };
  const profile = await db.playerProfile.findUniqueOrThrow({
    where: { id: body.player.id },
    select: { accountId: true },
  });
  if (!profile.accountId) throw new Error(`Synthetic ${label} account was not linked.`);
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
    db.accountSession.updateMany({
      where: { accountId: profile.accountId, revokedAt: null },
      data: { sessionType: "ORDINARY" },
    }),
  ]);
  return { context, profileId: body.player.id };
}

async function seedArchive(ownerId: string, crewId: string, additionalRecords = 1_004) {
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: `${unique}-tale`,
      slug: unique,
      title: "The Lantern Below",
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
        id: `${unique}-chapter`,
        title: "The Safe Descent",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: `${unique}-block`,
        completionBlockId: `${unique}-block`,
        blocks: [
          {
            id: `${unique}-block`,
            chapterId: `${unique}-chapter`,
            blockType: "NARRATIVE",
            title: "Safe marker",
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
    publishedAt: "2024-01-01T00:00:00.000Z",
  };
  const chronicle = await db.chronicle.create({
    data: { slug: unique, title: "The Lantern Below", creatorId: ownerId },
  });
  const checksum = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: chronicle.id,
      versionNumber: 1,
      versionLabel: "First Tide",
      publishedBy: ownerId,
      checksum,
      contentSnapshot: JSON.stringify(snapshot),
    },
  });
  const detailRecordId = `${unique}-record-detail`;
  const chapterSummary = JSON.stringify([
    {
      schemaVersion: 1,
      blockId: `${unique}-block`,
      chapterId: `${unique}-chapter`,
      title: "The Safe Descent",
      completedAt: "2026-12-31T11:00:00.000Z",
      sourceSequence: 1,
      accuracy: "EXACT",
    },
  ]);
  const artifactSummary = JSON.stringify([
    {
      schemaVersion: 1,
      artifactId: `${unique}-artifact`,
      name: "Shared Lantern",
      sourceBlockId: `${unique}-block`,
      eventType: "artifactGranted",
      revealedAt: "2026-12-31T10:30:00.000Z",
      sourceSequence: 2,
      classification: "SHARED_VOYAGE_ARTIFACT",
    },
  ]);
  await db.playerChronicleRecord.create({
    data: {
      id: detailRecordId,
      playerProfileId: ownerId,
      sourcePlaythroughId: `${unique}-playthrough-detail`,
      sourceMembershipId: `${unique}-membership-owner`,
      publishedVersionId: version.id,
      publishedVersionChecksum: checksum,
      chronicleTitleSnapshot: "The Lantern Below",
      playerNameSnapshot: "Synthetic Owner",
      participationRole: "CAPTAIN",
      crewRoleSnapshot: "Navigator",
      lifecycleStatus: "COMPLETED",
      outcome: "COMPLETED:internal-ending-id",
      startedAt: new Date("2026-12-31T10:00:00.000Z"),
      joinedAt: new Date("2026-12-31T10:00:00.000Z"),
      completedAt: new Date("2026-12-31T11:02:00.000Z"),
      wallClockSeconds: 3720,
      wallClockAccuracy: "EXACT",
      completedChapters: chapterSummary,
      optionalObjectives: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: not preserved." }]),
      choiceSummary: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: not preserved." }]),
      artifactSummary,
      sourceFingerprint: `${unique}-fingerprint-detail`,
    },
  });
  await db.playerChronicleParticipantSnapshot.createMany({
    data: [
      {
        historyRecordId: detailRecordId,
        sourceMembershipId: `${unique}-membership-owner`,
        participantProfileId: ownerId,
        displayNameSnapshot: "Synthetic Owner",
        participationRole: "CAPTAIN",
        crewRoleSnapshot: "Navigator",
        joinedAt: new Date("2026-12-31T10:00:00.000Z"),
        completedAt: new Date("2026-12-31T11:02:00.000Z"),
      },
      {
        historyRecordId: detailRecordId,
        sourceMembershipId: `${unique}-membership-crew`,
        participantProfileId: crewId,
        displayNameSnapshot: "Synthetic Crew",
        participationRole: "PLAYER",
        crewRoleSnapshot: "Lookout",
        joinedAt: new Date("2026-12-31T10:02:00.000Z"),
        completedAt: new Date("2026-12-31T11:02:00.000Z"),
      },
    ],
  });
  await db.chronicleReflection.create({
    data: { playerChronicleRecordId: detailRecordId, privateNote: "Private reflection" },
  });
  await db.chronicleMemory.create({
    data: {
      playerChronicleRecordId: detailRecordId,
      playerProfileId: ownerId,
      title: "A private memory",
      body: privateMemory,
    },
  });
  await db.playerArtifactRecord.create({
    data: {
      playerProfileId: ownerId,
      sourcePlaythroughId: `${unique}-playthrough-detail`,
      sourceGrantEventId: `${unique}-grant`,
      sourceGrantSequence: 2,
      sourceBlockId: `${unique}-block`,
      publishedVersionId: version.id,
      publishedVersionChecksum: checksum,
      chronicleTitleSnapshot: "The Lantern Below",
      artifactDefinitionId: `${unique}-artifact`,
      artifactNameSnapshot: "Personal Lantern",
      recipientPolicy: "DIRECT_RECIPIENT",
      ownershipState: "OWNED",
      grantedAt: new Date("2026-12-31T10:30:00.000Z"),
      sourceFingerprint: `${unique}-artifact-fingerprint`,
    },
  });

  const bulk = Array.from({ length: additionalRecords }, (_, index) => {
    const year = index < 501 ? 2026 : 2025;
    const day = (index % 27) + 1;
    return {
      id: `${unique}-record-${String(index).padStart(4, "0")}`,
      playerProfileId: ownerId,
      sourcePlaythroughId: `${unique}-playthrough-${index}`,
      publishedVersionId: version.id,
      publishedVersionChecksum: checksum,
      chronicleTitleSnapshot: `Wakebook Voyage ${String(index).padStart(4, "0")}`,
      playerNameSnapshot: "Synthetic Owner",
      lifecycleStatus: index % 7 === 0 ? "PAUSED" : "COMPLETED",
      outcome: index % 7 === 0 ? "UNAVAILABLE" : "COMPLETED",
      startedAt: new Date(`${year}-06-${String(day).padStart(2, "0")}T10:00:00.000Z`),
      joinedAt: new Date(`${year}-06-${String(day).padStart(2, "0")}T10:00:00.000Z`),
      completedAt: new Date(`${year}-06-${String(day).padStart(2, "0")}T11:00:00.000Z`),
      wallClockSeconds: 3600,
      wallClockAccuracy: "EXACT",
      sourceFingerprint: `${unique}-fingerprint-${index}`,
    };
  });
  for (let offset = 0; offset < bulk.length; offset += 100)
    await db.playerChronicleRecord.createMany({ data: bulk.slice(offset, offset + 100) });

  const invitationSession = await db.taleSession.create({
    data: {
      taleId: chronicle.id,
      publishedVersionId: version.id,
      accessTokenHash: createHash("sha256").update(`${unique}-invite`).digest("hex"),
    },
  });
  await db.invitation.create({
    data: {
      playthroughId: invitationSession.id,
      intendedPlayerId: ownerId,
      tokenHash: createHash("sha256").update(`${unique}-token`).digest("hex"),
      tokenPrefix: "synthetic",
      shortCodeHash: createHash("sha256").update(`${unique}-code`).digest("hex"),
      shortCodePrefix: "synthetic",
      recipientName: "Synthetic owner",
      createdBy: ownerId,
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      status: "DECLINED",
      declinedAt: new Date("2026-11-01T00:00:00.000Z"),
    },
  });
  return { chronicle, version, checksum, detailRecordId };
}

test("Wakebook Phase 1 is private, bounded, historically stable, and normally reachable", async ({ browser }) => {
  if (captureEvidence) expect(expectedEvidenceSource).toMatch(/^[0-9a-f]{40}$/u);
  const owner = await register(browser, "Owner");
  const crew = await register(browser, "Crew");
  const foreign = await register(browser, "Foreign");
  const firstUse = await register(browser, "First use");
  const oneVoyage = await register(browser, "One Voyage");
  const fixture = await seedArchive(owner.profileId, crew.profileId);
  await db.playerChronicleRecord.create({
    data: {
      id: `${unique}-one-voyage-record`,
      playerProfileId: oneVoyage.profileId,
      sourcePlaythroughId: `${unique}-one-voyage-playthrough`,
      publishedVersionId: fixture.version.id,
      publishedVersionChecksum: fixture.checksum,
      chronicleTitleSnapshot: "The Lantern Below",
      playerNameSnapshot: "Synthetic One Voyage",
      lifecycleStatus: "COMPLETED",
      outcome: "COMPLETED",
      startedAt: new Date("2026-12-31T10:00:00.000Z"),
      joinedAt: new Date("2026-12-31T10:00:00.000Z"),
      completedAt: new Date("2026-12-31T11:00:00.000Z"),
      wallClockSeconds: 3600,
      wallClockAccuracy: "EXACT",
      sourceFingerprint: `${unique}-one-voyage-fingerprint`,
    },
  });

  const first = await owner.context.request.get("/api/passport/voyages?limit=24");
  expect(first.ok(), await first.text()).toBeTruthy();
  const firstText = await first.text();
  expect(firstText).not.toContain(privateMemory);
  expect(firstText).not.toContain("contentSnapshot");
  expect(firstText).not.toContain("storageKey");
  const firstBody = JSON.parse(firstText) as {
    resultCount: number;
    pageCount: number;
    nextCursor: string | null;
    groups: Array<{ year: number | null; totalCount: number; items: Array<{ id: string }> }>;
    invitations: Array<{ lifecycle: { humanLabel: string } }>;
  };
  expect(firstBody.resultCount).toBe(1_005);
  expect(firstBody.pageCount).toBe(24);
  expect(firstBody.groups[0]).toMatchObject({ year: 2026, totalCount: 502 });
  expect(firstBody.invitations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ lifecycle: expect.objectContaining({ humanLabel: "Invitation declined" }) }),
    ]),
  );

  const allIds = new Set(firstBody.groups.flatMap((group) => group.items.map((item) => item.id)));
  let cursor = firstBody.nextCursor;
  while (cursor) {
    const page = await owner.context.request.get(`/api/passport/voyages?limit=24&cursor=${encodeURIComponent(cursor)}`);
    expect(page.ok(), await page.text()).toBeTruthy();
    const body = (await page.json()) as typeof firstBody;
    for (const id of body.groups.flatMap((group) => group.items.map((item) => item.id))) {
      expect(allIds.has(id), `duplicate archive record ${id}`).toBeFalsy();
      allIds.add(id);
    }
    cursor = body.nextCursor;
  }
  expect(allIds.size).toBe(1_005);

  const filtered = await owner.context.request.get("/api/passport/voyages?search=Wakebook%20Voyage%200777");
  expect(filtered.ok(), await filtered.text()).toBeTruthy();
  expect((await filtered.json()).resultCount).toBe(1);
  const malformed = await owner.context.request.get("/api/passport/voyages?limit=1000");
  expect(malformed.status()).toBe(400);

  const foreignList = await foreign.context.request.get("/api/passport/voyages");
  expect((await foreignList.json()).resultCount).toBe(0);
  const foreignDetail = await foreign.context.request.get(`/api/passport/voyages/${fixture.detailRecordId}`);
  expect(foreignDetail.status()).toBe(404);
  expect(await foreignDetail.text()).not.toContain("The Lantern Below");
  const foreignCover = await foreign.context.request.get(`/api/passport/voyages/${fixture.detailRecordId}/cover`);
  expect(foreignCover.status()).toBe(404);

  const detail = await owner.context.request.get(`/api/passport/voyages/${fixture.detailRecordId}`);
  expect(detail.ok(), await detail.text()).toBeTruthy();
  const detailText = await detail.text();
  expect(detailText).toContain(privateMemory);
  expect(detailText).toContain("Shared Lantern");
  expect(detailText).toContain("Personal Lantern");
  expect(detailText).not.toContain("internal-ending-id");
  await db.chronicle.update({ where: { id: fixture.chronicle.id }, data: { title: "Mutable title" } });
  await db.playerProfile.update({ where: { id: crew.profileId }, data: { displayName: "Mutable crew name" } });
  const stableText = await (await owner.context.request.get(`/api/passport/voyages/${fixture.detailRecordId}`)).text();
  expect(stableText).toContain("The Lantern Below");
  expect(stableText).toContain("Synthetic Crew");
  expect(stableText).not.toContain("Mutable crew name");

  const emptyPage = await firstUse.context.newPage();
  await emptyPage.setViewportSize({ width: 1440, height: 1000 });
  await emptyPage.goto("/passport");
  await emptyPage.getByRole("link", { name: "History" }).click();
  await expect(emptyPage.getByRole("heading", { name: "Every Voyage leaves a wake" })).toBeVisible();
  await captureEvidenceState(emptyPage, {
    evidenceId: "WB-P1-EV-001-archive-empty",
    state: "READY_EMPTY",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "VISIBLE_PASSPORT_TO_HISTORY_NAVIGATION_AND_EMPTY_ACTIONS_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });

  const oneVoyagePage = await oneVoyage.context.newPage();
  await oneVoyagePage.setViewportSize({ width: 1440, height: 1000 });
  await oneVoyagePage.goto("/passport");
  await oneVoyagePage.getByRole("link", { name: "History" }).click();
  await expect(oneVoyagePage.getByRole("heading", { name: "The Lantern Below" })).toBeVisible();
  await captureEvidenceState(oneVoyagePage, {
    evidenceId: "WB-P1-EV-002-archive-one-voyage",
    state: "READY_ONE_VOYAGE",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "ONE_VOYAGE_COMPOSITION_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });

  const page = await owner.context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/passport");
  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/passport\/history$/u);
  await expect(page.getByRole("heading", { name: "Your Voyages", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "The Lantern Below" })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(privateMemory);
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-003-archive-many-voyages",
    state: "READY_MANY_VOYAGES",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "MANY_VOYAGE_SHELF_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await expect(page.getByRole("heading", { name: "2026", exact: true })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-004-archive-year-grouping",
    state: "READY_YEAR_GROUPING",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "YEAR_GROUPING_TOTALS_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.getByText("More filters", { exact: true }).click();
  await expect(page.getByRole("group", { name: "Remembrance and context" })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-005-archive-filter-controls",
    state: "FILTER_CONTROLS_OPEN",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "EXPANDED_FILTER_CONTROLS_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.getByLabel("Search your archive").fill("No historical Voyage has this title");
  await page.getByRole("button", { name: "Read the wake" }).click();
  await expect(page.getByRole("heading", { name: "No Voyages match these archive filters" })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-006-archive-filtered-no-results",
    state: "FILTERED_NO_RESULTS",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "FILTERED_NO_RESULTS_AND_CLEAR_ACTION_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(page.getByRole("heading", { name: "The Lantern Below" })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-007-voyage-card-desktop",
    state: "READY_VOYAGE_CARD",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "VOYAGE_CARD_DESKTOP_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "The Lantern Below" })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-008-voyage-card-mobile",
    state: "READY_VOYAGE_CARD",
    viewportFamily: "MODERN_MOBILE",
    viewport: "390x844",
    semanticResult: "VOYAGE_CARD_MOBILE_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Open The Lantern Below Voyage" }).click();
  await expect(page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
  for (const heading of [
    "Journey Summary",
    "Path Through the Chronicle",
    "Crew",
    "Artifacts",
    "Exact Edition",
    "Remembrance",
  ])
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.getByText(/A shared Voyage artifact is never presented as personally owned/u)).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-009-voyage-detail-desktop",
    state: "READY_DETAIL",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "VOYAGE_DETAIL_DESKTOP_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-010-voyage-detail-mobile",
    state: "READY_DETAIL",
    viewportFamily: "MODERN_MOBILE",
    viewport: "390x844",
    semanticResult: "VOYAGE_DETAIL_MOBILE_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/passport\/history$/u);
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Your Voyages" }).click();
  await expect(page).toHaveURL(/\/passport\/history$/u);
  await expect(page.getByRole("heading", { name: "Invitations along the way" })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-011-invitation-history",
    state: "INVITATION_HISTORY_SEPARATE",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "INVITATION_HISTORY_SEPARATION_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });

  await db.playerChronicleRecord.update({
    where: { id: fixture.detailRecordId },
    data: {
      wallClockSeconds: null,
      wallClockAccuracy: "UNAVAILABLE",
      completedChapters: "not-json",
      projectionStatus: "STALE",
    },
  });
  await page.reload();
  await page.getByRole("link", { name: "Open The Lantern Below Voyage" }).click();
  await expect(page.getByText("Duration unavailable", { exact: true })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-012-unavailable-timing",
    state: "UNAVAILABLE_TIMING",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "UNAVAILABLE_TIMING_FALLBACK_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await expect(page.getByText(/needs history reconciliation/u).first()).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-013-partial-history",
    state: "PARTIAL_HISTORY",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "PARTIAL_HISTORY_SAFE_FALLBACK_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.getByRole("link", { name: "Back to Your Voyages" }).click();
  await page.context().route("**/api/passport/voyages", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic read failure" }),
    });
  });
  await page.reload();
  await expect(page.getByText("Synthetic read failure", { exact: true })).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-014-error-state",
    state: "READ_ERROR",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "ERROR_STATE_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });
  await page.context().unroute("**/api/passport/voyages");
  await page.getByRole("button", { name: /Try again|Retry/i }).click();
  await expect(page.getByRole("heading", { name: "Your Voyages", exact: true }).first()).toBeVisible();
  await captureEvidenceState(page, {
    evidenceId: "WB-P1-EV-015-error-recovery",
    state: "READ_RECOVERED",
    viewportFamily: "STANDARD_DESKTOP",
    viewport: "1440x1000",
    semanticResult: "ERROR_RETRY_RECOVERY_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
  });

  if (captureEvidence) {
    expect(visualEvidence).toHaveLength(15);
    await writeFile(
      path.join(evidenceRoot, "manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          phase: "PROJECT_WAKEBOOK_PHASE_1",
          sourceSha,
          branch: process.env.WAKEBOOK_PHASE1_EVIDENCE_BRANCH ?? "isolated-validation-runtime",
          fixtureVersion: "wakebook-phase1-browser-v1",
          fixtureChecksum: createHash("sha256").update(unique).digest("hex"),
          records: visualEvidence,
          limitation:
            "Synthetic task-owned browser evidence only; not owner acceptance, production, deployment, or protected-main evidence.",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  await Promise.all([
    owner.context.close(),
    crew.context.close(),
    foreign.context.close(),
    firstUse.context.close(),
    oneVoyage.context.close(),
  ]);
});
