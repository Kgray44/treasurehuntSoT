import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page, Request, TestInfo } from "@playwright/test";
import {
  ANIMATION_SEMANTIC_LABEL_EVENT_NAME,
  type AnimationSemanticLabelEventDetail,
} from "../../src/animation/director/AnimationDirector";
import {
  capturePhase3DbTruth,
  expect,
  installPhase3EvidenceProbe,
  PHASE3_MOTION_MODES,
  phase3Test as test,
  provePhase3MutationIsolation,
  readPreseededPhase3BaseFixture,
  readPreseededPhase3FixtureFromEnv,
  setPhase3Motion,
  waitForPhase3Receipt,
  type Phase3CaseFixture,
  type Phase3EventType,
  type Phase3MotionCase,
  type Phase3PlayerSection,
  type Phase3ReceiptEvidence,
} from "./fixtures/lanternwake-phase3";
import { db } from "../../src/lib/db";
import { policyForProgressionEvent } from "../../src/components/player/progression/event-policy";

type IndexedEvent = "opening" | Phase3EventType;
type IndexedMode = "full" | "gentle" | "product-reduced" | "browser-reduced";
type IndexedBrowser = "Chromium" | "WebKit";
type ViewportName = "2560x1440" | "1920x1080" | "1440x900" | "430x932" | "390x844" | "844x390";

type CheckpointSignal =
  | Readonly<{
      kind: "director";
      sceneName: AnimationSemanticLabelEventDetail["sceneName"];
      label: string;
      occurrence?: number;
    }>
  | Readonly<{ kind: "journal-phase"; phase: string; actor?: string }>
  | Readonly<{ kind: "pageflip-readiness" }>
  | Readonly<{ kind: "settled"; expectedStatus?: "fallback" }>
  | Readonly<{ kind: "artifact-dialog-open" | "artifact-engraving" | "artifact-return" }>
  | Readonly<{ kind: "finale-pose"; pose: string }>;

type VisualCheckpoint = Readonly<{
  ordinal: number;
  label: string;
  event: IndexedEvent;
  caseId: string;
  section: Phase3PlayerSection;
  mode: IndexedMode;
  viewport: ViewportName;
  browser: IndexedBrowser;
  signal: CheckpointSignal;
  group?: string;
  forceFallback?: boolean;
  authoritativeFinaleState?: "DORMANT" | "READY" | "UNLOCKING" | "UNLOCKED" | "COMPLETE";
}>;

const director = (
  sceneName: AnimationSemanticLabelEventDetail["sceneName"],
  label: string,
  occurrence = 1,
): CheckpointSignal => ({ kind: "director", sceneName, label, occurrence });

const checkpoints = [
  {
    ordinal: 1,
    label: "entry activated",
    event: "opening",
    caseId: "VCP-JRN-01",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "ENTRY_ACTIVATED" },
    group: "journal-full",
  },
  {
    ordinal: 2,
    label: "camera approach",
    event: "opening",
    caseId: "VCP-JRN-02",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "CLOSED_BOOK_REVEAL", actor: "closed-book" },
    group: "journal-full",
  },
  {
    ordinal: 3,
    label: "clasp awake",
    event: "opening",
    caseId: "VCP-JRN-03",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "CLOSED_BOOK_REVEAL", actor: "latch" },
    group: "journal-full",
  },
  {
    ordinal: 4,
    label: "latch released",
    event: "opening",
    caseId: "VCP-JRN-04",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "LATCH_RELEASING", actor: "latch" },
    group: "journal-full",
  },
  {
    ordinal: 5,
    label: "cover open",
    event: "opening",
    caseId: "VCP-JRN-05",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "COVER_OPENING", actor: "front-cover" },
    group: "journal-full",
  },
  {
    ordinal: 6,
    label: "sealed page",
    event: "opening",
    caseId: "VCP-JRN-06",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "SEALED_PAGE_REVEAL", actor: "sealed-page" },
    group: "journal-full",
  },
  {
    ordinal: 7,
    label: "seal broken",
    event: "opening",
    caseId: "VCP-JRN-07",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "SEAL_BREAKING", actor: "wax-seal" },
    group: "journal-full",
  },
  {
    ordinal: 8,
    label: "book settled",
    event: "opening",
    caseId: "VCP-JRN-08",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "BOOK_SETTLING", actor: "book-camera" },
    group: "journal-full",
  },
  {
    ordinal: 9,
    label: "PageFlip interactive",
    event: "opening",
    caseId: "VCP-JRN-09",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "pageflip-readiness" },
    group: "journal-full",
  },
  {
    ordinal: 10,
    label: "interface ready",
    event: "opening",
    caseId: "VCP-JRN-10",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "journal-phase", phase: "JOURNAL_READY", actor: "persistent-interface" },
    group: "journal-full",
  },
  {
    ordinal: 11,
    label: "objective ready",
    event: "opening",
    caseId: "VCP-JRN-11",
    section: "journal",
    mode: "browser-reduced",
    viewport: "390x844",
    browser: "WebKit",
    signal: { kind: "journal-phase", phase: "JOURNAL_READY", actor: "objective" },
    group: "journal-reduced",
  },

  {
    ordinal: 12,
    label: "preflight",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-01",
    section: "chart",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "scene-start"),
    group: "chapter-chart",
  },
  {
    ordinal: 13,
    label: "seal pressure",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-02",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "seal"),
    group: "chapter-journal",
  },
  {
    ordinal: 14,
    label: "seal fracture",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-03",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "parchment"),
    group: "chapter-journal",
  },
  {
    ordinal: 15,
    label: "parchment open",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-04",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "ink-heading"),
    group: "chapter-journal",
  },
  {
    ordinal: 16,
    label: "heading",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-05",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "ink-story"),
    group: "chapter-journal",
  },
  {
    ordinal: 17,
    label: "story prose",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-06",
    section: "treasures",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "ink-objective"),
  },
  {
    ordinal: 18,
    label: "objective",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-07",
    section: "quests",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "ink-riddle"),
  },
  {
    ordinal: 19,
    label: "riddle",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-08",
    section: "log",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "map"),
  },
  {
    ordinal: 20,
    label: "quill",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-09",
    section: "finale",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "map"),
  },
  {
    ordinal: 21,
    label: "map inset",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-10",
    section: "journal",
    mode: "full",
    viewport: "1920x1080",
    browser: "Chromium",
    signal: director("chapter-release", "active"),
  },
  {
    ordinal: 22,
    label: "complete",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-11",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("chapter-release", "scene-complete"),
    group: "chapter-journal",
  },
  {
    ordinal: 23,
    label: "actions ready",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-12",
    section: "journal",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "settled" },
    group: "chapter-journal",
  },
  {
    ordinal: 24,
    label: "reduced final",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-13",
    section: "chart",
    mode: "browser-reduced",
    viewport: "844x390",
    browser: "WebKit",
    signal: { kind: "settled" },
  },
  {
    ordinal: 25,
    label: "fallback final",
    event: "CHAPTER_RELEASED",
    caseId: "VCP-CHP-14",
    section: "journal",
    mode: "product-reduced",
    viewport: "390x844",
    browser: "Chromium",
    signal: { kind: "settled", expectedStatus: "fallback" },
    forceFallback: true,
  },

  {
    ordinal: 26,
    label: "global location object",
    event: "MAP_LOCATION_REVEALED",
    caseId: "VCP-MAP-01",
    section: "chart",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("map-reveal", "fog-gathering"),
    group: "map-location",
  },
  {
    ordinal: 27,
    label: "marker stamp",
    event: "MAP_LOCATION_REVEALED",
    caseId: "VCP-MAP-02",
    section: "chart",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("map-reveal", "marker-stamp"),
    group: "map-location",
  },
  {
    ordinal: 28,
    label: "fog settled",
    event: "MAP_LOCATION_REVEALED",
    caseId: "VCP-MAP-03",
    section: "chart",
    mode: "product-reduced",
    viewport: "390x844",
    browser: "Chromium",
    signal: { kind: "settled" },
  },
  {
    ordinal: 29,
    label: "route start",
    event: "MAP_ROUTE_REVEALED",
    caseId: "VCP-MAP-04",
    section: "finale",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("route-draw", "route-drawing"),
  },
  {
    ordinal: 30,
    label: "route complete",
    event: "MAP_ROUTE_REVEALED",
    caseId: "VCP-MAP-05",
    section: "chart",
    mode: "full",
    viewport: "2560x1440",
    browser: "Chromium",
    signal: director("route-draw", "scene-complete"),
  },
  {
    ordinal: 31,
    label: "ship course settled",
    event: "MAP_ROUTE_REVEALED",
    caseId: "VCP-MAP-06",
    section: "chart",
    mode: "browser-reduced",
    viewport: "844x390",
    browser: "WebKit",
    signal: { kind: "settled" },
  },

  {
    ordinal: 32,
    label: "global relic reveal",
    event: "ARTIFACT_AWARDED",
    caseId: "VCP-ART-01",
    section: "treasures",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("artifact-award", "silhouette"),
    group: "artifact-award",
  },
  {
    ordinal: 33,
    label: "slot handoff",
    event: "ARTIFACT_AWARDED",
    caseId: "VCP-ART-02",
    section: "treasures",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("artifact-award", "interaction-restored"),
    group: "artifact-award",
  },
  {
    ordinal: 34,
    label: "pedestal settle",
    event: "ARTIFACT_SILHOUETTE_REVEALED",
    caseId: "VCP-ART-03",
    section: "treasures",
    mode: "gentle",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("artifact-award", "artifact-settled"),
  },
  {
    ordinal: 35,
    label: "connection draw",
    event: "ARTIFACT_CONNECTED",
    caseId: "VCP-ART-04",
    section: "treasures",
    mode: "full",
    viewport: "1920x1080",
    browser: "Chromium",
    signal: director("artifact-connection", "connection-drawing"),
  },
  {
    ordinal: 36,
    label: "inspection open",
    event: "ARTIFACT_AWARDED",
    caseId: "VCP-ART-05",
    section: "treasures",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "artifact-dialog-open" },
    group: "artifact-award",
  },
  {
    ordinal: 37,
    label: "engraving complete",
    event: "ARTIFACT_AWARDED",
    caseId: "VCP-ART-06",
    section: "treasures",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "artifact-engraving" },
    group: "artifact-award",
  },
  {
    ordinal: 38,
    label: "return to slot",
    event: "ARTIFACT_AWARDED",
    caseId: "VCP-ART-07",
    section: "treasures",
    mode: "browser-reduced",
    viewport: "430x932",
    browser: "WebKit",
    signal: { kind: "artifact-return" },
  },

  {
    ordinal: 39,
    label: "rumor note",
    event: "SIDE_QUEST_DISCOVERED",
    caseId: "VCP-QST-01",
    section: "quests",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("quest-discovery", "note-unfolds"),
    group: "quest-discovery",
  },
  {
    ordinal: 40,
    label: "pin/thread",
    event: "SIDE_QUEST_DISCOVERED",
    caseId: "VCP-QST-02",
    section: "quests",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("quest-discovery", "interaction-restored"),
    group: "quest-discovery",
  },
  {
    ordinal: 41,
    label: "objective update",
    event: "SIDE_QUEST_UPDATED",
    caseId: "VCP-QST-03",
    section: "quests",
    mode: "gentle",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("quest-discovery", "note-unfolds"),
  },
  {
    ordinal: 42,
    label: "completion stamp",
    event: "SIDE_QUEST_COMPLETED",
    caseId: "VCP-QST-04",
    section: "quests",
    mode: "full",
    viewport: "1920x1080",
    browser: "Chromium",
    signal: director("quest-complete", "completion-stamp"),
  },
  {
    ordinal: 43,
    label: "reward state",
    event: "SIDE_QUEST_COMPLETED",
    caseId: "VCP-QST-05",
    section: "quests",
    mode: "browser-reduced",
    viewport: "390x844",
    browser: "WebKit",
    signal: { kind: "settled" },
  },

  {
    ordinal: 44,
    label: "global summary",
    event: "PLAYER_LOG_ENTRY_ADDED",
    caseId: "VCP-LOG-01",
    section: "log",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("log-entry", "attention"),
    group: "log-full",
  },
  {
    ordinal: 45,
    label: "fresh ink",
    event: "PLAYER_LOG_ENTRY_ADDED",
    caseId: "VCP-LOG-02",
    section: "log",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("log-entry", "date-written"),
    group: "log-full",
  },
  {
    ordinal: 46,
    label: "date stamp",
    event: "PLAYER_LOG_ENTRY_ADDED",
    caseId: "VCP-LOG-03",
    section: "log",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("log-entry", "interaction-restored"),
    group: "log-full",
  },
  {
    ordinal: 47,
    label: "symbol seal",
    event: "PLAYER_LOG_ENTRY_ADDED",
    caseId: "VCP-LOG-04",
    section: "log",
    mode: "gentle",
    viewport: "2560x1440",
    browser: "Chromium",
    signal: director("log-entry", "interaction-restored"),
  },
  {
    ordinal: 48,
    label: "settled row",
    event: "PLAYER_LOG_ENTRY_ADDED",
    caseId: "VCP-LOG-05",
    section: "log",
    mode: "browser-reduced",
    viewport: "430x932",
    browser: "WebKit",
    signal: { kind: "settled" },
  },

  {
    ordinal: 49,
    label: "dormant",
    event: "FINALE_TEASED",
    caseId: "VCP-FIN-01",
    section: "finale",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "finale-pose", pose: "dormant" },
    authoritativeFinaleState: "DORMANT",
  },
  {
    ordinal: 50,
    label: "tease wake",
    event: "FINALE_TEASED",
    caseId: "VCP-FIN-02",
    section: "finale",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("finale-tease", "mechanism-wakes"),
  },
  {
    ordinal: 51,
    label: "requirement transfer",
    event: "FINALE_REQUIREMENT_UPDATED",
    caseId: "VCP-FIN-03",
    section: "finale",
    mode: "gentle",
    viewport: "1440x900",
    browser: "Chromium",
    signal: director("finale-requirement", "requirement-activates"),
  },
  {
    ordinal: 52,
    label: "ready",
    event: "FINALE_REQUIREMENT_UPDATED",
    caseId: "VCP-FIN-04",
    section: "finale",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "finale-pose", pose: "ready" },
    group: "finale-ready",
    authoritativeFinaleState: "READY",
  },
  {
    ordinal: 53,
    label: "unlock start",
    event: "FINALE_REQUIREMENT_UPDATED",
    caseId: "VCP-FIN-05",
    section: "finale",
    mode: "full",
    viewport: "1920x1080",
    browser: "Chromium",
    signal: director("finale-requirement", "requirement-activates"),
    authoritativeFinaleState: "UNLOCKING",
  },
  {
    ordinal: 54,
    label: "seal fracture",
    event: "FINALE_REQUIREMENT_UPDATED",
    caseId: "VCP-FIN-06",
    section: "finale",
    mode: "full",
    viewport: "2560x1440",
    browser: "Chromium",
    signal: director("finale-requirement", "interaction-restored"),
    authoritativeFinaleState: "UNLOCKING",
  },
  {
    ordinal: 55,
    label: "chamber expansion",
    event: "FINALE_REQUIREMENT_UPDATED",
    caseId: "VCP-FIN-07",
    section: "finale",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "finale-pose", pose: "unlocked" },
    group: "finale-unlocked",
    authoritativeFinaleState: "UNLOCKED",
  },
  {
    ordinal: 56,
    label: "complete",
    event: "FINALE_REQUIREMENT_UPDATED",
    caseId: "VCP-FIN-08",
    section: "finale",
    mode: "full",
    viewport: "1440x900",
    browser: "Chromium",
    signal: { kind: "finale-pose", pose: "complete" },
    authoritativeFinaleState: "COMPLETE",
  },
  {
    ordinal: 57,
    label: "reduced final",
    event: "FINALE_TEASED",
    caseId: "VCP-FIN-09",
    section: "finale",
    mode: "browser-reduced",
    viewport: "844x390",
    browser: "WebKit",
    signal: { kind: "settled" },
  },
] as const satisfies readonly VisualCheckpoint[];

const viewportSizes: Readonly<Record<ViewportName, Readonly<{ width: number; height: number }>>> = {
  "2560x1440": { width: 2560, height: 1440 },
  "1920x1080": { width: 1920, height: 1080 },
  "1440x900": { width: 1440, height: 900 },
  "430x932": { width: 430, height: 932 },
  "390x844": { width: 390, height: 844 },
  "844x390": { width: 844, height: 390 },
};

const motionForMode: Readonly<Record<IndexedMode, Phase3MotionCase>> = {
  full: PHASE3_MOTION_MODES[0],
  gentle: PHASE3_MOTION_MODES[1],
  "product-reduced": PHASE3_MOTION_MODES[2],
  "browser-reduced": PHASE3_MOTION_MODES[3],
};

type AuthoritativeFinaleState = NonNullable<VisualCheckpoint["authoritativeFinaleState"]>;

const authoritativeFinaleSemantics = {
  DORMANT: { pose: "dormant", stateIndex: "0", label: "dormant", progress: "0.000" },
  READY: { pose: "ready", stateIndex: "4", label: "ready", progress: "1.000" },
  UNLOCKING: { pose: "unlocking", stateIndex: "5", label: "mechanism unlock", progress: "1.000" },
  UNLOCKED: { pose: "unlocked", stateIndex: "6", label: "chamber expansion", progress: "1.000" },
  COMPLETE: { pose: "complete", stateIndex: "7", label: "complete", progress: "1.000" },
} as const satisfies Readonly<
  Record<AuthoritativeFinaleState, Readonly<{ pose: string; stateIndex: string; label: string; progress: string }>>
>;

type ApiRequestIdentity = Readonly<{ method: string; pathname: string }>;
type AllowedReadOnlyMethod = "GET" | "POST";

type ReadOnlyNetworkGuard = Readonly<{
  allowInterceptedRequest(method: AllowedReadOnlyMethod, pathname: string): void;
  recordIntercept(request: Request): void;
  assertComplete(): void;
  dispose(): void;
}>;

function requestIdentity(request: Request): ApiRequestIdentity {
  return Object.freeze({
    method: request.method().toUpperCase(),
    pathname: new URL(request.url()).pathname,
  });
}

function requestIdentityKey(identity: ApiRequestIdentity) {
  return `${identity.method} ${identity.pathname}`;
}

function installReadOnlyNetworkGuard(context: BrowserContext): ReadOnlyNetworkGuard {
  const allowedInterceptedRequests = new Set<string>();
  const observedUnsafe: ApiRequestIdentity[] = [];
  const interceptedUnsafe: ApiRequestIdentity[] = [];
  const unexpectedUnsafe: ApiRequestIdentity[] = [];
  const listener = (request: Request) => {
    const identity = requestIdentity(request);
    if (!identity.pathname.startsWith("/api/") || identity.method === "GET" || identity.method === "HEAD") return;
    observedUnsafe.push(identity);
    if (!allowedInterceptedRequests.has(requestIdentityKey(identity))) unexpectedUnsafe.push(identity);
  };
  context.on("request", listener);
  return Object.freeze({
    allowInterceptedRequest(method, pathname) {
      expect(pathname).toMatch(/^\/api\/player\/[^/]+\/(?:events|presence|viewed)$/u);
      allowedInterceptedRequests.add(requestIdentityKey({ method, pathname }));
    },
    recordIntercept(request) {
      const identity = requestIdentity(request);
      expect(
        allowedInterceptedRequests.has(requestIdentityKey(identity)),
        `Unregistered local intercept identity: ${requestIdentityKey(identity)}`,
      ).toBe(true);
      if (identity.method !== "GET" && identity.method !== "HEAD") interceptedUnsafe.push(identity);
    },
    assertComplete() {
      expect(unexpectedUnsafe, "WebKit issued an unexpected unsafe API request.").toEqual([]);
      expect(
        interceptedUnsafe.map(requestIdentityKey).sort(),
        "Every unsafe WebKit API request must be satisfied by the exact local presence/viewed intercept.",
      ).toEqual(observedUnsafe.map(requestIdentityKey).sort());
    },
    dispose() {
      context.off("request", listener);
    },
  });
}

function safeSegment(value: string) {
  const result = value
    .normalize("NFKD")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  if (!result) throw new Error("A visual checkpoint path segment was empty after sanitization.");
  return result;
}

function artifactPath(root: string, project: string, checkpoint: VisualCheckpoint) {
  const filename = `${String(checkpoint.ordinal).padStart(2, "0")}-${safeSegment(checkpoint.label)}.png`;
  const resolvedRoot = path.resolve(root);
  const output = path.resolve(
    resolvedRoot,
    "phase3",
    "checkpoints",
    safeSegment(project),
    checkpoint.viewport,
    checkpoint.mode,
    checkpoint.caseId,
    filename,
  );
  const relative = path.relative(resolvedRoot, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("A visual checkpoint escaped VALIDATION_ARTIFACTS.");
  }
  return output;
}

function sanitizedSignal(signal: CheckpointSignal) {
  switch (signal.kind) {
    case "director":
      return { type: signal.kind, state: safeSegment(`${signal.sceneName}-${signal.label}`), label: signal.label };
    case "journal-phase":
      return { type: signal.kind, state: safeSegment(signal.phase) };
    case "finale-pose":
      return { type: signal.kind, state: safeSegment(signal.pose) };
    default:
      return { type: signal.kind, state: safeSegment(signal.kind) };
  }
}

async function assertIndexCorrespondence() {
  const source = await readFile(
    path.resolve("Development_Docs", "Project_Lanternwake_Phase_3_Visual_Checkpoint_Index.md"),
    "utf8",
  );
  const rows = source
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*[^-]/u.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => /^VCP-(?:JRN|CHP|MAP|ART|QST|LOG|FIN)-\d{2}$/u.test(cells[2] ?? ""))
    .map(([label, event, caseId, section, mode, viewport, browser]) => ({
      label,
      event,
      caseId,
      section,
      mode,
      viewport,
      browser,
    }));
  expect(rows).toHaveLength(57);
  expect(rows).toEqual(
    checkpoints.map(({ label, event, caseId, section, mode, viewport, browser }) => ({
      label,
      event,
      caseId,
      section,
      mode,
      viewport,
      browser,
    })),
  );
}

function flowKey(checkpoint: VisualCheckpoint) {
  return (
    checkpoint.group ??
    [
      checkpoint.event,
      checkpoint.section,
      checkpoint.mode,
      checkpoint.viewport,
      checkpoint.browser,
      checkpoint.forceFallback ? "fallback" : "standard",
      checkpoint.authoritativeFinaleState ?? "",
      checkpoint.signal.kind === "finale-pose" ? checkpoint.signal.pose : "",
    ].join(":")
  );
}

async function captureEvidence(
  page: Page,
  selected: readonly VisualCheckpoint[],
  artifactRoot: string,
  testInfo: TestInfo,
  fixture: Phase3CaseFixture,
  eventId: string | null,
  captured: Set<string>,
) {
  for (const checkpoint of selected) {
    expect(checkpoint.caseId).toMatch(/^VCP-(?:JRN|CHP|MAP|ART|QST|LOG|FIN)-\d{2}$/u);
    expect(captured.has(checkpoint.caseId), `${checkpoint.caseId} was captured more than once.`).toBe(false);
  }
  const image = await page.screenshot({ animations: "allow", caret: "hide", fullPage: false, type: "png" });
  const imageHash = createHash("sha256").update(image).digest("hex");
  const capturedAtUtc = new Date().toISOString();
  const runId =
    process.env.FOREVER_VALIDATION_RUN_ID ??
    process.env.VALIDATION_RUN_ID ??
    process.env.GITHUB_RUN_ID ??
    process.env.BUILD_BUILDID ??
    process.env.FOREVER_VALIDATION_NONCE_HASH;
  expect(runId, "A harness run identity or validation nonce hash is required for checkpoint evidence.").toMatch(/\S/u);
  expect(runId!.length, "The harness run identity must be bounded before hashing.").toBeLessThanOrEqual(1_024);
  const runIdSha256 = createHash("sha256").update(runId!).digest("hex");
  for (const checkpoint of selected) {
    const output = artifactPath(artifactRoot, testInfo.project.name, checkpoint);
    expect(output).not.toContain(fixture.slug);
    if (eventId) expect(output).not.toContain(eventId);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, image);
    expect((await stat(output)).size).toBeGreaterThan(0);
    const persistedHash = createHash("sha256")
      .update(await readFile(output))
      .digest("hex");
    expect(persistedHash).toBe(imageHash);
    const relativePngPath = path.relative(path.resolve(artifactRoot), output).replaceAll(path.sep, "/");
    expect(relativePngPath).not.toMatch(/(?:\.\.|\\|^\/)/u);
    const sidecar = {
      version: 1,
      caseId: checkpoint.caseId,
      reviewerLabel: checkpoint.label,
      signal: sanitizedSignal(checkpoint.signal),
      relativePngPath,
      sha256: imageHash,
      captureStatus: "captured-unverified",
      browser: checkpoint.browser,
      viewport: checkpoint.viewport,
      motionMode: checkpoint.mode,
      eventType: checkpoint.event,
      ...(checkpoint.authoritativeFinaleState
        ? { authoritativeInterfaceStateFixture: checkpoint.authoritativeFinaleState }
        : {}),
      ...(eventId ? { eventIdSha256: createHash("sha256").update(eventId).digest("hex") } : {}),
      capturedAtUtc,
      runIdSha256,
    } as const;
    const sidecarPath = path.join(path.dirname(output), "checkpoint.json");
    await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
    const parsedSidecar = JSON.parse(await readFile(sidecarPath, "utf8")) as typeof sidecar;
    expect(parsedSidecar).toEqual(sidecar);
    expect(JSON.stringify(sidecar)).not.toContain(fixture.slug);
    if (eventId) expect(JSON.stringify(sidecar)).not.toContain(eventId);
    captured.add(checkpoint.caseId);
  }
}

function assertDetailShape(detail: unknown): asserts detail is AnimationSemanticLabelEventDetail {
  expect(detail).toEqual(
    expect.objectContaining({
      version: 1,
      sceneName: expect.any(String),
      sceneInstanceId: expect.any(String),
      hostId: expect.any(String),
      hostKind: expect.any(String),
      label: expect.any(String),
      elapsedMs: expect.any(Number),
      motionLevel: expect.stringMatching(/^(full|gentle|reduced)$/u),
    }),
  );
}

async function assertAuthoritativeFinaleState(page: Page, state: AuthoritativeFinaleState) {
  const semantics = authoritativeFinaleSemantics[state];
  const chamber = page.locator(
    `section[data-finale-authoritative-state="${state}"][data-finale-pose="${semantics.pose}"][data-finale-semantic-label="${semantics.label}"][data-finale-progress="${semantics.progress}"][data-finale-reduced-equivalent="semantic-final-state"]`,
  );
  await expect(chamber).toHaveCount(1);
  await expect(chamber).toBeVisible();
  await expect(chamber.locator("[data-finale-readable-status]")).toBeVisible();
  const fallback = chamber.locator(
    `[data-finale-fallback="css-svg"][data-finale-state="${semantics.pose}"][data-finale-state-index="${semantics.stateIndex}"][data-finale-semantic-label="${semantics.label}"][data-finale-progress="${semantics.progress}"][data-finale-production-art-status="blocked_external_asset"][data-runtime-boundary="css"]`,
  );
  await expect(fallback).toHaveCount(1);
}

function assertSuccessfulReceipt(checkpoint: VisualCheckpoint, receipt: Phase3ReceiptEvidence, eventId: string) {
  if (checkpoint.event === "opening") throw new Error("Opening checkpoints do not have progression receipts.");
  const expectedMotion = motionForMode[checkpoint.mode];
  const policy = policyForProgressionEvent(checkpoint.event);
  expect(receipt).toMatchObject({
    eventId,
    eventType: checkpoint.event,
    restorationResult: expect.stringMatching(/^(exact-target|destination-control|section-heading|section-only)$/u),
    acknowledgmentEligible: true,
    motionPolicy: {
      level: expectedMotion.resolvedMode,
      source: {
        productSetting: expectedMotion.productMode,
        browserPrefersReduced: expectedMotion.browserReduced,
      },
    },
    scene: {
      sceneName: policy.sceneName,
      hostKind: "player-progression",
      cleanup: expect.stringMatching(/^completed/u),
    },
  });
  expect(receipt.scene).not.toBeNull();
  expect(receipt.targetReport).not.toBeNull();
  if (checkpoint.forceFallback) {
    expect(receipt).toMatchObject({ status: "fallback", fallbackResult: "readable", finalStateResult: "fallback" });
    expect(receipt.targetReport?.requiredSatisfied).toBe(false);
    expect(receipt.targetReport?.failures.length).toBeGreaterThan(0);
    return;
  }
  expect(receipt).toMatchObject({
    status: "presented",
    fallbackResult: "not-used",
    finalStateResult: expect.stringMatching(/^(committed|reconciled)$/u),
  });
  expect(receipt.targetReport).toMatchObject({ requiredSatisfied: true, failures: [] });
  expect(receipt.semanticLabels).toContain("scene-complete");
  expect(receipt.scene!.finalization).toMatchObject({
    finalStateCommitted: true,
    handoffCompleted: true,
    cleanupStarted: true,
    cleanupCompleted: true,
    cleanupResult: expect.stringMatching(/^completed/u),
  });
  for (const observation of receipt.targetReport!.observations.filter((candidate) => candidate.required)) {
    expect(observation).toMatchObject({
      candidateCount: 1,
      matchedCount: 1,
      visibleCount: 1,
      duplicateCount: 0,
      ownershipRejectedCount: 0,
      rejectionCodes: [],
    });
  }
}

async function assertDirectorCheckpointState(
  page: Page,
  checkpoint: VisualCheckpoint,
  fixture: Phase3CaseFixture,
  eventId: string,
) {
  const overlay = page.locator(
    `[data-progression-overlay][data-presentation-id][data-presentation-event="${checkpoint.event}"][data-progression-state="active"]`,
  );
  await expect(overlay).toHaveCount(1);
  await expect(overlay.locator('[data-presentation-relevance="relevant"]')).not.toHaveCount(0);
  if (checkpoint.event === "MAP_LOCATION_REVEALED" && checkpoint.section === "chart") {
    await expect(page.locator(`[data-location-key="${fixture.mapLocationKey}"]`)).toHaveCount(1);
  }
  if (checkpoint.event === "MAP_ROUTE_REVEALED" && checkpoint.section === "chart") {
    await expect(page.locator(`[data-route-key="${fixture.mapRouteKey}"]`)).toHaveCount(1);
  }
  if (checkpoint.event.startsWith("ARTIFACT_") && checkpoint.section === "treasures") {
    await expect(
      page.locator(`[data-artifact-target-role="layout-source"][data-artifact-key="${fixture.artifactKey}"]`),
    ).toHaveCount(1);
  }
  if (checkpoint.event.startsWith("SIDE_QUEST_") && checkpoint.section === "quests") {
    await expect(page.locator(`[data-quest-key="${fixture.sideQuestKey}"]`).first()).toBeAttached();
  }
  if (checkpoint.event === "PLAYER_LOG_ENTRY_ADDED" && checkpoint.section === "log") {
    await expect(page.locator(`[data-log-entry-key="${eventId}"]`)).toHaveCount(1);
  }
  if (checkpoint.event.startsWith("FINALE_") && checkpoint.section === "finale") {
    await expect(page.locator("[data-finale-readable-status]")).toBeVisible();
    if (checkpoint.authoritativeFinaleState) {
      await assertAuthoritativeFinaleState(page, checkpoint.authoritativeFinaleState);
    }
  }
}

async function installDirectorCapture(
  page: Page,
  selected: readonly VisualCheckpoint[],
  fixture: Phase3CaseFixture,
  eventId: string,
  artifactRoot: string,
  testInfo: TestInfo,
  captured: Set<string>,
) {
  const directorCheckpoints = selected.filter(
    (checkpoint): checkpoint is VisualCheckpoint & { signal: Extract<CheckpointSignal, { kind: "director" }> } =>
      checkpoint.signal.kind === "director",
  );
  if (!directorCheckpoints.length) return { wait: async () => undefined };

  const bindingName = `__phase3VisualCheckpoint_${safeSegment(selected[0]!.caseId)}`;
  const occurrences = new Map<string, number>();
  const pending = new Set(directorCheckpoints.map((checkpoint) => checkpoint.caseId));
  let resolveComplete!: () => void;
  let rejectComplete!: (error: unknown) => void;
  const completion = new Promise<void>((resolve, reject) => {
    resolveComplete = resolve;
    rejectComplete = reject;
  });

  await page.exposeBinding(bindingName, async ({ page: sourcePage }, rawDetail: unknown) => {
    try {
      assertDetailShape(rawDetail);
      if (rawDetail.eventOrActionId !== eventId) return;
      expect(rawDetail.hostKind).toBe("player-progression");
      expect(rawDetail.requestSource).toMatch(/^(automatic|replay)$/u);
      expect(rawDetail.motionLevel).toBe(motionForMode[selected[0]!.mode].resolvedMode);
      const occurrenceKey = `${rawDetail.sceneName}\u0000${rawDetail.label}`;
      const count = (occurrences.get(occurrenceKey) ?? 0) + 1;
      occurrences.set(occurrenceKey, count);
      const matches = directorCheckpoints.filter(
        (checkpoint) =>
          pending.has(checkpoint.caseId) &&
          checkpoint.signal.sceneName === rawDetail.sceneName &&
          checkpoint.signal.label === rawDetail.label &&
          (checkpoint.signal.occurrence ?? 1) === count,
      );
      if (!matches.length) return;
      for (const checkpoint of matches) {
        expect(rawDetail.sceneName).toBe(checkpoint.signal.sceneName);
        expect(rawDetail.label).toBe(checkpoint.signal.label);
        expect(rawDetail.eventOrActionId).toBe(eventId);
        await assertDirectorCheckpointState(sourcePage, checkpoint, fixture, eventId);
      }
      await captureEvidence(sourcePage, matches, artifactRoot, testInfo, fixture, eventId, captured);
      matches.forEach((checkpoint) => pending.delete(checkpoint.caseId));
      if (!pending.size) resolveComplete();
    } catch (error) {
      rejectComplete(error);
    }
  });
  await page.addInitScript(
    ({ browserEventName, exposedBinding }) => {
      window.addEventListener(browserEventName, (event) => {
        const call = (window as unknown as Record<string, (detail: unknown) => Promise<void>>)[exposedBinding];
        if (typeof call === "function") void call((event as CustomEvent).detail);
      });
    },
    { browserEventName: ANIMATION_SEMANTIC_LABEL_EVENT_NAME, exposedBinding: bindingName },
  );

  return {
    async wait() {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          completion,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("A required Director semantic checkpoint was not observed.")),
              30_000,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      expect([...pending]).toEqual([]);
    },
  };
}

async function installReadOnlyAccess(
  page: Page,
  fixture: Phase3CaseFixture,
  eventId: string | null,
  baseURL: string,
  networkGuard?: ReadOnlyNetworkGuard,
) {
  await installPhase3EvidenceProbe(page);
  await page.addInitScript(({ deviceId }) => localStorage.setItem("forever-device", deviceId), fixture);
  await page.context().addCookies([
    {
      name: "forever_player",
      value: fixture.playerAccessId,
      url: baseURL,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const eventsPath = `/api/player/${fixture.slug}/events`;
  const presencePath = `/api/player/${fixture.slug}/presence`;
  const viewedPath = `/api/player/${fixture.slug}/viewed`;
  networkGuard?.allowInterceptedRequest("GET", eventsPath);
  networkGuard?.allowInterceptedRequest("POST", presencePath);
  networkGuard?.allowInterceptedRequest("GET", viewedPath);
  networkGuard?.allowInterceptedRequest("POST", viewedPath);
  await page.route(`**${eventsPath}**`, (route) => {
    expect(route.request().method()).toBe("GET");
    networkGuard?.recordIntercept(route.request());
    return route.abort("blockedbyclient");
  });
  await page.route(`**${presencePath}`, (route) => {
    expect(route.request().method()).toBe("POST");
    networkGuard?.recordIntercept(route.request());
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route(`**/api/player/${fixture.slug}/viewed**`, async (route) => {
    networkGuard?.recordIntercept(route.request());
    if (route.request().method() === "GET") {
      const requested = new URL(route.request().url()).searchParams.getAll("eventIds");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ acknowledgedEventIds: requested.filter((id) => id !== eventId) }),
      });
      return;
    }
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function enterJournal(page: Page, allowSkip: boolean) {
  const open = page.getByRole("button", { name: "Open the journal" });
  await expect(open).toBeVisible();
  await open.click();
  if (allowSkip) {
    const skip = page.getByRole("button", { name: "Skip ceremony" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }
  await expect(page.locator("[data-player-experience-root]")).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
}

async function runOpeningFlow(
  context: BrowserContext,
  selected: readonly VisualCheckpoint[],
  artifactRoot: string,
  testInfo: TestInfo,
  captured: Set<string>,
  networkGuard?: ReadOnlyNetworkGuard,
) {
  const page = await context.newPage();
  const fixture = readPreseededPhase3BaseFixture();
  const checkpoint = selected[0]!;
  try {
    await page.setViewportSize(viewportSizes[checkpoint.viewport]);
    await setPhase3Motion(page, motionForMode[checkpoint.mode]);
    await installReadOnlyAccess(page, fixture, null, testInfo.project.use.baseURL as string, networkGuard);
    await page.goto(`${fixture.path}?section=journal`);
    const root = page.locator("[data-player-experience-root]");
    await expect(root).toHaveAttribute("data-journal-phase", "ENTRY_IDLE");

    const phaseGroups = new Map<string, VisualCheckpoint[]>();
    for (const item of selected) {
      const key = item.signal.kind === "journal-phase" ? `phase:${item.signal.phase}` : item.signal.kind;
      phaseGroups.set(key, [...(phaseGroups.get(key) ?? []), item]);
    }
    const watchers = [...phaseGroups.values()].map(async (items) => {
      const signal = items[0]!.signal;
      if (signal.kind === "journal-phase") {
        await expect(root).toHaveAttribute("data-journal-phase", signal.phase, { timeout: 20_000 });
        for (const item of items) {
          if (item.signal.kind !== "journal-phase" || !item.signal.actor) continue;
          const actor = page.locator(`[data-opening-actor="${item.signal.actor}"]`).first();
          await expect(actor).toBeAttached();
          if (signal.phase === "JOURNAL_READY") {
            await expect(actor).toHaveAttribute("aria-hidden", "false");
            await expect(actor).not.toHaveAttribute("inert", "");
          }
        }
      } else if (signal.kind === "pageflip-readiness") {
        const pageFlip = page.locator(".page-flip-book").first();
        await expect
          .poll(
            async () =>
              pageFlip.evaluate((root) => {
                if (!(root instanceof HTMLElement) || root.dataset.flipState !== "read") return false;
                const runtime = root.querySelector<HTMLElement>(
                  '.page-flip-runtime[data-pageflip-runtime-claim="granted"][data-pageflip-turn-owner="st-page-flip"]',
                );
                const primary = root.querySelector<HTMLElement>(
                  '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
                );
                if (runtime && primary) return true;
                const fallback = root.dataset.pageflipStatus;
                return (
                  (fallback === "fallback" || fallback === "reduced") &&
                  Boolean(root.querySelector<HTMLElement>(".reduced-page-stage > [data-page-index]"))
                );
              }),
            { message: "PageFlip did not expose an exact full-runtime or static readable authority.", timeout: 20_000 },
          )
          .toBe(true);
        const fullRuntime = pageFlip.locator(
          '.page-flip-runtime[data-pageflip-runtime-claim="granted"][data-pageflip-turn-owner="st-page-flip"]',
        );
        if (await fullRuntime.count()) {
          await expect(fullRuntime).toHaveCount(1);
          await expect(
            pageFlip.locator(
              '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
            ),
          ).toHaveCount(1);
        } else {
          await expect(pageFlip).toHaveAttribute("data-pageflip-status", /^(fallback|reduced)$/u);
          await expect(pageFlip.locator(".reduced-page-stage > [data-page-index]").first()).toBeVisible();
        }
      } else {
        throw new Error("Opening flow received a non-opening semantic signal.");
      }
      await captureEvidence(page, items, artifactRoot, testInfo, fixture, null, captured);
    });
    await enterJournal(page, false);
    await Promise.all(watchers);
  } finally {
    await page.close();
  }
}

async function installForcedChapterFallback(page: Page) {
  await page.addInitScript(() => {
    const install = () => {
      if (!document.head || document.querySelector("style[data-phase3-visual-fallback]")) return;
      const style = document.createElement("style");
      style.dataset.phase3VisualFallback = "true";
      style.textContent =
        '[data-progression-overlay][data-presentation-event="CHAPTER_RELEASED"] [data-scene-part="sealed-parchment"]{display:none!important}';
      document.head.append(style);
    };
    install();
    new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function captureSettledCheckpoints(
  page: Page,
  items: readonly VisualCheckpoint[],
  fixture: Phase3CaseFixture,
  eventId: string,
  receipt: Phase3ReceiptEvidence,
  artifactRoot: string,
  testInfo: TestInfo,
  captured: Set<string>,
) {
  const forcedFallback = items.some((checkpoint) => checkpoint.forceFallback);
  for (const checkpoint of items) {
    expect(checkpoint.signal.kind).toBe("settled");
    const expectedStatus = checkpoint.signal.kind === "settled" ? checkpoint.signal.expectedStatus : undefined;
    if (forcedFallback) {
      expect(checkpoint.forceFallback).toBe(true);
      expect(expectedStatus).toBe("fallback");
    } else {
      expect(expectedStatus).toBeUndefined();
    }
  }
  expect(receipt).toMatchObject(
    forcedFallback
      ? { status: "fallback", fallbackResult: "readable", finalStateResult: "fallback" }
      : {
          status: "presented",
          fallbackResult: "not-used",
          finalStateResult: expect.stringMatching(/^(committed|reconciled)$/u),
        },
  );
  const notice = page.locator(`[data-progress-event-id="${eventId}"][data-progress-event-type="${items[0]!.event}"]`);
  await expect(notice).toBeVisible();
  await expect(page.locator(`[data-progress-event-id="${eventId}"]`)).toHaveCount(1);
  if (items.some((item) => item.caseId === "VCP-CHP-12")) {
    await expect(notice.getByRole("group", { name: "Voyage update actions" })).toBeVisible();
    await expect(notice.getByRole("button", { name: "Replay presentation" })).toBeEnabled();
  }
  if (items[0]!.event === "SIDE_QUEST_COMPLETED") {
    await expect(page.locator(`[data-quest-key="${fixture.sideQuestKey}"]`).first()).toBeAttached();
  }
  if (items[0]!.event === "PLAYER_LOG_ENTRY_ADDED") {
    await expect(page.locator(`[data-log-entry-key="${eventId}"]`)).toHaveCount(1);
  }
  await captureEvidence(page, items, artifactRoot, testInfo, fixture, eventId, captured);
}

async function captureArtifactCheckpoints(
  page: Page,
  items: readonly VisualCheckpoint[],
  fixture: Phase3CaseFixture,
  eventId: string,
  artifactRoot: string,
  testInfo: TestInfo,
  captured: Set<string>,
) {
  await expect(
    page.locator(`[data-progress-event-id="${eventId}"][data-progress-event-type="ARTIFACT_AWARDED"]`),
  ).toBeVisible();
  const trigger = page.locator(
    `[data-artifact-target-role="layout-source"][data-artifact-key="${fixture.artifactKey}"]`,
  );
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-artifact-inspection-state", "readable");
  await expect(dialog.getByRole("button", { name: "Close inspection" })).toBeFocused();

  const opened = items.filter((item) => item.signal.kind === "artifact-dialog-open");
  if (opened.length) await captureEvidence(page, opened, artifactRoot, testInfo, fixture, eventId, captured);

  const engraving = items.filter((item) => item.signal.kind === "artifact-engraving");
  if (engraving.length) {
    const target = dialog.locator(
      `[data-artifact-target-role="engraving"][data-artifact-key="${fixture.artifactKey}"]`,
    );
    await expect(target).toBeVisible();
    await expect(dialog.locator('[data-static-readable="true"]')).toBeVisible();
    await captureEvidence(page, engraving, artifactRoot, testInfo, fixture, eventId, captured);
  }

  const returned = items.filter((item) => item.signal.kind === "artifact-return");
  if (returned.length) {
    await dialog.getByRole("button", { name: "Close inspection" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await captureEvidence(page, returned, artifactRoot, testInfo, fixture, eventId, captured);
  } else {
    await dialog.getByRole("button", { name: "Close inspection" }).click();
    await expect(dialog).toHaveCount(0);
  }
}

type FinaleRequirementFixture = Readonly<{
  key: string;
  label: string;
  current: number;
  target: number;
  optional?: boolean;
  [field: string]: unknown;
}>;

function parseFinaleRequirementFixtures(value: string): readonly FinaleRequirementFixture[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("The isolated Finale fixture has no authoritative requirement array.");
  }
  return parsed.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("An isolated Finale requirement is not an object.");
    }
    const requirement = candidate as Record<string, unknown>;
    if (
      typeof requirement.key !== "string" ||
      !requirement.key ||
      typeof requirement.label !== "string" ||
      !requirement.label ||
      !Number.isInteger(requirement.current) ||
      !Number.isInteger(requirement.target) ||
      (requirement.target as number) < 0
    ) {
      throw new Error("An isolated Finale requirement is missing its bounded interface fields.");
    }
    return Object.freeze({ ...requirement }) as FinaleRequirementFixture;
  });
}

async function installAuthoritativeFinaleInterfaceState(
  page: Page,
  fixture: Phase3CaseFixture,
  state: AuthoritativeFinaleState,
) {
  await provePhase3MutationIsolation(page);
  const baselineTruth = await capturePhase3DbTruth(fixture);
  const before = await db.campaign.findUniqueOrThrow({
    where: { id: fixture.campaignId },
    select: { id: true, slug: true, finaleState: true, finaleRequirements: true },
  });
  expect(before.slug).toBe(fixture.slug);
  const requirements = parseFinaleRequirementFixtures(before.finaleRequirements);
  expect(requirements.some((requirement) => requirement.key === fixture.finaleRequirementKey)).toBe(true);
  const currentFor = (requirement: FinaleRequirementFixture) => (state === "DORMANT" ? 0 : requirement.target);
  const installedRequirements = JSON.stringify(
    requirements.map((requirement) => ({ ...requirement, current: currentFor(requirement) })),
  );
  const installed = await db.campaign.updateMany({
    where: {
      id: before.id,
      slug: before.slug,
      finaleState: before.finaleState,
      finaleRequirements: before.finaleRequirements,
    },
    data: { finaleState: state, finaleRequirements: installedRequirements },
  });
  expect(installed.count, "The authoritative Finale interface fixture update must affect exactly one copied row.").toBe(
    1,
  );
  let restored = false;
  return Object.freeze({
    async restore() {
      if (restored) throw new Error("The authoritative Finale interface fixture was restored twice.");
      const result = await db.campaign.updateMany({
        where: {
          id: before.id,
          slug: before.slug,
          finaleState: state,
          finaleRequirements: installedRequirements,
        },
        data: { finaleState: before.finaleState, finaleRequirements: before.finaleRequirements },
      });
      expect(result.count, "Finale interface-state restoration must match the exact installed copied row.").toBe(1);
      expect(
        await db.campaign.findUniqueOrThrow({
          where: { id: before.id },
          select: { id: true, slug: true, finaleState: true, finaleRequirements: true },
        }),
      ).toEqual(before);
      expect(await capturePhase3DbTruth(fixture)).toEqual(baselineTruth);
      restored = true;
    },
  });
}

async function captureFinalePoseCheckpoints(
  page: Page,
  items: readonly VisualCheckpoint[],
  fixture: Phase3CaseFixture,
  eventId: string,
  artifactRoot: string,
  testInfo: TestInfo,
  captured: Set<string>,
) {
  await expect(
    page.locator(`[data-progress-event-id="${eventId}"][data-progress-event-type="${items[0]!.event}"]`),
  ).toBeVisible();
  for (const checkpoint of items) {
    if (checkpoint.signal.kind !== "finale-pose") continue;
    if (!checkpoint.authoritativeFinaleState) {
      throw new Error(`${checkpoint.caseId} lacks its explicit authoritative Finale interface state.`);
    }
    const semantics = authoritativeFinaleSemantics[checkpoint.authoritativeFinaleState];
    expect(checkpoint.signal.pose).toBe(semantics.pose);
    await assertAuthoritativeFinaleState(page, checkpoint.authoritativeFinaleState);
    const chamber = page.locator(`[data-finale-authoritative-state="${checkpoint.authoritativeFinaleState}"]`);
    await expect(chamber.locator("[data-rive-semantic-signals='state,progress']")).toHaveCount(1);
    await captureEvidence(page, [checkpoint], artifactRoot, testInfo, fixture, eventId, captured);
  }
}

async function runEventFlow(
  context: BrowserContext,
  selected: readonly VisualCheckpoint[],
  artifactRoot: string,
  testInfo: TestInfo,
  captured: Set<string>,
  networkGuard?: ReadOnlyNetworkGuard,
) {
  const checkpoint = selected[0]!;
  if (checkpoint.event === "opening") throw new Error("An opening checkpoint entered the event flow.");
  const page = await context.newPage();
  let finaleInterfaceFixture: Readonly<{ restore(): Promise<void> }> | null = null;
  try {
    await page.setViewportSize(viewportSizes[checkpoint.viewport]);
    await setPhase3Motion(page, motionForMode[checkpoint.mode]);
    if (selected.some((item) => item.forceFallback)) await installForcedChapterFallback(page);

    const fixture = readPreseededPhase3FixtureFromEnv(checkpoint.event);
    expect(fixture.prerequisiteEventId).toMatch(/\S/u);
    const eventId = fixture.prerequisiteEventId!;
    await installReadOnlyAccess(page, fixture, eventId, testInfo.project.use.baseURL as string, networkGuard);

    const authoritativeStates = [
      ...new Set(selected.flatMap((item) => (item.authoritativeFinaleState ? [item.authoritativeFinaleState] : []))),
    ];
    expect(authoritativeStates.length).toBeLessThanOrEqual(1);
    const authoritativeState = authoritativeStates[0];
    if (authoritativeState) {
      expect(checkpoint.browser).toBe("Chromium");
      expect(checkpoint.event.startsWith("FINALE_")).toBe(true);
      finaleInterfaceFixture = await installAuthoritativeFinaleInterfaceState(page, fixture, authoritativeState);
    }

    const capture = await installDirectorCapture(page, selected, fixture, eventId, artifactRoot, testInfo, captured);
    await page.goto(`${fixture.path}?section=${checkpoint.section}`);
    await enterJournal(page, true);

    const receipt = await waitForPhase3Receipt(page, eventId);
    assertSuccessfulReceipt(checkpoint, receipt, eventId);
    await capture.wait();

    const settled = selected.filter((item) => item.signal.kind === "settled");
    if (settled.length) {
      await captureSettledCheckpoints(page, settled, fixture, eventId, receipt, artifactRoot, testInfo, captured);
    }
    const artifact = selected.filter((item) => item.signal.kind.startsWith("artifact-"));
    if (artifact.length) {
      await captureArtifactCheckpoints(page, artifact, fixture, eventId, artifactRoot, testInfo, captured);
    }
    const finale = selected.filter((item) => item.signal.kind === "finale-pose");
    if (finale.length) {
      await captureFinalePoseCheckpoints(page, finale, fixture, eventId, artifactRoot, testInfo, captured);
    }
  } finally {
    try {
      await page.close();
    } finally {
      await finaleInterfaceFixture?.restore();
    }
  }
}

test("captures the exact sanitized 57-row Phase 3 visual checkpoint catalog", async ({
  context,
  browserName,
}, testInfo) => {
  test.setTimeout(900_000);
  const artifactRoot = process.env.VALIDATION_ARTIFACTS;
  expect(artifactRoot, "VALIDATION_ARTIFACTS is required for Phase 3 visual evidence.").toBeTruthy();
  expect(process.env.FOREVER_VALIDATION_ISOLATION).toBe("1");
  expect(process.env.FOREVER_VALIDATION_NONCE_HASH).toMatch(/^[a-f0-9]{64}$/u);
  await assertIndexCorrespondence();

  expect(checkpoints).toHaveLength(57);
  expect(new Set(checkpoints.map((checkpoint) => checkpoint.caseId)).size).toBe(57);
  expect(checkpoints.map((checkpoint) => checkpoint.ordinal)).toEqual(
    Array.from({ length: 57 }, (_, index) => index + 1),
  );
  for (const eventType of new Set(
    checkpoints.flatMap((checkpoint) => (checkpoint.event === "opening" ? [] : [checkpoint.event])),
  )) {
    const fixture = readPreseededPhase3FixtureFromEnv(eventType);
    expect(fixture.prerequisiteEventId, `${eventType} requires an exact preseeded event identity.`).toMatch(/\S/u);
  }
  expect(["chromium", "webkit"]).toContain(browserName);
  const expectedBrowser: IndexedBrowser = browserName === "chromium" ? "Chromium" : "WebKit";
  const selected = checkpoints.filter((checkpoint) => checkpoint.browser === expectedBrowser);
  expect(selected.length).toBeGreaterThan(0);
  const outputs = selected.map((checkpoint) => artifactPath(artifactRoot!, testInfo.project.name, checkpoint));
  expect(new Set(outputs).size).toBe(selected.length);
  const sidecars = outputs.map((output) => path.join(path.dirname(output), "checkpoint.json"));
  expect(sidecars).toHaveLength(selected.length);
  expect(new Set(sidecars).size).toBe(selected.length);

  const groups = new Map<string, VisualCheckpoint[]>();
  for (const checkpoint of selected) {
    const key = flowKey(checkpoint);
    groups.set(key, [...(groups.get(key) ?? []), checkpoint]);
  }
  const captured = new Set<string>();
  const networkGuard = expectedBrowser === "WebKit" ? installReadOnlyNetworkGuard(context) : undefined;
  try {
    for (const group of groups.values()) {
      const first = group[0]!;
      expect(group.every((checkpoint) => checkpoint.browser === first.browser)).toBe(true);
      expect(group.every((checkpoint) => checkpoint.viewport === first.viewport)).toBe(true);
      expect(group.every((checkpoint) => checkpoint.mode === first.mode)).toBe(true);
      expect(group.every((checkpoint) => checkpoint.event === first.event)).toBe(true);
      expect(group.every((checkpoint) => checkpoint.section === first.section)).toBe(true);
      const fixture =
        first.event === "opening" ? readPreseededPhase3BaseFixture() : readPreseededPhase3FixtureFromEnv(first.event);
      const before = networkGuard ? await capturePhase3DbTruth(fixture) : null;
      try {
        if (first.event === "opening") {
          await runOpeningFlow(context, group, artifactRoot!, testInfo, captured, networkGuard);
        } else {
          await runEventFlow(context, group, artifactRoot!, testInfo, captured, networkGuard);
        }
      } finally {
        if (before) {
          expect(
            await capturePhase3DbTruth(fixture),
            `WebKit visual flow ${first.caseId} must preserve exact preseeded database truth.`,
          ).toEqual(before);
        }
      }
    }
    expect([...captured].sort()).toEqual(selected.map((checkpoint) => checkpoint.caseId).sort());
    for (const [index, output] of outputs.entries()) {
      const checkpoint = selected[index]!;
      const sidecar = JSON.parse(await readFile(sidecars[index]!, "utf8")) as Record<string, unknown>;
      const persistedImage = await readFile(output);
      expect(sidecar.caseId).toBe(checkpoint.caseId);
      expect(sidecar.captureStatus).toBe("captured-unverified");
      expect(sidecar.runIdSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(sidecar.relativePngPath).toBe(
        path.relative(path.resolve(artifactRoot!), output).replaceAll(path.sep, "/"),
      );
      expect(sidecar.sha256).toBe(createHash("sha256").update(persistedImage).digest("hex"));
    }
  } finally {
    networkGuard?.assertComplete();
    networkGuard?.dispose();
  }
});
