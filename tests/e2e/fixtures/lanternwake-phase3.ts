import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  expect,
  request as playwrightRequest,
  test as baseTest,
  type APIRequestContext,
  type Page,
  type Request,
} from "@playwright/test";
import type { AdminCommand } from "../../../src/domain/admin";
import type {
  ProgressionReceiptEventDetail,
  ProgressionStateEventDetail,
} from "../../../src/components/player/PlayerExperience";
import { resolveLegacyCampaign } from "../../../src/compatibility/legacy-companion";
import { migrateLegacyCompanion } from "../../../src/chronicle/legacy-companion-migration";
import { db } from "../../../src/lib/db";

export { expect };

export const PHASE3_PLAYER_SECTIONS = ["journal", "chart", "treasures", "quests", "log", "finale"] as const;
export type Phase3PlayerSection = (typeof PHASE3_PLAYER_SECTIONS)[number];

export const PHASE3_EVENT_CASES = [
  { eventType: "CHAPTER_RELEASED", command: "RELEASE_CHAPTER", relevantSection: "journal" },
  { eventType: "CHAPTER_SOLVED", command: "MARK_SOLVED", relevantSection: "journal" },
  { eventType: "ARTIFACT_AWARDED", command: "AWARD_ARTIFACT", relevantSection: "treasures" },
  {
    eventType: "ARTIFACT_SILHOUETTE_REVEALED",
    command: "REVEAL_ARTIFACT_SILHOUETTE",
    relevantSection: "treasures",
  },
  { eventType: "ARTIFACT_CONNECTED", command: "CONNECT_ARTIFACTS", relevantSection: "treasures" },
  { eventType: "MAP_LOCATION_REVEALED", command: "REVEAL_MAP", relevantSection: "chart" },
  { eventType: "MAP_ROUTE_REVEALED", command: "REVEAL_ROUTE", relevantSection: "chart" },
  { eventType: "SIDE_QUEST_DISCOVERED", command: "DISCOVER_SIDE_QUEST", relevantSection: "quests" },
  { eventType: "SIDE_QUEST_UPDATED", command: "UPDATE_SIDE_QUEST", relevantSection: "quests" },
  { eventType: "SIDE_QUEST_COMPLETED", command: "COMPLETE_SIDE_QUEST", relevantSection: "quests" },
  { eventType: "JOURNAL_ANNOTATION_ADDED", command: "ADD_JOURNAL_ANNOTATION", relevantSection: "journal" },
  { eventType: "PLAYER_LOG_ENTRY_ADDED", command: "ADD_LOG_ENTRY", relevantSection: "log" },
  { eventType: "FINALE_TEASED", command: "TEASE_FINALE", relevantSection: "finale" },
  {
    eventType: "FINALE_REQUIREMENT_UPDATED",
    command: "UPDATE_FINALE_REQUIREMENT",
    relevantSection: "finale",
  },
  { eventType: "CAMPAIGN_PAUSED", command: "PAUSE", relevantSection: null },
  { eventType: "CAMPAIGN_RESUMED", command: "RESUME", relevantSection: null },
  { eventType: "STATE_REVERTED", command: "UNDO_LAST", relevantSection: null },
] as const satisfies readonly {
  eventType: string;
  command: AdminCommand;
  relevantSection: Phase3PlayerSection | null;
}[];

export type Phase3EventType = (typeof PHASE3_EVENT_CASES)[number]["eventType"];
if (PHASE3_EVENT_CASES.length !== 17 || new Set(PHASE3_EVENT_CASES.map((item) => item.eventType)).size !== 17) {
  throw new Error("The Lanternwake Phase 3 fixture requires exactly 17 unique Player event types.");
}

export const PHASE3_MATRIX_CASES = PHASE3_PLAYER_SECTIONS.flatMap((startingSection, sectionIndex) =>
  PHASE3_EVENT_CASES.map((eventCase, eventIndex) => ({
    caseId: `P3-CASE-${String(sectionIndex * PHASE3_EVENT_CASES.length + eventIndex + 1).padStart(3, "0")}`,
    startingSection,
    ...eventCase,
  })),
);
if (
  PHASE3_MATRIX_CASES.length !== 102 ||
  new Set(PHASE3_MATRIX_CASES.map((item) => item.caseId)).size !== 102 ||
  PHASE3_MATRIX_CASES[0]?.caseId !== "P3-CASE-001" ||
  PHASE3_MATRIX_CASES.at(-1)?.caseId !== "P3-CASE-102"
) {
  throw new Error("The Lanternwake Phase 3 matrix must contain exactly 102 unique P3-CASE identities.");
}

export const PHASE3_MOTION_MODES = [
  { id: "M1", productMode: "full", browserReduced: false, resolvedMode: "full" },
  { id: "M2", productMode: "gentle", browserReduced: false, resolvedMode: "gentle" },
  { id: "M3", productMode: "reduced", browserReduced: false, resolvedMode: "reduced" },
  { id: "M4", productMode: "full", browserReduced: true, resolvedMode: "reduced" },
  { id: "M5", productMode: "reduced", browserReduced: true, resolvedMode: "reduced" },
] as const;
export type Phase3MotionCase = (typeof PHASE3_MOTION_MODES)[number];

export type Phase3CaseFixture = Readonly<{
  caseId: string;
  eventType: Phase3EventType;
  campaignId: string;
  chapterContentId: string;
  playerAccessId: string;
  slug: string;
  path: string;
  accessCode: string;
  deviceId: string;
  artifactKey: string;
  connectedArtifactKey: string;
  mapLocationKey: string;
  mapRouteKey: string;
  sideQuestKey: string;
  finaleRequirementKey: string;
  prerequisiteEventId: string | null;
  preseeded: boolean;
}>;

export type Phase3ReceiptEvidence = Omit<ProgressionReceiptEventDetail, "eventType"> &
  Readonly<{ eventType: Phase3EventType }>;

export type Phase3StateEvidence = ProgressionStateEventDetail;

export type Phase3EvidenceSnapshot = Readonly<{
  receipts: readonly Phase3ReceiptEvidence[];
  states: readonly Phase3StateEvidence[];
}>;

export type Phase3DbTruth = Readonly<{
  campaign: { id: string; slug: string; status: string; currentSequence: number; finaleState: string };
  chapter: { state: string; revealedAt: Date | null; solvedAt: Date | null };
  storyMutation: Readonly<{
    artifacts: readonly { key: string; state: string; connectedArtifactKey: string | null }[];
    awards: readonly { artifactId: string; eventId: string | null }[];
    mapLocations: readonly { key: string; state: string; revealedAt: Date | null }[];
    mapRoutes: readonly { key: string; state: string; revealedAt: Date | null }[];
    sideQuests: readonly { key: string; state: string; completedAt: Date | null }[];
    journalEntries: readonly { id: string; kind: string; eventId: string | null }[];
  }>;
  events: readonly { id: string; type: string; sequence: number; reversesEventId: string | null }[];
  viewed: readonly { eventId: string; deviceId: string }[];
  commands: readonly { command: string; expectedSequence: number; status: string; correlationId: string }[];
  audits: readonly { action: string; outcome: string; correlationId: string | null }[];
}>;

export type Phase3CommandReceipt = Readonly<{
  correlationId: string;
  persistence: "COMMITTED";
  publication: "PROCESS_PUBLISHED";
  delivery: "PUBLISHED";
  playerDelivery: "UNCONFIRMED";
  playerPresentation: "UNCONFIRMED";
  playerAcknowledgment: "UNCONFIRMED";
  event: Readonly<{ id: string; type: Phase3EventType; sequence: number; payload: Record<string, unknown> }>;
}>;

type ProbeWindow = Window & {
  __lanternwakePhase3Evidence?: { receipts: Phase3ReceiptEvidence[]; states: Phase3StateEvidence[] };
};

type UnsafePhase3Request = Readonly<{ method: string; pathname: string }>;
export type UnsafePhase3RequestMonitor = Readonly<{
  begin(label: string): void;
  end(label: string): readonly UnsafePhase3Request[];
  dispose(): void;
}>;

function eventCase(eventType: Phase3EventType) {
  const found = PHASE3_EVENT_CASES.find((candidate) => candidate.eventType === eventType);
  if (!found) throw new Error(`Unknown Phase 3 event type: ${eventType}`);
  return found;
}

function fileDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  expect(process.env.FOREVER_VALIDATION_ISOLATION, "Mutation fixture requires validation isolation mode.").toBe("1");
  expect(process.env.FOREVER_VALIDATION_NONCE_HASH, "Validation nonce hash is required.").toMatch(/^[a-f0-9]{64}$/u);
  expect(databaseUrl, "Mutation fixture requires an absolute Prisma file URL.").toMatch(/^file:/u);
  const databasePath = databaseUrl.slice("file:".length).replaceAll("/", path.sep);
  expect(path.isAbsolute(databasePath), "Validation DATABASE_URL must name an absolute copied database.").toBe(true);
  expect(path.basename(databasePath), "Validation DB must be the harness-owned unique copy.").toMatch(
    /^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u,
  );
  return databasePath;
}

export async function provePhase3MutationIsolation(page: Page) {
  fileDatabasePath();
  const response = await page.request.get("/api/dev/validation/database-identity");
  const body = (await response.json().catch(() => null)) as unknown;
  expect(response.status(), `Unsafe Phase 3 mutation refused: ${JSON.stringify(body)}`).toBe(200);
  expect(body).toEqual({ validationDatabase: true, nonceMatch: true });
  const nonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH!;
  const markerCount = await db.platformAuditEvent.count({
    where: {
      action: "VALIDATION_DATABASE_IDENTITY",
      resourceType: "VALIDATION_DATABASE",
      resourceId: nonceHash,
      correlationId: nonceHash,
    },
  });
  expect(markerCount, "The Playwright process and server must prove the same nonce-marked database.").toBe(1);
}

export async function setPhase3Motion(page: Page, motion: Phase3MotionCase) {
  await page.emulateMedia({ reducedMotion: motion.browserReduced ? "reduce" : "no-preference" });
  await page.addInitScript(({ productMode }) => {
    localStorage.setItem("forever-motion", productMode);
  }, motion);
}

export async function installPhase3EvidenceProbe(page: Page) {
  await page.addInitScript(() => {
    const probeWindow = window as ProbeWindow;
    const evidence = { receipts: [] as Phase3ReceiptEvidence[], states: [] as Phase3StateEvidence[] };
    probeWindow.__lanternwakePhase3Evidence = evidence;
    window.addEventListener("forever:progression-receipt", (event) => {
      evidence.receipts.push(structuredClone((event as CustomEvent<Phase3ReceiptEvidence>).detail));
    });
    window.addEventListener("forever:progression-state", (event) => {
      evidence.states.push(structuredClone((event as CustomEvent<Phase3StateEvidence>).detail));
    });
  });
}

export async function readPhase3Evidence(page: Page): Promise<Phase3EvidenceSnapshot> {
  return page.evaluate(() => {
    const evidence = (window as ProbeWindow).__lanternwakePhase3Evidence;
    if (!evidence) throw new Error("Phase 3 evidence probe is absent.");
    return structuredClone(evidence);
  });
}

function assertReceiptEvidence(receipt: Phase3ReceiptEvidence, eventId: string) {
  expect(receipt.eventId).toBe(eventId);
  expect(receipt.requestId).toMatch(/\S/u);
  expect(receipt.playbackIdentity).toMatch(/\S/u);
  expect(receipt.eventSequence).toBeGreaterThan(0);
  if (["presented", "fallback", "skipped"].includes(receipt.status)) {
    expect(receipt.scene, "A successful presentation receipt must include Director scene evidence.").not.toBeNull();
    expect(receipt.scene?.sceneName).toMatch(/\S/u);
    expect(receipt.scene?.sceneInstanceId).toMatch(/\S/u);
    expect(receipt.scene?.hostId).toMatch(/\S/u);
    expect(receipt.targetReport, "A successful presentation receipt must include preflight evidence.").not.toBeNull();
    expect(receipt.targetReport?.durationMs).toBeGreaterThanOrEqual(0);
    expect(receipt.targetReport?.observations).toEqual(expect.any(Array));
  }
  expect(receipt.localEnhancement.status).toMatch(/^(ran|unavailable|not-applicable)$/u);
}

export async function waitForPhase3Receipt(
  page: Page,
  eventId: string,
  options: Readonly<{ source?: "live" | "reconnect" | "replay"; afterPlaybackIdentity?: string }> = {},
) {
  const matches = (receipt: Phase3ReceiptEvidence) =>
    receipt.eventId === eventId && (!options.source || receipt.source === options.source);
  const select = (receipts: readonly Phase3ReceiptEvidence[]) => {
    let startIndex = 0;
    if (options.afterPlaybackIdentity) {
      for (let index = receipts.length - 1; index >= 0; index -= 1) {
        if (receipts[index]?.playbackIdentity !== options.afterPlaybackIdentity) continue;
        startIndex = index + 1;
        break;
      }
    }
    return receipts.slice(startIndex).find(matches);
  };
  await expect
    .poll(async () => select((await readPhase3Evidence(page)).receipts), {
      message: `No sanitized settled presentation receipt arrived for ${eventId}`,
      timeout: 20_000,
    })
    .toBeTruthy();
  const receipt = select((await readPhase3Evidence(page)).receipts)!;
  assertReceiptEvidence(receipt, eventId);
  return receipt;
}

export async function waitForPhase3Acknowledgment(page: Page, fixture: Phase3CaseFixture, eventId: string) {
  await expect
    .poll(
      async () => {
        const evidence = await readPhase3Evidence(page);
        return evidence.states.find((state) => state.eventId === eventId && state.acknowledged);
      },
      { message: `No acknowledged progression state arrived for ${eventId}`, timeout: 20_000 },
    )
    .toBeTruthy();
  const state = (await readPhase3Evidence(page)).states.find(
    (candidate) => candidate.eventId === eventId && candidate.acknowledged,
  )!;
  expect(state.cursors.observed).toBeGreaterThanOrEqual(state.cursors.queued);
  expect(state.cursors.queued).toBeGreaterThanOrEqual(state.cursors.presented);
  expect(state.cursors.presented).toBeGreaterThanOrEqual(state.cursors.acknowledged);
  const params = new URLSearchParams({ deviceId: fixture.deviceId });
  params.append("eventIds", eventId);
  const response = await page.request.get(`/api/player/${fixture.slug}/viewed?${params.toString()}`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ acknowledgedEventIds: [eventId] });
  return state;
}

export function observeUnsafePhase3Requests(page: Page): UnsafePhase3RequestMonitor {
  const labels = new Map<string, UnsafePhase3Request[]>();
  let active: string | null = null;
  const listener = (request: Request) => {
    const method = request.method().toUpperCase();
    if (!active || method === "GET" || method === "HEAD") return;
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/")) labels.get(active)?.push({ method, pathname });
  };
  page.on("request", listener);
  return {
    begin(label) {
      expect(active, "Unsafe request capture windows must not overlap.").toBeNull();
      labels.set(label, []);
      active = label;
    },
    end(label) {
      expect(active).toBe(label);
      active = null;
      return labels.get(label) ?? [];
    },
    dispose() {
      page.off("request", listener);
    },
  };
}

const sectionLabels = {
  journal: "Journal",
  chart: "Chart",
  treasures: "Altar",
  quests: "Ledger",
  log: "Log",
  finale: "Finale",
} as const satisfies Record<Phase3PlayerSection, string>;

export async function navigatePhase3Section(page: Page, section: Phase3PlayerSection) {
  const navigation = page.getByRole("navigation", { name: "Companion sections" });
  await navigation.getByRole("button", { name: new RegExp(`^${sectionLabels[section]}`, "u") }).click();
  await expect(page.locator(`.voyage-shell.view-${section}`)).toBeVisible();
  await expect(page.locator(".section-transition [data-section-heading]")).toBeFocused();
}

export async function openPhase3Player(
  page: Page,
  fixture: Phase3CaseFixture,
  section: Phase3PlayerSection = "journal",
) {
  if (fixture.preseeded) {
    throw new Error(
      "Preseeded Phase 3 fixtures are read-only; install their Player cookie without calling access POST.",
    );
  }
  await provePhase3MutationIsolation(page);
  await installPhase3EvidenceProbe(page);
  await page.addInitScript(({ deviceId }) => localStorage.setItem("forever-device", deviceId), fixture);
  const access = await page.request.post("/api/player/access", {
    data: { campaignSlug: fixture.slug, accessCode: fixture.accessCode },
  });
  expect(access.status(), await access.text()).toBe(200);
  await page.goto(`${fixture.path}?section=${section}&journalSpeed=0.25`);
  await ensurePhase3JournalReady(page);
  if (!(await page.locator(`.voyage-shell.view-${section}`).count())) await navigatePhase3Section(page, section);
  await expect(page.locator(`.voyage-shell.view-${section}`)).toBeVisible();
  return page.locator("[data-testid='progression-scene-host']").getAttribute("data-scene-host-id");
}

/** Settles the canonical Chronicle opening ceremony after an initial visit or reload. */
export async function ensurePhase3JournalReady(page: Page) {
  const open = page.getByRole("button", { name: "Open the journal" });
  // The outgoing loading shell is intentionally retained while the canonical
  // journal hydrates; assertions must address the current, interactive shell.
  const shell = page.locator(".voyage-shell").last();
  await expect
    .poll(
      async () => {
        if ((await shell.getAttribute("data-journal-phase")) === "JOURNAL_READY") return "ready";
        return (await open.isVisible().catch(() => false)) ? "open" : "pending";
      },
      { timeout: 20_000 },
    )
    .not.toBe("pending");
  if ((await shell.getAttribute("data-journal-phase")) !== "JOURNAL_READY") {
    await expect(open).toBeVisible({ timeout: 4_000 });
    await open.click();
    const skip = page.getByRole("button", { name: "Skip ceremony" });
    await expect(skip).toBeVisible({ timeout: 4_000 });
    await skip.click();
  }
  await expect(shell).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
}

export async function capturePhase3DbTruth(fixture: Phase3CaseFixture): Promise<Phase3DbTruth> {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: fixture.campaignId },
    select: { id: true, slug: true, status: true, currentSequence: true, finaleState: true },
  });
  const [
    chapter,
    artifacts,
    awards,
    mapLocations,
    mapRoutes,
    sideQuests,
    journalEntries,
    events,
    viewed,
    commands,
    audits,
  ] = await Promise.all([
    db.chapter.findFirstOrThrow({
      where: { campaignId: fixture.campaignId },
      select: { state: true, revealedAt: true, solvedAt: true },
    }),
    db.artifact.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { key: "asc" },
      select: { key: true, state: true, connectedArtifactKey: true },
    }),
    db.artifactAward.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { id: "asc" },
      select: { artifactId: true, eventId: true },
    }),
    db.mapLocation.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { key: "asc" },
      select: { key: true, state: true, revealedAt: true },
    }),
    db.mapRoute.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { key: "asc" },
      select: { key: true, state: true, revealedAt: true },
    }),
    db.sideQuest.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { key: "asc" },
      select: { key: true, state: true, completedAt: true },
    }),
    db.journalEntry.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { id: "asc" },
      select: { id: true, kind: true, eventId: true },
    }),
    db.progressEvent.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { sequence: "asc" },
      select: { id: true, type: true, sequence: true, reversesEventId: true },
    }),
    db.viewedCeremony.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { eventId: "asc" },
      select: { eventId: true, deviceId: true },
    }),
    db.commandExecution.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { createdAt: "asc" },
      select: { command: true, expectedSequence: true, status: true, correlationId: true },
    }),
    db.adminAuditLog.findMany({
      where: { campaignId: fixture.campaignId },
      orderBy: { createdAt: "asc" },
      select: { action: true, outcome: true, correlationId: true },
    }),
  ]);
  return {
    campaign,
    chapter,
    storyMutation: { artifacts, awards, mapLocations, mapRoutes, sideQuests, journalEntries },
    events,
    viewed,
    commands,
    audits,
  };
}

function commandInput(fixture: Phase3CaseFixture, eventType: Phase3EventType, expectedSequence: number) {
  const targetKeys: Partial<Record<Phase3EventType, string>> = {
    ARTIFACT_AWARDED: fixture.artifactKey,
    ARTIFACT_SILHOUETTE_REVEALED: fixture.artifactKey,
    ARTIFACT_CONNECTED: fixture.artifactKey,
    MAP_LOCATION_REVEALED: fixture.mapLocationKey,
    MAP_ROUTE_REVEALED: fixture.mapRouteKey,
    SIDE_QUEST_DISCOVERED: fixture.sideQuestKey,
    SIDE_QUEST_UPDATED: fixture.sideQuestKey,
    SIDE_QUEST_COMPLETED: fixture.sideQuestKey,
    FINALE_REQUIREMENT_UPDATED: fixture.finaleRequirementKey,
  };
  const values: Partial<Record<Phase3EventType, string>> = {
    JOURNAL_ANNOTATION_ADDED: `Phase 3 annotation ${fixture.caseId}`,
    PLAYER_LOG_ENTRY_ADDED: `Phase 3 log ${fixture.caseId}`,
  };
  const value = values[eventType];
  return {
    command: eventCase(eventType).command,
    campaignSlug: fixture.slug,
    expectedSequence,
    idempotencyKey: `phase3-${fixture.caseId.toLowerCase()}-${randomUUID()}`,
    ...(targetKeys[eventType] ? { targetKey: targetKeys[eventType] } : {}),
    payload: value ? { value } : {},
    confirmation: true,
  };
}

async function publishCommand(captain: APIRequestContext, fixture: Phase3CaseFixture, eventType: Phase3EventType) {
  const resolved = await resolveLegacyCampaign(fixture.slug);
  if (!resolved)
    throw new Error(`Phase 3 fixture ${fixture.slug} was not migrated into a canonical Chronicle Session.`);
  const session = await db.taleSession.findUniqueOrThrow({
    where: { id: resolved.sessionId },
    select: { currentSequence: true },
  });
  const response = await captain.post("/api/gm/commands", {
    data: commandInput(fixture, eventType, session.currentSequence),
  });
  const body = (await response.json().catch(() => null)) as
    | (Phase3CommandReceipt & { error?: string; code?: string })
    | null;
  expect(response.status(), `GM command failed: ${JSON.stringify(body)}`).toBe(200);
  expect(body).toMatchObject({
    persistence: "COMMITTED",
    publication: "PROCESS_PUBLISHED",
    delivery: "PUBLISHED",
    playerDelivery: "UNCONFIRMED",
    playerPresentation: "UNCONFIRMED",
    playerAcknowledgment: "UNCONFIRMED",
    event: { type: eventType, sequence: session.currentSequence + 1 },
  });
  return body!;
}

export const PHASE3_FIXTURE_CLEANUP_ORDER = ["viewed-ceremonies", "campaign-cascade", "chapter-content"] as const;

type Phase3FixtureCleanupIdentity = Readonly<{ campaignId: string; chapterContentId: string }>;

async function cleanupPhase3FixtureRecords(identity: Phase3FixtureCleanupIdentity) {
  const failures: unknown[] = [];
  const step = async (cleanup: () => Promise<unknown>) => {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  };
  // ViewedCeremony has no Campaign relation, so it must be removed explicitly
  // before the campaign cascade. ChapterContent is shared by relation rather
  // than owned by Campaign and is released only after the campaign is gone.
  await step(() => db.viewedCeremony.deleteMany({ where: { campaignId: identity.campaignId } }));
  await step(() => db.campaign.deleteMany({ where: { id: identity.campaignId } }));
  await step(() => db.chapterContent.deleteMany({ where: { id: identity.chapterContentId } }));
  if (failures.length > 0) throw new AggregateError(failures, "Phase 3 fixture cleanup was incomplete.");
}

async function createCaseFixture(captain: APIRequestContext, caseId: string, eventType: Phase3EventType) {
  fileDatabasePath();
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const canonicalCaseId = caseId
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
  const slug = `phase3-${canonicalCaseId}-${token}`;
  const accessCode = `phase3-${randomUUID()}`;
  const deviceId = randomUUID();
  const artifactKey = `artifact-a-${token}`;
  const connectedArtifactKey = `artifact-b-${token}`;
  const mapLocationKey = `location-a-${token}`;
  const mapDestinationKey = `location-b-${token}`;
  const mapRouteKey = `route-a-${token}`;
  const sideQuestKey = `quest-a-${token}`;
  const finaleRequirementKey = `requirement-a-${token}`;
  const identity = Object.freeze({ campaignId: randomUUID(), chapterContentId: randomUUID() });
  const chapterState =
    eventType === "CHAPTER_RELEASED" ? "READY" : eventType === "CHAPTER_SOLVED" ? "ACTIVE" : "ACTIVE";
  const questState =
    eventType === "SIDE_QUEST_DISCOVERED"
      ? "HIDDEN"
      : eventType === "SIDE_QUEST_UPDATED" || eventType === "SIDE_QUEST_COMPLETED"
        ? "DISCOVERED"
        : "HIDDEN";
  const routePrerequisitesRevealed = eventType === "MAP_ROUTE_REVEALED";
  const accessCodeHash = await bcrypt.hash(accessCode, 10);
  try {
    const campaign = await db.$transaction(async (tx) => {
      await tx.chapterContent.create({
        data: {
          id: identity.chapterContentId,
          title: `Phase 3 ${caseId}`,
          narrative: "A validation-safe chapter narrative.",
          objective: "Prove the Player presentation contract.",
          developmentOnly: true,
        },
      });
      return tx.campaign.create({
        data: {
          id: identity.campaignId,
          slug,
          title: `Lanternwake ${caseId}`,
          status: eventType === "CAMPAIGN_RESUMED" ? "PAUSED" : "ACTIVE",
          accessCodeHash,
          finaleRequirements: JSON.stringify([
            { key: finaleRequirementKey, label: "Validation seal", current: 0, target: 2 },
          ]),
          playerAccesses: {
            create: {
              tokenHash: createHash("sha256").update(`player-${randomUUID()}`).digest("hex"),
              label: caseId,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
          chapters: {
            create: {
              ordinal: 1,
              state: chapterState,
              contentId: identity.chapterContentId,
              safeTeaser: "A validation-safe teaser.",
              clues: { create: { ordinal: 1, body: "A validation-safe riddle." } },
            },
          },
          artifacts: {
            create: [
              {
                key: artifactKey,
                name: "Validation Compass",
                description: "A safe validation artifact.",
                safeName: "Compass silhouette",
                silhouetteLabel: "A compass-shaped silhouette",
                connectedArtifactKey,
              },
              {
                key: connectedArtifactKey,
                name: "Validation Sextant",
                description: "A second safe validation artifact.",
                safeName: "Sextant silhouette",
                silhouetteLabel: "A sextant-shaped silhouette",
                connectedArtifactKey: artifactKey,
              },
            ],
          },
          mapLocations: {
            create: [
              {
                key: mapLocationKey,
                name: "Validation Shoal",
                regionLabel: "Test Waters",
                x: 30,
                y: 40,
                ...(routePrerequisitesRevealed ? { state: "REVEALED", revealedAt: new Date() } : {}),
              },
              {
                key: mapDestinationKey,
                name: "Validation Cay",
                regionLabel: "Test Waters",
                x: 70,
                y: 60,
                ...(routePrerequisitesRevealed ? { state: "REVEALED", revealedAt: new Date() } : {}),
              },
            ],
          },
          mapRoutes: {
            create: { key: mapRouteKey, fromKey: mapLocationKey, toKey: mapDestinationKey, ordinal: 1 },
          },
          sideQuests: {
            create: {
              key: sideQuestKey,
              title: "Validation Side Quest",
              state: questState,
              safeTeaser: "A safe side-quest teaser.",
              rewardLabel: "Validation token",
              objectives: {
                create: [
                  { ordinal: 1, body: "Inspect the validation waypoint." },
                  { ordinal: 2, body: "Return to the validation journal." },
                ],
              },
            },
          },
        },
        include: { playerAccesses: true },
      });
    });
    let fixture: Phase3CaseFixture = Object.freeze({
      caseId,
      eventType,
      campaignId: identity.campaignId,
      chapterContentId: identity.chapterContentId,
      playerAccessId: campaign.playerAccesses[0]!.id,
      slug,
      path: `/tale/${slug}`,
      accessCode,
      deviceId,
      artifactKey,
      connectedArtifactKey,
      mapLocationKey,
      mapRouteKey,
      sideQuestKey,
      finaleRequirementKey,
      prerequisiteEventId: null,
      preseeded: false,
    });
    if (routePrerequisitesRevealed) {
      await db.viewedContent.createMany({
        data: [
          { playerAccessId: campaign.playerAccesses[0]!.id, contentType: "map", contentKey: mapLocationKey },
          { playerAccessId: campaign.playerAccesses[0]!.id, contentType: "map", contentKey: mapDestinationKey },
        ],
      });
    }
    const migration = await migrateLegacyCompanion({ campaignSlug: slug });
    if (migration.failures.length || migration.checksumMismatches.length)
      throw new Error(
        `Phase 3 fixture migration failed: ${[...migration.failures, ...migration.checksumMismatches].join("; ")}`,
      );
    if (eventType === "STATE_REVERTED") {
      const precursor = await publishCommand(captain, fixture, "PLAYER_LOG_ENTRY_ADDED");
      await db.viewedCeremony.create({
        data: { campaignId: identity.campaignId, eventId: precursor.event.id, deviceId },
      });
      fixture = Object.freeze({ ...fixture, prerequisiteEventId: precursor.event.id });
    }
    return fixture;
  } catch (error) {
    try {
      await cleanupPhase3FixtureRecords(identity);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Phase 3 fixture creation and exact rollback both failed.");
    }
    throw error;
  }
}

export function readPreseededPhase3FixtureFromEnv(eventType: Phase3EventType): Phase3CaseFixture {
  if (process.env.PHASE3_PRESEEDED_FIXTURE_JSON !== undefined) {
    throw new Error(
      "PHASE3_PRESEEDED_FIXTURE_JSON is unsupported; read-only fixtures require the nonce-bound manifest.",
    );
  }
  const manifestPath = phase3PreseededManifestPath();
  if (!existsSync(manifestPath)) {
    throw new Error(`Read-only Phase 3 fixture manifest is absent: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Phase3PreseededFixtureManifest;
  if (manifest.version !== 1 || manifest.validationNonceHash !== process.env.FOREVER_VALIDATION_NONCE_HASH) {
    throw new Error("Read-only Phase 3 fixture manifest does not match this isolated validation database.");
  }
  const entry = manifest.fixtures[eventType];
  if (!entry) throw new Error(`Read-only Phase 3 manifest lacks ${eventType}.`);
  return Object.freeze({
    ...entry.fixture,
    eventType,
    accessCode: "",
    prerequisiteEventId: entry.eventId,
    preseeded: true,
  });
}

export type Phase3SanitizedFixtureIdentity = Omit<Phase3CaseFixture, "accessCode" | "preseeded">;
export type Phase3PreseededFixtureManifest = Readonly<{
  version: 1;
  validationNonceHash: string;
  base: Phase3SanitizedFixtureIdentity;
  fixtures: Partial<
    Record<
      Phase3EventType,
      Readonly<{ fixture: Phase3SanitizedFixtureIdentity; eventId: string; eventSequence: number }>
    >
  >;
}>;

export function phase3PreseededManifestPath() {
  return path.resolve(
    process.env.VALIDATION_ARTIFACTS ?? path.join("artifacts", "validation"),
    "phase3",
    "preseeded-fixtures.json",
  );
}

export function readPreseededPhase3BaseFixture(): Phase3CaseFixture {
  const manifestPath = phase3PreseededManifestPath();
  if (!existsSync(manifestPath)) throw new Error(`Read-only Phase 3 fixture manifest is absent: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Phase3PreseededFixtureManifest;
  if (manifest.version !== 1 || manifest.validationNonceHash !== process.env.FOREVER_VALIDATION_NONCE_HASH) {
    throw new Error("Read-only Phase 3 base fixture does not match this isolated validation database.");
  }
  return Object.freeze({ ...manifest.base, accessCode: "", preseeded: true });
}

type Phase3Captain = Readonly<{ context: APIRequestContext; csrfToken: string }>;

async function releasePhase3CaptainSession(
  context: APIRequestContext | null,
  csrfToken: string | null,
  sessionHash: string | null,
) {
  if (!context && !sessionHash) return;
  let logoutFailure: unknown = null;
  if (context && csrfToken) {
    try {
      const response = await context.post("/api/gm/logout", { headers: { "x-csrf-token": csrfToken } });
      if (response.status() === 200) return;
      logoutFailure = new Error(`CAPTAIN logout returned HTTP ${response.status()}.`);
    } catch (error) {
      logoutFailure = error;
    }
  }
  if (sessionHash) {
    try {
      // Exact-ID fallback is reserved for server teardown/failure after a
      // successful login. It never deletes another worker's session.
      await db.gameMasterSession.deleteMany({ where: { id: sessionHash } });
      return;
    } catch (fallbackFailure) {
      throw new AggregateError(
        logoutFailure ? [logoutFailure, fallbackFailure] : [fallbackFailure],
        "CAPTAIN logout and exact session cleanup failed.",
      );
    }
  }
  if (logoutFailure) throw logoutFailure;
}

export type Phase3FixtureManager = Readonly<{
  proveIsolation(): Promise<void>;
  createCase(caseId: string, eventType: Phase3EventType): Promise<Phase3CaseFixture>;
  publish(fixture: Phase3CaseFixture, eventType?: Phase3EventType): Promise<Phase3CommandReceipt>;
  replay(page: Page, eventId: string): Promise<Phase3ReceiptEvidence>;
  revokeAccess(fixture: Phase3CaseFixture): Promise<void>;
  retainForReadOnly(fixture: Phase3CaseFixture): void;
}>;

type Phase3TestFixtures = { phase3: Phase3FixtureManager };
type Phase3WorkerFixtures = { phase3Captain: Phase3Captain; phase3BaseURL: string };

export const phase3Test = baseTest.extend<Phase3TestFixtures, Phase3WorkerFixtures>({
  phase3BaseURL: [
    process.env.PHASE3_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    { scope: "worker", option: true },
  ],
  phase3Captain: [
    async ({ phase3BaseURL }, provide) => {
      let bootstrap: APIRequestContext | null = null;
      let context: APIRequestContext | null = null;
      let csrfToken: string | null = null;
      let sessionHash: string | null = null;
      let primaryFailure: unknown = null;
      try {
        bootstrap = await playwrightRequest.newContext({ baseURL: phase3BaseURL });
        fileDatabasePath();
        const identityResponse = await bootstrap.get("/api/dev/validation/database-identity");
        const identity = (await identityResponse.json().catch(() => null)) as unknown;
        expect(identityResponse.status(), `Unsafe CAPTAIN login refused: ${JSON.stringify(identity)}`).toBe(200);
        expect(identity).toEqual({ validationDatabase: true, nonceMatch: true });
        const nonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH!;
        expect(
          await db.platformAuditEvent.count({
            where: {
              action: "VALIDATION_DATABASE_IDENTITY",
              resourceType: "VALIDATION_DATABASE",
              resourceId: nonceHash,
              correlationId: nonceHash,
            },
          }),
          "CAPTAIN login requires the same nonce-marked isolated database.",
        ).toBe(1);
        const response = await bootstrap.post("/api/gm/login", {
          data: {
            username: process.env.GM_USERNAME,
            password: process.env.GM_PASSWORD,
          },
        });
        const body = (await response.json().catch(() => null)) as { csrfToken?: string; error?: string } | null;
        const storageState = await bootstrap.storageState();
        const sessionCookie = storageState.cookies.find((cookie) => cookie.name === "forever_gm");
        if (sessionCookie?.value) {
          sessionHash = createHash("sha256").update(sessionCookie.value).digest("hex");
        }
        expect(response.status(), `CAPTAIN login failed: ${JSON.stringify(body)}`).toBe(200);
        expect(body?.csrfToken).toMatch(/\S/u);
        csrfToken = body!.csrfToken!;
        expect(sessionCookie?.value, "CAPTAIN login must return its exact session cookie.").toMatch(/\S/u);
        context = await playwrightRequest.newContext({
          baseURL: phase3BaseURL,
          storageState,
          extraHTTPHeaders: { "x-csrf-token": csrfToken },
        });
        const capability = await context.get("/api/gm/status");
        expect(capability.status(), "Phase 3 fixture requires an authenticated CAPTAIN capability.").toBe(200);
        await provide({ context, csrfToken });
      } catch (error) {
        primaryFailure = error;
      }

      const cleanupFailures: unknown[] = [];
      try {
        await releasePhase3CaptainSession(context ?? bootstrap, csrfToken, sessionHash);
      } catch (error) {
        cleanupFailures.push(error);
      }
      for (const requestContext of [context, bootstrap]) {
        if (!requestContext) continue;
        try {
          await requestContext.dispose();
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
      if (primaryFailure && cleanupFailures.length > 0) {
        throw new AggregateError(
          [primaryFailure, ...cleanupFailures],
          "CAPTAIN fixture failed and its session cleanup was incomplete.",
        );
      }
      if (primaryFailure) throw primaryFailure;
      if (cleanupFailures.length > 0) {
        throw new AggregateError(cleanupFailures, "CAPTAIN fixture session cleanup was incomplete.");
      }
    },
    { scope: "worker" },
  ],
  phase3: async ({ page, browserName, phase3Captain }, provide) => {
    const owned: Phase3CaseFixture[] = [];
    const retained = new Set<string>();
    let isolationProved = false;
    const proveIsolation = async () => {
      await provePhase3MutationIsolation(page);
      isolationProved = true;
    };
    const requireMutationAuthority = async () => {
      expect(browserName, "Phase 3 story mutations are Chromium-only.").toBe("chromium");
      if (!isolationProved) await proveIsolation();
    };
    await provide({
      proveIsolation,
      async createCase(caseId, eventType) {
        await requireMutationAuthority();
        const fixture = await createCaseFixture(phase3Captain.context, caseId, eventType);
        owned.push(fixture);
        return fixture;
      },
      async publish(fixture, eventType = fixture.eventType) {
        await requireMutationAuthority();
        return publishCommand(phase3Captain.context, fixture, eventType);
      },
      async replay(replayPage, eventId) {
        const priorReceipt = (await readPhase3Evidence(replayPage)).receipts
          .filter((receipt) => receipt.eventId === eventId)
          .at(-1);
        const notice = replayPage.locator(`[data-progress-event-id="${eventId}"]`);
        if (await notice.isVisible()) {
          await notice.getByRole("button", { name: "Replay presentation" }).click();
        } else {
          const history = replayPage.locator("[data-presentation-history]");
          await expect(history).toBeVisible();
          const details = history.locator("details");
          if (!(await details.getAttribute("open"))) await details.locator("summary").click();
          const exactReplay = history.locator(`[data-replay-event-id="${eventId}"]`);
          await expect(exactReplay, `Presentation history must expose exact replay identity ${eventId}.`).toBeVisible();
          await exactReplay.click();
        }
        return waitForPhase3Receipt(replayPage, eventId, {
          source: "replay",
          ...(priorReceipt ? { afterPlaybackIdentity: priorReceipt.playbackIdentity } : {}),
        });
      },
      async revokeAccess(fixture) {
        await requireMutationAuthority();
        await db.playerAccess.update({ where: { id: fixture.playerAccessId }, data: { expiresAt: new Date(0) } });
      },
      retainForReadOnly(fixture) {
        retained.add(fixture.campaignId);
      },
    });
    const cleanupFailures: unknown[] = [];
    for (const fixture of owned.reverse()) {
      if (retained.has(fixture.campaignId)) continue;
      try {
        await cleanupPhase3FixtureRecords({
          campaignId: fixture.campaignId,
          chapterContentId: fixture.chapterContentId,
        });
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "One or more Phase 3 fixtures could not be cleaned up exactly.");
    }
  },
});
