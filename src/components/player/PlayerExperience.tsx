"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { AnimatedProperty, JournalPhaseOutcome, PresentationReceipt } from "@/animation/core/animation-types";
import { AudioCuePlayer, type AudioCueName } from "@/animation/core/audio-cues";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { sceneContracts } from "@/animation/director/scene-registry";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { ExternalSceneTargetHandle, SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import { sectionVariants } from "@/animation/motion/variants";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import {
  isJournalInteractive,
  waitForJournalPhase,
  type JournalOpeningPhase,
} from "@/animation/journal/opening-machine";
import type { ClientProgressEvent, PublicSnapshot, ReplayablePresentation } from "@/domain/story";
import type { RiveRuntimeStatus } from "@/components/animation/RiveStatefulObject";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";
import {
  journalPhaseDisposition,
  receiptValidatesAudio,
  shouldSuppressChapterViewed,
  toChapterReleaseClientEvent,
} from "./presentation-policy";
import { ArtifactInspection, type ArtifactInspectionTargetHandles } from "./workspace/ArtifactInspection";
import { CompanionHeader, type CompanionHeaderDimTargetRegistration } from "./workspace/CompanionHeader";
import {
  CompanionNavigation,
  MobileNavigation,
  type CompanionNavigationDimTargetRegistration,
} from "./workspace/CompanionNavigation";
import {
  FinaleChamber,
  type FinaleChamberTargetRegistration,
  type FinaleMechanismTargetReady,
} from "./workspace/FinaleChamber";
import {
  JournalWorkspace,
  type JournalAnnotationTargetReady,
  type JournalCeremonyTargetReady,
} from "./workspace/JournalWorkspace";
import { ObjectiveNote } from "./workspace/ObjectiveNote";
import { ShipsLog, type ShipsLogTargetRegistration } from "./workspace/ShipsLog";
import { SideQuestLedger, type SideQuestLocalTargetReady } from "./workspace/SideQuestLedger";
import {
  TreasureAltar,
  type TreasureAltarArtifactTargetHandles,
  type TreasureAltarConnectionTargetHandle,
} from "./workspace/TreasureAltar";
import { companionViews, type CompanionView } from "./workspace/types";
import { VoyageChart, type VoyageChartTargetRegistration } from "./workspace/VoyageChart";
import {
  ProgressionPresentationController,
  type ProgressionPresentationControllerSnapshot,
  type ProgressionPresentationExecution,
} from "./progression/ProgressionPresentationController";
import {
  type PlayerSectionRestoration,
  type PlayerSectionRestorationResult,
  type PlayerSectionId,
  type ProgressionPresentationReceipt,
  type ProgressionPresentationRequest,
} from "./progression/contracts";
import { isPhase3PlayerProgressEventType, policyForProgressionEvent } from "./progression/event-policy";
import { ProgressionSceneHost } from "./progression/ProgressionSceneHost";
const JOURNAL_OPENING_HOST_KEY = "player-journal-opening";
const MAX_PRESENTATION_HISTORY_ENTRIES = 50;
export const progressionReceiptEventName = "forever:progression-receipt" as const;
export const progressionStateEventName = "forever:progression-state" as const;

type BrowserLocalEnhancementEvidence = Readonly<{
  expected: boolean;
  section: PlayerSectionId | null;
  status: "ran" | "unavailable" | "not-applicable";
  targetKeys: readonly string[];
}>;

type BrowserIntegrationEvidence = Readonly<{
  currentSection: PlayerSectionId;
  returnSection: PlayerSectionId;
  localEnhancement: BrowserLocalEnhancementEvidence;
}>;

type PresentationHistoryEntry = Readonly<{
  eventId: string;
  eventType: ProgressionPresentationRequest["eventType"];
  eventSequence: number;
}>;

type ChapterSolvedLocalTargetReady = Readonly<{
  eventId: string;
  host: SceneHostHandle;
  target: SceneTargetHandle;
}>;

export type ProgressionStateEventDetail = Readonly<{
  version: 1;
  transition: "queue" | "settled" | "access-revoked";
  eventId: string | null;
  requestId: string | null;
  acknowledged: boolean;
  acknowledgmentAttempted: boolean;
  cursors: ProgressionPresentationControllerSnapshot["cursors"];
  queue: Readonly<{ activeRequestId: string | null; pendingCount: number }>;
}>;

export type ProgressionReceiptEventDetail = Readonly<{
  version: 1;
  requestId: string;
  eventId: string;
  eventType: string;
  eventSequence: number;
  source: string;
  playbackIdentity: string;
  status: string;
  sceneName: string;
  queueWaitMs: number;
  acknowledgmentEligible: boolean;
  acknowledgmentAttempted: boolean;
  acknowledged: boolean;
  cursors: ProgressionPresentationControllerSnapshot["cursors"];
  fallbackResult: string;
  finalStateResult: string;
  restorationResult: string;
  semanticLabels: readonly string[];
  currentSection: PlayerSectionId;
  returnSection: PlayerSectionId;
  motionPolicyLevel: string | null;
  motionPolicySource: Readonly<{ productSetting: string; browserPrefersReduced: boolean }> | null;
  motionPolicy: Readonly<{
    level: string | null;
    source: Readonly<{ productSetting: string; browserPrefersReduced: boolean }> | null;
  }>;
  scene: Readonly<{
    sceneName: string;
    sceneInstanceId: string;
    hostId: string;
    hostKind: string;
    outcome: string;
    requestSource: string;
    durationMs: number;
    cleanup: string;
    finalization: PresentationReceipt["finalization"] | null;
  }> | null;
  targetReport: Readonly<{
    requiredSatisfied: boolean;
    durationMs: number;
    failures: readonly Readonly<{ part: string; code: string }>[];
    observations: readonly Readonly<{
      targetKey: string | null;
      part: string;
      required: boolean;
      candidateCount: number;
      matchedCount: number;
      visibleCount: number;
      duplicateCount: number;
      ownershipRejectedCount: number;
      acceptedTargetIds: readonly string[];
      rejectionCodes: readonly string[];
      resolutionDetail: "unavailable-in-director-receipt";
    }>[];
  }> | null;
  localEnhancement: BrowserLocalEnhancementEvidence;
}>;

function dispatchProgressionEvidence(
  name: typeof progressionReceiptEventName,
  detail: ProgressionReceiptEventDetail,
): void;
function dispatchProgressionEvidence(name: typeof progressionStateEventName, detail: ProgressionStateEventDetail): void;
function dispatchProgressionEvidence(
  name: typeof progressionReceiptEventName | typeof progressionStateEventName,
  detail: ProgressionReceiptEventDetail | ProgressionStateEventDetail,
) {
  window.dispatchEvent(new CustomEvent(name, { detail: Object.freeze(detail) }));
}

function queueEvidence(snapshot: ProgressionPresentationControllerSnapshot) {
  return Object.freeze({
    activeRequestId: snapshot.queue.active?.request.requestId ?? null,
    pendingCount: snapshot.queue.pending.length,
  });
}

function presentationHistoryEntries(events: readonly ClientProgressEvent[]): readonly PresentationHistoryEntry[] {
  return Object.freeze(
    events
      .filter((event): event is ClientProgressEvent & { type: ProgressionPresentationRequest["eventType"] } =>
        isPhase3PlayerProgressEventType(event.type),
      )
      .sort((left, right) => right.sequence - left.sequence || right.id.localeCompare(left.id))
      .slice(0, MAX_PRESENTATION_HISTORY_ENTRIES)
      .map((event) => Object.freeze({ eventId: event.id, eventType: event.type, eventSequence: event.sequence })),
  );
}

class JournalOpeningFailure extends Error {
  constructor(readonly outcome: JournalPhaseOutcome) {
    super(`Journal phase ${outcome.phase} ended as ${outcome.status}.`);
    this.name = "JournalOpeningFailure";
  }
}

const clientUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deviceId() {
  let id = localStorage.getItem("forever-device");
  if (!id || !clientUuidPattern.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem("forever-device", id);
  }
  return id;
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function waitForValue<T>(read: () => T | null | undefined, signal: AbortSignal, timeoutMs = 1_800) {
  return new Promise<T | null>((resolve) => {
    const deadline = performance.now() + timeoutMs;
    let frame = 0;
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      if (frame) window.cancelAnimationFrame(frame);
    };
    const settle = (value: T | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onAbort = () => settle(null);
    const check = () => {
      if (signal.aborted) return settle(null);
      const value = read();
      if (value) return settle(value);
      if (performance.now() >= deadline) return settle(null);
      frame = window.requestAnimationFrame(check);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    check();
  });
}

function sectionHeadingWithin(transition: HTMLElement | null) {
  return transition?.querySelector<HTMLElement>(":scope > [data-section-heading]") ?? null;
}

function eventPayloadKey(event: ClientProgressEvent, field = "key") {
  const value = event.payload[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isSafeFocusTarget(target: HTMLElement | null) {
  if (!target?.isConnected || target.matches(":disabled,[hidden],[inert]")) return false;
  if (target.closest('[inert],[hidden],[aria-hidden="true"],[data-pageflip-source="true"],[data-pageflip-source]'))
    return false;
  const style = getComputedStyle(target);
  return style.display !== "none" && style.visibility !== "hidden";
}

function captureSectionRestoration(sectionId: CompanionView, transition: HTMLElement | null): PlayerSectionRestoration {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return Object.freeze({
    sectionId,
    scrollPosition: Object.freeze({ x: transition?.scrollLeft ?? 0, y: transition?.scrollTop ?? 0 }),
    exactFocusTarget: isSafeFocusTarget(active) ? active : null,
    triggerTarget: active?.closest<HTMLElement>("button,a,[role=button]") ?? null,
    sectionHeadingTarget: sectionHeadingWithin(transition),
  });
}

function restoreSection(
  restoration: PlayerSectionRestoration,
  transition: HTMLElement | null,
): PlayerSectionRestorationResult {
  if (transition?.isConnected) {
    transition.scrollLeft = restoration.scrollPosition.x;
    transition.scrollTop = restoration.scrollPosition.y;
  }
  const exact = isSafeFocusTarget(restoration.exactFocusTarget) ? restoration.exactFocusTarget : null;
  const trigger = isSafeFocusTarget(restoration.triggerTarget) ? restoration.triggerTarget : null;
  const heading = isSafeFocusTarget(restoration.sectionHeadingTarget) ? restoration.sectionHeadingTarget : null;
  const target = exact ?? trigger ?? heading;
  if (!target) return transition?.isConnected ? "section-only" : "failed";
  target.focus({ preventScroll: true });
  if (target === exact) return "exact-target";
  if (target === heading) return "section-heading";
  return "destination-control";
}

function presentationSummary(request: ProgressionPresentationRequest) {
  const policy = policyForProgressionEvent(request.eventType);
  const fields = policy.globalPresentation.summaryFields.flatMap((field) => {
    const value = request.payload[field];
    return value === undefined || value === "" ? [] : [`${field.replaceAll(/([A-Z])/g, " $1")}: ${String(value)}`];
  });
  return fields.length > 0 ? fields.join(" · ") : policy.fallback.heading;
}

function progressionReceiptEvidence(
  receipt: ProgressionPresentationReceipt,
  playbackIdentity: string,
  controllerState: ProgressionPresentationControllerSnapshot,
  integration: BrowserIntegrationEvidence,
): ProgressionReceiptEventDetail {
  const scene = receipt.sceneReceipt;
  const targetReport = receipt.targetReport;
  const sceneContract = scene ? sceneContracts[scene.sceneName] : null;
  return Object.freeze({
    version: 1,
    requestId: receipt.requestId,
    eventId: receipt.eventId,
    eventType: receipt.eventType,
    eventSequence: receipt.eventSequence,
    source: receipt.source,
    playbackIdentity,
    status: receipt.status,
    sceneName: policyForProgressionEvent(receipt.eventType).sceneName,
    queueWaitMs: receipt.queueWaitMs,
    acknowledgmentEligible: receipt.acknowledgmentEligible,
    acknowledgmentAttempted: receipt.acknowledgmentEligible,
    acknowledged: false,
    cursors: controllerState.cursors,
    fallbackResult: receipt.fallbackResult,
    finalStateResult: receipt.finalStateResult,
    restorationResult: receipt.restorationResult,
    semanticLabels: Object.freeze(
      receipt.semanticLabels.filter((label) => /^[a-z0-9-]{1,80}$/.test(label)).slice(0, 64),
    ),
    currentSection: integration.currentSection,
    returnSection: integration.returnSection,
    motionPolicyLevel: scene?.motionPolicy.level ?? null,
    motionPolicySource: scene
      ? Object.freeze({
          productSetting: scene.motionPolicy.source.productSetting,
          browserPrefersReduced: scene.motionPolicy.source.browserPrefersReduced,
        })
      : null,
    motionPolicy: Object.freeze({
      level: scene?.motionPolicy.level ?? null,
      source: scene
        ? Object.freeze({
            productSetting: scene.motionPolicy.source.productSetting,
            browserPrefersReduced: scene.motionPolicy.source.browserPrefersReduced,
          })
        : null,
    }),
    scene: scene
      ? Object.freeze({
          sceneName: scene.sceneName,
          sceneInstanceId: scene.sceneInstanceId,
          hostId: scene.hostId,
          hostKind: scene.hostKind,
          outcome: scene.outcome,
          requestSource: scene.requestSource,
          durationMs: scene.durationMs,
          cleanup: scene.cleanup,
          finalization: scene.finalization ? Object.freeze({ ...scene.finalization }) : null,
        })
      : null,
    targetReport: targetReport
      ? Object.freeze({
          requiredSatisfied: targetReport.requiredSatisfied,
          durationMs: targetReport.durationMs,
          failures: Object.freeze(
            targetReport.failures
              .slice(0, 128)
              .map((failure) => Object.freeze({ part: failure.part, code: failure.code })),
          ),
          observations: Object.freeze(
            targetReport.observations.slice(0, 128).map((observation, index) =>
              Object.freeze({
                targetKey: sceneContract?.version === 2 ? (sceneContract.targets[index]?.key ?? null) : null,
                part: observation.part,
                required: observation.required,
                candidateCount: observation.matchedCount,
                matchedCount: observation.matchedCount,
                visibleCount: observation.visibleCount,
                duplicateCount: observation.duplicateCount,
                ownershipRejectedCount: observation.ownershipRejectedCount,
                acceptedTargetIds: Object.freeze([]),
                rejectionCodes: Object.freeze([]),
                resolutionDetail: "unavailable-in-director-receipt" as const,
              }),
            ),
          ),
        })
      : null,
    localEnhancement: integration.localEnhancement,
  });
}

async function loadAcknowledgedEventIds(campaignSlug: string, eventIds: readonly string[], signal: AbortSignal) {
  const unique = [...new Set(eventIds)].slice(0, 100);
  if (unique.length === 0) return [];
  const query = new URLSearchParams({ deviceId: deviceId() });
  unique.forEach((eventId) => query.append("eventIds", eventId));
  const response = await fetch(`/api/player/${campaignSlug}/viewed?${query}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Presentation acknowledgments could not be loaded.");
  const body = (await response.json()) as { acknowledgedEventIds?: unknown };
  return Array.isArray(body.acknowledgedEventIds)
    ? body.acknowledgedEventIds.filter((eventId): eventId is string => typeof eventId === "string")
    : [];
}

export function PlayerExperience({ initialSnapshot }: { initialSnapshot: PublicSnapshot }) {
  const root = useRef<HTMLDivElement>(null);
  const sectionFocusTarget = useRef<HTMLDivElement>(null);
  const persistentHost = useRef<SceneHostHandle | null>(null);
  const journalOpeningHost = useRef<SceneHostHandle | null>(null);
  const chartTargets = useRef(new Map<string, VoyageChartTargetRegistration>());
  const logTargets = useRef(new Map<string, ShipsLogTargetRegistration>());
  const artifactTargets = useRef(new Map<string, TreasureAltarArtifactTargetHandles>());
  const artifactConnectionTargets = useRef(new Map<string, TreasureAltarConnectionTargetHandle>());
  const inspectionTargets = useRef(new Map<string, ArtifactInspectionTargetHandles>());
  const journalCeremonyTargets = useRef<JournalCeremonyTargetReady | null>(null);
  const journalAnnotationTarget = useRef<JournalAnnotationTargetReady | null>(null);
  const chapterSolvedLocalTarget = useRef<ChapterSolvedLocalTargetReady | null>(null);
  const sideQuestTarget = useRef<SideQuestLocalTargetReady | null>(null);
  const finaleTargets = useRef(new Map<string, FinaleChamberTargetRegistration>());
  const finaleMechanismTarget = useRef<FinaleMechanismTargetReady | null>(null);
  const finaleMechanismStatus = useRef<RiveRuntimeStatus | null>(null);
  const companionHeaderDim = useRef<CompanionHeaderDimTargetRegistration | null>(null);
  const companionDesktopDim = useRef<CompanionNavigationDimTargetRegistration | null>(null);
  const companionMobileDim = useRef<CompanionNavigationDimTargetRegistration | null>(null);
  const activeExternalHandles = useRef(new Map<string, Set<ExternalSceneTargetHandle>>());
  const snapshotRef = useRef(initialSnapshot);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [view, setView] = useState<CompanionView>("journal");
  const viewRef = useRef<CompanionView>("journal");
  const [openingPhase, setOpeningPhase] = useState<JournalOpeningPhase>("ENTRY_IDLE");
  const [resettingJournal, setResettingJournal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.4);
  const [connection, setConnection] = useState<"connecting" | "live" | "adrift">("connecting");
  const [lastRelease, setLastRelease] = useState<ReplayablePresentation | null>(
    initialSnapshot.latestChapterReleasePresentation ?? null,
  );
  const [activeEvent, setActiveEvent] = useState<ClientProgressEvent | null>(null);
  const [activeRequest, setActiveRequest] = useState<ProgressionPresentationRequest | null>(null);
  const activeRequestRef = useRef<ProgressionPresentationRequest | null>(null);
  const [lastPresentedRequest, setLastPresentedRequest] = useState<ProgressionPresentationRequest | null>(null);
  const [presentationStatus, setPresentationStatus] = useState("idle");
  const [presentationFallback, setPresentationFallback] = useState<string | null>(null);
  const [lastPresentationReceipt, setLastPresentationReceipt] = useState<ProgressionPresentationReceipt | null>(null);
  const [presentationHistory, setPresentationHistory] = useState<readonly PresentationHistoryEntry[]>(() =>
    presentationHistoryEntries(initialSnapshot.presentationHistory ?? []),
  );
  const [historyReconciled, setHistoryReconciled] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const accessRevokedRef = useRef(false);
  const [journalOpeningNotice, setJournalOpeningNotice] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [inspectionOrigin, setInspectionOrigin] = useState<HTMLElement | null>(null);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [textScale, setTextScaleState] = useState(1);
  const [texture, setTextureState] = useState(1);
  const [openingSpeed, setOpeningSpeed] = useState<0.25 | 0.5 | 1>(1);
  const openingRun = useRef<AbortController | null>(null);
  const presentationRun = useRef<AbortController | null>(null);
  const replayMutationGuard = useRef(false);
  const openingBusy = useRef(false);
  const acknowledgmentRequests = useRef(new Map<string, Promise<boolean>>());
  const eventHistory = useRef(
    new Map((initialSnapshot.presentationHistory ?? []).map((event) => [event.id, Object.freeze({ ...event })])),
  );
  const presentationIntegrationEvidence = useRef(new Map<string, BrowserIntegrationEvidence>());
  const presentationPlaybackIdentities = useRef(new Map<string, string>());
  const dispatchedProgressionReceipts = useRef(new WeakSet<ProgressionPresentationReceipt>());
  const controllerRef = useRef<ProgressionPresentationController | null>(null);
  const controllerSnapshot = useRef<ProgressionPresentationControllerSnapshot | null>(null);
  const audio = useRef(new AudioCuePlayer());
  const { director, snapshot: animation } = useAnimationDirector();
  const { mode, policy, cycle } = useMotionMode();
  const previousMotionMode = useRef(mode);
  const journalReady = isJournalInteractive(openingPhase);

  const revokeExternalKey = useCallback((key: string) => {
    const handles = activeExternalHandles.current.get(key);
    if (!handles) return;
    handles.forEach((handle) => handle.revoke());
    activeExternalHandles.current.delete(key);
  }, []);

  const trackExternal = useCallback((key: string, handle: ExternalSceneTargetHandle) => {
    const handles = activeExternalHandles.current.get(key) ?? new Set<ExternalSceneTargetHandle>();
    handles.add(handle);
    activeExternalHandles.current.set(key, handles);
    return handle;
  }, []);

  const releaseExternal = useCallback((handle: ExternalSceneTargetHandle) => {
    handle.revoke();
    for (const [key, handles] of activeExternalHandles.current) {
      handles.delete(handle);
      if (handles.size === 0) activeExternalHandles.current.delete(key);
    }
  }, []);

  const onChartTargetRegistrationChange = useCallback(
    (registration: VoyageChartTargetRegistration) => {
      const key = `${registration.kind}:${registration.key}`;
      if (registration.host && registration.handle) chartTargets.current.set(key, registration);
      else {
        chartTargets.current.delete(key);
        revokeExternalKey(`chart:${key}`);
      }
    },
    [revokeExternalKey],
  );

  const onLogTargetRegistrationChange = useCallback(
    (registration: ShipsLogTargetRegistration) => {
      const key = `${registration.kind}:${registration.key}`;
      if (registration.host && registration.handle) logTargets.current.set(key, registration);
      else {
        logTargets.current.delete(key);
        revokeExternalKey(`log:${key}`);
      }
    },
    [revokeExternalKey],
  );

  const onArtifactTargetHandlesChange = useCallback(
    (handles: TreasureAltarArtifactTargetHandles) => {
      if (handles.layoutSource || handles.cinematicDestination) {
        artifactTargets.current.set(handles.artifactKey, handles);
        return;
      }
      artifactTargets.current.delete(handles.artifactKey);
      revokeExternalKey(`artifact:${handles.artifactKey}`);
    },
    [revokeExternalKey],
  );

  const onArtifactConnectionTargetHandleChange = useCallback(
    (registration: TreasureAltarConnectionTargetHandle) => {
      const key = `${registration.sourceArtifactKey}:${registration.destinationArtifactKey}`;
      if (registration.target) {
        artifactConnectionTargets.current.set(key, registration);
        return;
      }
      artifactConnectionTargets.current.delete(key);
      revokeExternalKey(`artifact-connection:${key}`);
    },
    [revokeExternalKey],
  );

  const onInspectionTargetHandlesChange = useCallback((handles: ArtifactInspectionTargetHandles | null) => {
    if (handles) inspectionTargets.current.set(handles.artifactKey, handles);
    else inspectionTargets.current.clear();
  }, []);

  const onChapterSolvedLocalTargetChange = useCallback(
    (ready: ChapterSolvedLocalTargetReady | null) => {
      chapterSolvedLocalTarget.current = ready;
      if (!ready) revokeExternalKey("journal:chapter-solved-stamp");
    },
    [revokeExternalKey],
  );

  const onFinaleTargetRegistrationChange = useCallback(
    (registration: FinaleChamberTargetRegistration) => {
      const key = `${registration.kind}:${registration.key}`;
      if (registration.host && registration.handle) finaleTargets.current.set(key, registration);
      else {
        finaleTargets.current.delete(key);
        revokeExternalKey(`finale:${key}`);
      }
    },
    [revokeExternalKey],
  );

  const onFinaleMechanismStatusChange = useCallback(
    (status: RiveRuntimeStatus | null) => {
      finaleMechanismStatus.current = status;
      if (status === null) revokeExternalKey("finale:finale-mechanism:mechanism");
    },
    [revokeExternalKey],
  );

  const onFinaleMechanismTargetChange = useCallback(
    (ready: FinaleMechanismTargetReady | null) => {
      finaleMechanismTarget.current = ready;
      if (!ready) revokeExternalKey("finale:finale-mechanism");
    },
    [revokeExternalKey],
  );

  const onCompanionHeaderDimChange = useCallback(
    (registration: CompanionHeaderDimTargetRegistration | null) => {
      companionHeaderDim.current = registration;
      if (!registration) revokeExternalKey("companion:header");
    },
    [revokeExternalKey],
  );

  const onCompanionDesktopDimChange = useCallback(
    (registration: CompanionNavigationDimTargetRegistration | null) => {
      companionDesktopDim.current = registration;
      if (!registration) revokeExternalKey("companion:desktop");
    },
    [revokeExternalKey],
  );

  const onCompanionMobileDimChange = useCallback(
    (registration: CompanionNavigationDimTargetRegistration | null) => {
      companionMobileDim.current = registration;
      if (!registration) revokeExternalKey("companion:mobile");
    },
    [revokeExternalKey],
  );

  const onPersistentHostChange = useCallback((host: SceneHostHandle | null) => {
    persistentHost.current = host;
  }, []);
  const onJournalOpeningHostChange = useCallback((host: SceneHostHandle | null) => {
    journalOpeningHost.current = host;
  }, []);

  useEffect(() => {
    const audioEngine = audio.current;
    const externalHandles = activeExternalHandles.current;
    queueMicrotask(() => {
      const savedMuted = localStorage.getItem("forever-muted") === "true";
      const savedVolume = Number(localStorage.getItem("forever-volume") ?? 0.4);
      setMuted(savedMuted);
      setVolumeState(savedVolume);
      setTextScaleState(Number(localStorage.getItem("forever-text-scale") ?? 1));
      setTextureState(Number(localStorage.getItem("forever-texture") ?? 1));
      audioEngine.setMuted(savedMuted);
      audioEngine.setVolume(savedVolume);
    });
    return () => {
      openingRun.current?.abort();
      presentationRun.current?.abort();
      controllerRef.current?.stop();
      for (const handles of externalHandles.values()) handles.forEach((handle) => handle.revoke());
      externalHandles.clear();
      audioEngine.close();
    };
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (previousMotionMode.current === mode) return;
    previousMotionMode.current = mode;
    const activeOpening = openingRun.current;
    if (!activeOpening || activeOpening.signal.aborted) return;
    activeOpening.abort();
    audio.current.stopAll();
    sessionStorage.setItem(`forever-intro:${snapshotRef.current.campaign.slug}`, "seen");
    setJournalOpeningNotice(null);
    setOpeningPhase("JOURNAL_READY");
  }, [mode]);

  const refreshSnapshot = useCallback(async () => {
    if (accessRevokedRef.current) throw new Error("Player access has been revoked.");
    const response = await fetch(`/api/player/${initialSnapshot.campaign.slug}/snapshot`, { cache: "no-store" });
    if (!response.ok) throw new Error("The latest voyage state could not be loaded.");
    const next = (await response.json()) as PublicSnapshot;
    if (accessRevokedRef.current) throw new Error("Player access has been revoked.");
    snapshotRef.current = next;
    setSnapshot(next);
    eventHistory.current = new Map(
      (next.presentationHistory ?? []).map((event) => [
        event.id,
        Object.freeze({ ...event, payload: { ...event.payload } }),
      ]),
    );
    setPresentationHistory(presentationHistoryEntries(next.presentationHistory ?? []));
    const nextRelease = next.latestChapterReleasePresentation ?? null;
    setLastRelease(nextRelease);
    return next;
  }, [initialSnapshot.campaign.slug]);

  const acknowledgePresentation = useCallback(
    (eventId: string) => {
      const existing = acknowledgmentRequests.current.get(eventId);
      if (existing) return existing;
      const request = (async () => {
        try {
          const response = await fetch(`/api/player/${initialSnapshot.campaign.slug}/viewed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, deviceId: deviceId() }),
          });
          if (!response.ok) throw new Error("Presentation acknowledgement was rejected.");
          return true;
        } catch {
          setConnection("adrift");
          return false;
        }
      })();
      acknowledgmentRequests.current.set(eventId, request);
      void request.finally(() => acknowledgmentRequests.current.delete(eventId));
      return request;
    },
    [initialSnapshot.campaign.slug],
  );

  const buildExternalTargets = useCallback(
    (event: ClientProgressEvent, destination: SceneHostHandle) => {
      const targets: Record<string, ExternalSceneTargetHandle> = {};
      const exported: ExternalSceneTargetHandle[] = [];
      const add = (
        key: string,
        trackingKey: string,
        sourceHost: SceneHostHandle,
        target: SceneTargetHandle,
        allowedProperties: readonly AnimatedProperty[],
        lifetime: "scene" | "handoff" = "scene",
      ) => {
        try {
          const external = trackExternal(
            trackingKey,
            sourceHost.exportTarget({
              target,
              destinationHostId: destination.hostId,
              allowedProperties,
              lifetime,
            }),
          );
          targets[key] = external;
          exported.push(external);
        } catch {
          // A stale, disconnected, cross-provider, or over-broad export is omitted.
          // Native v2 preflight then reports the exact required-target failure.
        }
      };
      const addCompanion = (
        key: string,
        trackingKey: string,
        registration: CompanionHeaderDimTargetRegistration | CompanionNavigationDimTargetRegistration | null,
      ) => {
        if (!registration) return;
        try {
          const external = trackExternal(
            trackingKey,
            registration.exportForScene({
              destinationHostId: destination.hostId,
              allowedProperties: ["opacity"],
              lifetime: "scene",
            }),
          );
          targets[key] = external;
          exported.push(external);
        } catch {
          // See add(): external capabilities fail closed and are never replaced by a selector.
        }
      };

      const key = eventPayloadKey(event);
      if (event.type === "CHAPTER_RELEASED") {
        addCompanion("companion-header-dim", "companion:header", companionHeaderDim.current);
        addCompanion("companion-desktop-navigation-dim", "companion:desktop", companionDesktopDim.current);
        addCompanion("companion-mobile-navigation-dim", "companion:mobile", companionMobileDim.current);
      }

      const relevantSection = isPhase3PlayerProgressEventType(event.type)
        ? policyForProgressionEvent(event.type).relevantSection
        : null;
      if (relevantSection !== viewRef.current) return { targets: Object.freeze(targets), exported };

      if (event.type === "CHAPTER_RELEASED") {
        const ready = journalCeremonyTargets.current;
        const sealedParchment = ready?.targets["sealed-parchment"][0];
        if (ready && sealedParchment)
          add("sealed-parchment", `journal:${event.id}:sealed-parchment`, ready.host, sealedParchment, ["transform"]);
      } else if (event.type === "CHAPTER_SOLVED") {
        const ready = chapterSolvedLocalTarget.current;
        if (ready?.eventId === event.id)
          add("chapter-solved-stamp", "journal:chapter-solved-stamp", ready.host, ready.target, [
            "transform",
            "opacity",
          ]);
      } else if (event.type === "MAP_LOCATION_REVEALED" && key) {
        const marker = chartTargets.current.get(`location-visual:${key}`);
        if (marker?.host && marker.handle)
          add("map-marker", `chart:location-visual:${key}`, marker.host, marker.handle, ["transform", "opacity"]);
        const fog = chartTargets.current.get(`fog-mask:${snapshotRef.current.campaign.slug}`);
        if (fog?.host && fog.handle)
          add("map-fog", `chart:fog-mask:${snapshotRef.current.campaign.slug}`, fog.host, fog.handle, [
            "clip-path",
            "opacity",
          ]);
      } else if (event.type === "MAP_ROUTE_REVEALED" && key) {
        const route = chartTargets.current.get(`route-path:${key}`);
        if (route?.host && route.handle)
          add("route-path", `chart:route-path:${key}`, route.host, route.handle, [
            "path-drawing",
            "stroke-dasharray",
            "stroke-dashoffset",
            "opacity",
          ]);
      } else if ((event.type === "ARTIFACT_AWARDED" || event.type === "ARTIFACT_SILHOUETTE_REVEALED") && key) {
        const artifact = artifactTargets.current.get(key);
        if (artifact?.cinematicDestination) {
          try {
            const external = trackExternal(
              `artifact:${key}`,
              artifact.cinematicDestination.exportForScene({
                destinationHostId: destination.hostId,
                allowedProperties: ["transform", "opacity", "filter"],
                lifetime: "scene",
              }),
            );
            targets["artifact-slot"] = external;
            exported.push(external);
          } catch {
            // Stale layout-source exports fail closed.
          }
        }
      } else if (event.type === "ARTIFACT_CONNECTED" && key) {
        const connectedKey = eventPayloadKey(event, "connectedArtifactKey");
        const connection = connectedKey ? artifactConnectionTargets.current.get(`${key}:${connectedKey}`) : undefined;
        if (connection?.target) {
          try {
            const external = trackExternal(
              `artifact-connection:${key}:${connectedKey}`,
              connection.target.exportForScene({
                destinationHostId: destination.hostId,
                allowedProperties: ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"],
                lifetime: "handoff",
              }),
            );
            targets["artifact-connection-path"] = external;
            exported.push(external);
          } catch {
            // Stale connection-path exports fail closed.
          }
        }
      } else if (event.type === "JOURNAL_ANNOTATION_ADDED") {
        const ready = journalAnnotationTarget.current;
        if (ready?.eventId === event.id) {
          try {
            const external = trackExternal(
              `journal-annotation:${event.id}`,
              ready.authority.exportTarget(ready.target, {
                destinationHostId: destination.hostId,
                allowedProperties: ["opacity", "clip-path", "filter"],
                lifetime: "scene",
              }),
            );
            targets["journal-annotation-ink"] = external;
            exported.push(external);
          } catch {}
        }
      } else if (event.type === "PLAYER_LOG_ENTRY_ADDED") {
        const entry = logTargets.current.get(`fresh-ink:${event.id}`);
        if (entry?.host && entry.handle)
          add("log-entry", `log:fresh-ink:${event.id}`, entry.host, entry.handle, ["opacity", "clip-path", "filter"]);
        const symbol = logTargets.current.get(`log-symbol:${event.id}`);
        if (symbol?.host && symbol.handle)
          add("log-symbol", `log:log-symbol:${event.id}`, symbol.host, symbol.handle, ["transform", "opacity"]);
      } else if (
        event.type === "SIDE_QUEST_DISCOVERED" ||
        event.type === "SIDE_QUEST_UPDATED" ||
        event.type === "SIDE_QUEST_COMPLETED"
      ) {
        const ready = sideQuestTarget.current;
        if (ready?.eventId === event.id) {
          for (const [externalKey, capability] of Object.entries(ready.targets)) {
            if (!capability) continue;
            const properties: readonly AnimatedProperty[] =
              externalKey === "quest-red-thread"
                ? ["path-drawing", "stroke-dasharray", "stroke-dashoffset"]
                : ["transform", "opacity"];
            try {
              const external = trackExternal(
                `quest:${event.id}:${externalKey}`,
                ready.authority.exportTarget(capability, {
                  destinationHostId: destination.hostId,
                  allowedProperties: properties,
                  lifetime: "scene",
                }),
              );
              targets[externalKey] = external;
              exported.push(external);
            } catch {}
          }
        }
      } else if (event.type === "FINALE_TEASED") {
        const mechanism = finaleMechanismTarget.current;
        if ((finaleMechanismStatus.current === "ready" || finaleMechanismStatus.current === "fallback") && mechanism) {
          try {
            const external = trackExternal(
              "finale:finale-mechanism",
              mechanism.exportForScene({
                destinationHostId: destination.hostId,
                allowedProperties: mechanism.allowedProperties,
                lifetime: "scene",
              }),
            );
            targets["finale-mechanism"] = external;
            exported.push(external);
          } catch {}
        }
      } else if (event.type === "FINALE_REQUIREMENT_UPDATED" && key) {
        const registration = finaleTargets.current.get(`requirement-socket:${key}`);
        if (registration?.host && registration.handle)
          add("finale-requirement-socket", `finale:requirement-socket:${key}`, registration.host, registration.handle, [
            "transform",
            "opacity",
            "filter",
          ]);
      }

      return { targets: Object.freeze(targets), exported };
    },
    [trackExternal],
  );

  const presentProgressionRequest = useCallback(
    async (request: ProgressionPresentationRequest): Promise<ProgressionPresentationExecution> => {
      const playerRoot = root.current;
      if (!playerRoot) return { status: "failed", finalStateResult: "failed", retryDisposition: "retryable" };
      const remembered = eventHistory.current.get(request.eventId);
      const event: ClientProgressEvent = remembered ?? {
        id: request.eventId,
        type: request.eventType,
        sequence: request.eventSequence,
        payload: request.payload,
        releaseAt: new Date().toISOString(),
      };
      const eventPolicy = policyForProgressionEvent(request.eventType);
      const summary = presentationSummary(request);
      const restoration = captureSectionRestoration(viewRef.current, sectionFocusTarget.current);
      const expectedLocal = eventPolicy.localEnhancement;
      presentationIntegrationEvidence.current.set(
        request.requestId,
        Object.freeze({
          currentSection: restoration.sectionId,
          returnSection: restoration.sectionId,
          localEnhancement: Object.freeze({
            expected: Boolean(expectedLocal),
            section: expectedLocal?.section ?? null,
            status: expectedLocal ? "unavailable" : "not-applicable",
            targetKeys: Object.freeze([]),
          }),
        }),
      );
      const controller = new AbortController();
      presentationRun.current = controller;
      replayMutationGuard.current = request.source === "replay";
      eventHistory.current.set(event.id, Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) }));
      flushSync(() => {
        activeRequestRef.current = request;
        setActiveRequest(request);
        setActiveEvent(event);
        setPresentationStatus("active");
        setPresentationFallback(null);
      });
      await nextFrame();
      const sceneHost = await waitForValue(() => persistentHost.current, controller.signal);
      if (!sceneHost) {
        flushSync(() => {
          setPresentationStatus("failed");
          setPresentationFallback(eventPolicy.fallback.heading);
          setLastPresentedRequest(request);
          activeRequestRef.current = null;
          setActiveRequest(null);
          setActiveEvent(null);
        });
        replayMutationGuard.current = false;
        return {
          status: "failed",
          fallbackResult: "readable",
          finalStateResult: "fallback",
          restorationResult: restoreSection(restoration, sectionFocusTarget.current),
          retryDisposition: "retryable",
        };
      }

      const external = buildExternalTargets(event, sceneHost);
      const providedLocalTargetKeys = expectedLocal
        ? expectedLocal.requiredHandleKeys
            .filter((targetKey) => Boolean(external.targets[targetKey]))
            .map((targetKey) => `local-${targetKey}`)
        : [];
      presentationIntegrationEvidence.current.set(
        request.requestId,
        Object.freeze({
          currentSection: restoration.sectionId,
          returnSection: restoration.sectionId,
          localEnhancement: Object.freeze({
            expected: Boolean(expectedLocal),
            section: expectedLocal?.section ?? null,
            status: expectedLocal ? "unavailable" : "not-applicable",
            targetKeys: Object.freeze(providedLocalTargetKeys),
          }),
        }),
      );
      const cleanupSteps = new Set<string>();
      const markSemanticCommit = () => controllerRef.current?.setSemanticCommitReached(true);
      const publishReadableState = (nextStatus: string, fallback?: string) => {
        if (controller.signal.aborted) return;
        flushSync(() => {
          setPresentationStatus(nextStatus);
          if (fallback) setPresentationFallback(fallback);
        });
      };
      const verifyReadableState = () => {
        const overlay = playerRoot.querySelector<HTMLElement>(
          `[data-progression-overlay][data-presentation-id="${CSS.escape(request.requestId)}"]`,
        );
        const heading = overlay?.querySelector<HTMLElement>("#player-progression-heading");
        const readableSummary = overlay?.querySelector<HTMLElement>("#player-progression-summary");
        return Boolean(
          overlay &&
            !overlay.hidden &&
            heading?.textContent?.trim() === eventPolicy.globalPresentation.heading &&
            readableSummary?.textContent?.trim() === summary,
        );
      };

      let sceneReceipt: PresentationReceipt | undefined;
      let execution: ProgressionPresentationExecution;
      try {
        sceneReceipt = await director.play<void>(eventPolicy.sceneName, {
          root: playerRoot,
          sceneHost,
          hostId: sceneHost.hostId,
          hostKind: sceneHost.kind,
          externalTargets: external.targets,
          requestSource: request.source === "replay" ? "replay" : "automatic",
          eventOrActionId: request.eventId,
          signal: controller.signal,
          display: request.payload,
          telemetryContext: { route: "/tale", playerSection: restoration.sectionId },
          queue: false,
          finalStateRuntime: {
            commitFinalState: () => {
              markSemanticCommit();
              publishReadableState("committed");
            },
            reconcileFinalState: () => {
              markSemanticCommit();
              publishReadableState("reconciled");
            },
            holdSafePose: () => publishReadableState("safe-pose", eventPolicy.fallback.heading),
            renderStaticFallback: () => {
              markSemanticCommit();
              publishReadableState("fallback", eventPolicy.fallback.heading);
            },
            verifyReadableState,
            cleanup: (step) => {
              if (cleanupSteps.has(step)) return;
              cleanupSteps.add(step);
            },
          },
          presentationFallback: async (context) => {
            if (context.signal?.aborted || context.hostId !== sceneHost.hostId) {
              return { completed: false, readable: false, reason: "progression-fallback-context-rejected" };
            }
            publishReadableState("fallback", eventPolicy.fallback.heading);
            markSemanticCommit();
            await nextFrame();
            return verifyReadableState()
              ? { completed: true, readable: true, semanticState: eventPolicy.fallback.equivalentReducedOutcome }
              : { completed: false, readable: false, reason: "progression-fallback-not-readable" };
          },
        });

        if (eventPolicy.audio.kind === "semantic-labels") {
          for (const label of eventPolicy.audio.labels) {
            const validated = receiptValidatesAudio(sceneReceipt, label.semanticLabel);
            if (!validated) continue;
            audio.current.playValidated({
              name: label.cue,
              motionPolicy: sceneReceipt.motionPolicy,
              motionOnly: label.motionOnly,
              presentationValidated: true,
              semanticLabel: label.semanticLabel,
              allowedSemanticLabels: [label.semanticLabel],
            });
          }
        }

        const status =
          sceneReceipt.outcome === "presented"
            ? "presented"
            : sceneReceipt.outcome === "presented-fallback"
              ? "fallback"
              : sceneReceipt.outcome === "skipped-by-user"
                ? "skipped"
                : sceneReceipt.outcome === "aborted" || sceneReceipt.outcome === "interrupted"
                  ? "cancelled"
                  : "failed";
        const finalStateResult = sceneReceipt.finalization?.handoffCompleted
          ? sceneReceipt.finalization.cleanupResult === "completed-with-fallback"
            ? "fallback"
            : "reconciled"
          : status === "fallback"
            ? "fallback"
            : status === "failed"
              ? "failed"
              : "committed";
        execution = {
          status,
          sceneReceipt,
          fallbackResult: status === "fallback" ? "readable" : "not-used",
          finalStateResult,
          retryDisposition: status === "failed" || status === "cancelled" ? "retryable" : "replay-available",
        };
        const sceneContract = sceneContracts[eventPolicy.sceneName];
        const localTargetObservations = sceneReceipt?.targetReport.observations ?? [];
        const verifiedLocalTargetKeys =
          expectedLocal && sceneContract.version === 2
            ? expectedLocal.requiredHandleKeys
                .map((targetKey) => `local-${targetKey}`)
                .filter((targetKey) => {
                  if (!providedLocalTargetKeys.includes(targetKey)) return false;
                  const targetIndex = sceneContract.targets.findIndex((target) => target.key === targetKey);
                  const observation = targetIndex >= 0 ? localTargetObservations[targetIndex] : undefined;
                  return Boolean(
                    observation &&
                      observation.matchedCount === 1 &&
                      observation.visibleCount === 1 &&
                      observation.duplicateCount === 0 &&
                      observation.ownershipRejectedCount === 0,
                  );
                })
            : [];
        presentationIntegrationEvidence.current.set(
          request.requestId,
          Object.freeze({
            currentSection: viewRef.current,
            returnSection: restoration.sectionId,
            localEnhancement: Object.freeze({
              expected: Boolean(expectedLocal),
              section: expectedLocal?.section ?? null,
              status:
                expectedLocal &&
                verifiedLocalTargetKeys.length === expectedLocal.requiredHandleKeys.length &&
                ["presented", "fallback", "skipped"].includes(status)
                  ? "ran"
                  : expectedLocal
                    ? "unavailable"
                    : "not-applicable",
              targetKeys: Object.freeze(verifiedLocalTargetKeys),
            }),
          }),
        );
      } catch {
        publishReadableState("fallback", eventPolicy.fallback.heading);
        execution = {
          status: controller.signal.aborted ? "cancelled" : "failed",
          fallbackResult: "readable",
          finalStateResult: "fallback",
          retryDisposition: "retryable",
        };
      } finally {
        external.exported.forEach(releaseExternal);
        replayMutationGuard.current = false;
      }

      if (accessRevokedRef.current) {
        flushSync(() => {
          activeRequestRef.current = null;
          setActiveRequest(null);
          setActiveEvent(null);
          setLastPresentedRequest(null);
        });
        if (presentationRun.current === controller) presentationRun.current = null;
        return {
          status: "cancelled",
          finalStateResult: "failed",
          restorationResult: "not-attempted",
          retryDisposition: "retryable",
        };
      }
      if (request.source !== "replay") await refreshSnapshot().catch(() => setConnection("adrift"));
      flushSync(() => {
        setLastPresentedRequest(request);
        setPresentationStatus(execution.status);
        activeRequestRef.current = null;
        setActiveRequest(null);
        setActiveEvent(null);
      });
      const restorationResult = restoreSection(restoration, sectionFocusTarget.current);
      if (presentationRun.current === controller) presentationRun.current = null;
      return { ...execution, restorationResult };
    },
    [buildExternalTargets, director, refreshSnapshot, releaseExternal],
  );

  const ensureProgressionController = useCallback(() => {
    if (controllerRef.current) return controllerRef.current;
    let stagedRequestIdentity: string | null = null;
    controllerRef.current = new ProgressionPresentationController(
      {
        createIdentity: (kind, event, source) => {
          const identity = `${kind}:${source}:${event.id}:${crypto.randomUUID()}`;
          if (kind === "request") stagedRequestIdentity = identity;
          else if (stagedRequestIdentity) {
            presentationPlaybackIdentities.current.set(stagedRequestIdentity, identity);
            stagedRequestIdentity = null;
          }
          return identity;
        },
        present: presentProgressionRequest,
        acknowledge: (receipt) => acknowledgePresentation(receipt.eventId),
        cancelActive: (requestId) => {
          if (activeRequestRef.current?.requestId !== requestId) return;
          presentationRun.current?.abort();
          director.cancel?.("authoritative-progression-arrived");
        },
        onReceipt: (receipt) => {
          setLastPresentationReceipt(receipt);
          if (dispatchedProgressionReceipts.current.has(receipt)) return;
          dispatchedProgressionReceipts.current.add(receipt);
          const playbackIdentity = presentationPlaybackIdentities.current.get(receipt.requestId);
          if (!playbackIdentity) throw new Error(`Missing playback identity for ${receipt.requestId}.`);
          const receiptPolicy = policyForProgressionEvent(receipt.eventType);
          const integration =
            presentationIntegrationEvidence.current.get(receipt.requestId) ??
            Object.freeze({
              currentSection: viewRef.current,
              returnSection: viewRef.current,
              localEnhancement: Object.freeze({
                expected: Boolean(receiptPolicy.localEnhancement),
                section: receiptPolicy.localEnhancement?.section ?? null,
                status: receiptPolicy.localEnhancement ? ("unavailable" as const) : ("not-applicable" as const),
                targetKeys: Object.freeze([]),
              }),
            });
          const controllerState = controllerRef.current?.snapshot();
          if (!controllerState) throw new Error("Progression controller receipt arrived before initialization.");
          dispatchProgressionEvidence(
            progressionReceiptEventName,
            progressionReceiptEvidence(receipt, playbackIdentity, controllerState, integration),
          );
        },
        onSnapshot: (next) => {
          controllerSnapshot.current = next;
          dispatchProgressionEvidence(
            progressionStateEventName,
            Object.freeze({
              version: 1,
              transition: "queue",
              eventId: next.queue.active?.request.eventId ?? null,
              requestId: next.queue.active?.request.requestId ?? null,
              acknowledged: false,
              acknowledgmentAttempted: false,
              cursors: next.cursors,
              queue: queueEvidence(next),
            }),
          );
        },
        onSettled: (notification) => {
          dispatchProgressionEvidence(
            progressionStateEventName,
            Object.freeze({
              version: 1,
              transition: "settled",
              eventId: notification.receipt.eventId,
              requestId: notification.receipt.requestId,
              acknowledged: notification.acknowledged,
              acknowledgmentAttempted: notification.acknowledgmentAttempted,
              cursors: notification.snapshot.cursors,
              queue: queueEvidence(notification.snapshot),
            }),
          );
          presentationIntegrationEvidence.current.delete(notification.receipt.requestId);
          if (notification.receipt.status !== "deferred") {
            presentationPlaybackIdentities.current.delete(notification.receipt.requestId);
          }
        },
      },
      { settledAuthoritativeSequence: 0 },
    );
    return controllerRef.current;
  }, [acknowledgePresentation, director, presentProgressionRequest]);

  const playEvent = useCallback(
    async (
      incomingEvent: ClientProgressEvent,
      requestSource: "automatic" | "replay" = "automatic",
      suppliedRelease?: ReplayablePresentation,
    ) => {
      const event = suppliedRelease ? toChapterReleaseClientEvent(suppliedRelease) : incomingEvent;
      eventHistory.current.set(event.id, Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) }));
      const controller = ensureProgressionController();
      controller.submit(event, requestSource === "replay" ? "replay" : "live");
      await controller.awaitIdle();
    },
    [ensureProgressionController],
  );

  useEffect(() => {
    if (!journalReady || historyReconciled || accessRevoked) return;
    const abort = new AbortController();
    const reconcile = async () => {
      const history = [...(snapshotRef.current.presentationHistory ?? [])].sort(
        (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
      );
      const acknowledgedEventIds = await loadAcknowledgedEventIds(
        initialSnapshot.campaign.slug,
        history.map((event) => event.id),
        abort.signal,
      );
      if (abort.signal.aborted) return;
      const controller = ensureProgressionController();
      await controller.reconcile({ events: history, acknowledgedEventIds, source: "reconnect" });
      if (!abort.signal.aborted) setHistoryReconciled(true);
    };
    void reconcile().catch(() => {
      if (!abort.signal.aborted) setConnection("adrift");
    });
    return () => abort.abort();
  }, [accessRevoked, ensureProgressionController, historyReconciled, initialSnapshot.campaign.slug, journalReady]);

  useEffect(() => {
    if (!historyReconciled || accessRevoked) return;
    const controller = ensureProgressionController();
    const after = controller.snapshot().cursors.observed;
    const source = new EventSource(`/api/player/${initialSnapshot.campaign.slug}/events?after=${after}`);
    const offline = () => setConnection("adrift");
    const online = () => {
      setConnection("connecting");
      void refreshSnapshot()
        .then(async (next) => {
          const history = [...(next.presentationHistory ?? [])].sort(
            (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
          );
          const abort = new AbortController();
          const acknowledgedEventIds = await loadAcknowledgedEventIds(
            initialSnapshot.campaign.slug,
            history.map((event) => event.id),
            abort.signal,
          );
          await controller.reconcile({ events: history, acknowledgedEventIds, source: "reconnect" });
          setConnection("live");
        })
        .catch(() => setConnection("adrift"));
    };
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("adrift");
    source.addEventListener("progression", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as ClientProgressEvent;
      if (event.type === "CHAPTER_RELEASED") {
        void refreshSnapshot()
          .then((next) => {
            const authorized = next.presentationHistory?.find((candidate) => candidate.id === event.id);
            if (!authorized) return;
            eventHistory.current.set(
              authorized.id,
              Object.freeze({ ...authorized, payload: Object.freeze({ ...authorized.payload }) }),
            );
            controller.submit(authorized, "live");
          })
          .catch(() => setConnection("adrift"));
        return;
      }
      eventHistory.current.set(event.id, Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) }));
      controller.submit(event, "live");
    });
    source.addEventListener("access-revoked", () => {
      source.close();
      presentationRun.current?.abort();
      controllerRef.current?.stop();
      accessRevokedRef.current = true;
      eventHistory.current.clear();
      setPresentationHistory([]);
      journalCeremonyTargets.current = null;
      journalAnnotationTarget.current = null;
      chapterSolvedLocalTarget.current = null;
      sideQuestTarget.current = null;
      chartTargets.current.clear();
      logTargets.current.clear();
      artifactTargets.current.clear();
      artifactConnectionTargets.current.clear();
      finaleTargets.current.clear();
      finaleMechanismTarget.current = null;
      finaleMechanismStatus.current = null;
      presentationIntegrationEvidence.current.clear();
      presentationPlaybackIdentities.current.clear();
      dispatchedProgressionReceipts.current = new WeakSet<ProgressionPresentationReceipt>();
      for (const handles of activeExternalHandles.current.values()) handles.forEach((handle) => handle.revoke());
      activeExternalHandles.current.clear();
      const revokedSnapshot = controller.snapshot();
      dispatchProgressionEvidence(
        progressionStateEventName,
        Object.freeze({
          version: 1,
          transition: "access-revoked",
          eventId: revokedSnapshot.queue.active?.request.eventId ?? null,
          requestId: revokedSnapshot.queue.active?.request.requestId ?? null,
          acknowledged: false,
          acknowledgmentAttempted: false,
          cursors: revokedSnapshot.cursors,
          queue: queueEvidence(revokedSnapshot),
        }),
      );
      flushSync(() => {
        setAccessRevoked(true);
        setConnection("adrift");
        setPresentationFallback("Your invitation is no longer active. Ask the captain for a new invitation.");
        setLastRelease(null);
        setLastPresentedRequest(null);
        activeRequestRef.current = null;
        setActiveRequest(null);
        setActiveEvent(null);
      });
    });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      source.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [accessRevoked, ensureProgressionController, historyReconciled, initialSnapshot.campaign.slug, refreshSnapshot]);

  useEffect(() => {
    if (accessRevoked) return;
    const report = (disconnected = false) => {
      if (replayMutationGuard.current) return Promise.resolve(undefined);
      return fetch(`/api/player/${snapshot.campaign.slug}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId(),
          route: `${location.pathname}#${view}`,
          visibility: document.visibilityState,
          acknowledgedSequence: controllerSnapshot.current?.cursors.acknowledged ?? 0,
          disconnected,
        }),
        keepalive: disconnected,
      }).catch(() => undefined);
    };
    void report();
    const interval = window.setInterval(() => void report(), 20_000);
    const visibility = () => void report();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      void report(true);
    };
  }, [accessRevoked, lastPresentationReceipt, snapshot.campaign.slug, view]);

  useEffect(() => {
    const readLocation = () => {
      const params = new URLSearchParams(location.search);
      const requested = params.get("section") as CompanionView | null;
      setView(requested && companionViews.some((item) => item.key === requested) ? requested : "journal");
      if (process.env.NODE_ENV !== "production") {
        const requestedSpeed = Number(params.get("journalSpeed") ?? 1);
        setOpeningSpeed(requestedSpeed === 0.25 || requestedSpeed === 0.5 ? requestedSpeed : 1);
      }
    };
    readLocation();
    window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, []);

  useEffect(() => {
    if (!journalReady || replayMutationGuard.current) return;
    const mandatoryEventId = activeRequest?.mandatory ? activeRequest.eventId : null;
    const failedAutomaticChapter =
      lastPresentedRequest?.mandatory && lastPresentationReceipt?.status === "failed"
        ? lastPresentedRequest.eventId
        : null;
    if (view === "journal" && shouldSuppressChapterViewed(mandatoryEventId, failedAutomaticChapter, false)) {
      return;
    }
    const entries: Record<CompanionView, { contentType: string; contentKeys: string[] }> = {
      journal: {
        contentType: "chapter",
        contentKeys: snapshot.chapters.filter((item) => item.unseen).map((item) => String(item.ordinal)),
      },
      chart: {
        contentType: "map",
        contentKeys: snapshot.mapLocations.filter((item) => item.unseen).map((item) => item.key),
      },
      treasures: {
        contentType: "artifact",
        contentKeys: snapshot.artifacts.filter((item) => item.unseen).map((item) => item.key),
      },
      quests: {
        contentType: "quest",
        contentKeys: snapshot.sideQuests.filter((item) => item.unseen).map((item) => item.key),
      },
      log: { contentType: "log", contentKeys: snapshot.log.filter((item) => item.unseen).map((item) => item.key) },
      finale: { contentType: "finale", contentKeys: snapshot.finale.unseen ? [snapshot.finale.state] : [] },
    };
    const entry = entries[view];
    if (!entry.contentKeys.length) return;
    const controller = new AbortController();
    void fetch(`/api/player/${snapshot.campaign.slug}/viewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Viewed content update was rejected.");
        return refreshSnapshot();
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [
    activeRequest,
    journalReady,
    lastPresentationReceipt,
    lastPresentedRequest,
    lastRelease,
    refreshSnapshot,
    snapshot,
    view,
  ]);

  async function openJournal(forceFull = false) {
    if (openingBusy.current || !root.current) return;
    openingBusy.current = true;
    setJournalOpeningNotice(null);
    const controller = new AbortController();
    openingRun.current = controller;
    audio.current.stopAll();
    audio.current.unlock();
    const advance = async (phase: JournalOpeningPhase, cue?: AudioCueName) => {
      if (controller.signal.aborted || !root.current) throw new DOMException("Opening interrupted", "AbortError");
      flushSync(() => setOpeningPhase(phase));
      const outcome = await waitForJournalPhase(root.current, phase, mode, controller.signal);
      const disposition = journalPhaseDisposition(outcome);
      if (disposition === "aborted") throw new DOMException("Opening interrupted", "AbortError");
      if (disposition === "failed") throw new JournalOpeningFailure(outcome);
      if (cue) {
        audio.current.playValidated({
          name: cue,
          motionPolicy: policy,
          motionOnly: true,
          presentationValidated: true,
          semanticLabel: phase,
          allowedSemanticLabels: [phase],
        });
      }
    };
    try {
      if (forceFull) {
        flushSync(() => {
          setResettingJournal(true);
          setView("journal");
          setOpeningPhase("ENTRY_IDLE");
        });
        await nextFrame();
        await nextFrame();
        flushSync(() => setResettingJournal(false));
      }
      await advance("ENTRY_ACTIVATED", "ocean-rise");
      const key = `forever-intro:${snapshot.campaign.slug}`;
      const first = forceFull || sessionStorage.getItem(key) !== "seen";
      const sceneHost = await waitForValue(() => journalOpeningHost.current, controller.signal);
      if (!sceneHost) throw new Error("The journal opening host did not register.");
      const prelude = await director.play(first ? "first-arrival" : "session-reentry", {
        root: root.current,
        sceneHost,
        hostId: sceneHost.hostId,
        hostKind: sceneHost.kind,
        requestSource: forceFull ? "replay" : "explicit",
        eventOrActionId: `journal-opening:${first ? "first-arrival" : "session-reentry"}`,
        telemetryContext: { route: "/tale", playerSection: "journal" },
        signal: controller.signal,
        queue: false,
      });
      if (prelude.outcome === "skipped-by-user" || prelude.outcome === "aborted") {
        throw new DOMException("Opening interrupted", "AbortError");
      }
      if (prelude.outcome !== "presented" && prelude.outcome !== "presented-fallback") {
        throw new Error(`Journal prelude ended as ${prelude.outcome}.`);
      }
      await advance("CLOSED_BOOK_REVEAL");
      await advance("LATCH_RELEASING", "brass-latch");
      await advance("COVER_OPENING", "wood-creak");
      await advance("SEALED_PAGE_REVEAL", "seal-pressure");
      await advance("SEAL_BREAKING", "wax-crack");
      await advance("BOOK_SETTLING", "paper-flutter");
      await advance("JOURNAL_READY");
      sessionStorage.setItem(key, "seen");
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        if (cause instanceof JournalOpeningFailure) {
          const safeMessage = "The journal opened in readable mode after the ceremony could not finish.";
          const diagnostic = ` phase=${cause.outcome.phase} status=${cause.outcome.status}`;
          setJournalOpeningNotice(process.env.NODE_ENV === "production" ? safeMessage : `${safeMessage}${diagnostic}`);
          sessionStorage.setItem(`forever-intro:${snapshot.campaign.slug}`, "seen");
          flushSync(() => setOpeningPhase("JOURNAL_READY"));
        } else {
          const safeMessage = "The journal could not finish opening. Try the ceremony again.";
          const diagnostic = " prelude=failed";
          setJournalOpeningNotice(process.env.NODE_ENV === "production" ? safeMessage : `${safeMessage}${diagnostic}`);
          flushSync(() => setOpeningPhase("ENTRY_IDLE"));
        }
      }
    } finally {
      if (openingRun.current === controller) openingRun.current = null;
      openingBusy.current = false;
    }
  }

  function skipJournalOpening() {
    setJournalOpeningNotice(null);
    sessionStorage.setItem(`forever-intro:${snapshot.campaign.slug}`, "seen");
    openingRun.current?.abort();
    director.skip();
    audio.current.stopAll();
    flushSync(() => setOpeningPhase("JOURNAL_READY"));
  }

  function navigate(next: CompanionView) {
    setView(next);
    const url = new URL(location.href);
    url.searchParams.set("section", next);
    history.pushState({}, "", url);
  }

  function toggleMute() {
    setMuted((value) => {
      const next = !value;
      localStorage.setItem("forever-muted", String(next));
      audio.current.setMuted(next);
      return next;
    });
  }
  function setVolume(value: number) {
    setVolumeState(value);
    localStorage.setItem("forever-volume", String(value));
    audio.current.setVolume(value);
  }
  function setTextScale(value: number) {
    setTextScaleState(value);
    localStorage.setItem("forever-text-scale", String(value));
  }
  function setTexture(value: number) {
    setTextureState(value);
    localStorage.setItem("forever-texture", String(value));
  }

  const payloadObjective =
    activeEvent?.type === "CHAPTER_RELEASED" &&
    [
      "ink-objective",
      "ink-riddle",
      "map",
      "active",
      "content-readable",
      "interaction-restored",
      "scene-complete",
    ].includes(animation.label)
      ? String(activeEvent.payload.objective ?? "")
      : null;
  const objective = payloadObjective || snapshot.chapter.objective || "Await the captain's signal.";
  const inspectedArtifact = snapshot.artifacts.find((artifact) => artifact.key === selectedArtifact);
  const animationSequence =
    animation.scene === "first-arrival"
      ? "firstArrival"
      : animation.scene === "session-reentry"
        ? "reentry"
        : (animation.scene ?? "dormant");
  const activePresentationPolicy = activeRequest ? policyForProgressionEvent(activeRequest.eventType) : null;
  const activePresentationSummary = activeRequest ? presentationSummary(activeRequest) : "";
  const settledPresentationPolicy = lastPresentedRequest
    ? policyForProgressionEvent(lastPresentedRequest.eventType)
    : null;
  const settledPresentationSummary = lastPresentedRequest ? presentationSummary(lastPresentedRequest) : "";

  return (
    <ProgressionSceneHost
      as="main"
      className={`voyage-shell stage-${animation.label} view-${view}${resettingJournal ? " journal-resetting" : ""}`}
      active={Boolean(activeRequest)}
      eventType={activeRequest?.eventType ?? null}
      presentationId={activeRequest?.requestId}
      status={presentationStatus}
      title={activePresentationPolicy?.globalPresentation.heading ?? "Voyage update"}
      summary={<p>{activePresentationSummary}</p>}
      announcement={activePresentationPolicy?.globalPresentation.heading ?? ""}
      politeness={activePresentationPolicy?.globalPresentation.announcement ?? "polite"}
      busy={Boolean(activeRequest)}
      skip={activeRequest ? { label: "Reveal readable result", onActivate: () => void director.skip() } : undefined}
      destination={
        activePresentationPolicy?.relevantSection
          ? {
              label: `Open ${activePresentationPolicy.relevantSection}`,
              onActivate: () => navigate(activePresentationPolicy.relevantSection!),
            }
          : undefined
      }
      fallback={presentationFallback ? <p role="alert">{presentationFallback}</p> : null}
      onHostChange={onPersistentHostChange}
      content={
        accessRevoked ? (
          <section className="player-access-revoked" role="alert" aria-labelledby="player-access-revoked-heading">
            <h1 id="player-access-revoked-heading">Invitation no longer active</h1>
            <p>Your voyage workspace has been closed. Ask the captain for a new invitation.</p>
          </section>
        ) : (
          <div
            ref={root}
            data-player-experience-root
            data-cinematic-sequence={animationSequence}
            data-journal-phase={openingPhase}
            data-journal-speed={openingSpeed}
            data-motion-mode={mode}
            style={{ "--player-text-scale": textScale, "--texture-opacity": texture } as React.CSSProperties}
          >
            <div
              className="persistent-interface"
              data-opening-actor="persistent-interface"
              aria-hidden={!journalReady}
              inert={!journalReady ? true : undefined}
            >
              <CompanionHeader
                connection={connection}
                muted={muted}
                volume={volume}
                mode={mode}
                textScale={textScale}
                texture={texture}
                canReplay={Boolean(lastRelease)}
                toggleMute={toggleMute}
                setVolume={setVolume}
                cycleMotion={cycle}
                setTextScale={setTextScale}
                setTexture={setTexture}
                replay={() =>
                  lastRelease && void playEvent(toChapterReleaseClientEvent(lastRelease), "replay", lastRelease)
                }
                onDimTargetChange={onCompanionHeaderDimChange}
              />
              <CompanionNavigation
                view={view}
                unseen={snapshot.unseen}
                navigate={navigate}
                onDimTargetChange={onCompanionDesktopDimChange}
              />
            </div>
            <div
              className="persistent-mobile-interface"
              aria-hidden={!journalReady}
              inert={!journalReady ? true : undefined}
            >
              <MobileNavigation
                view={view}
                unseen={snapshot.unseen}
                navigate={navigate}
                onDimTargetChange={onCompanionMobileDimChange}
              />
            </div>
            {(openingPhase === "ENTRY_IDLE" || openingPhase === "ENTRY_ACTIVATED") && (
              <div className="journal-opening">
                <button className="wax-open" onClick={() => void openJournal()}>
                  <span>F</span>
                  <strong>Open the journal</strong>
                  <small>Sound begins only after you choose</small>
                </button>
                {journalOpeningNotice && (
                  <p role="alert" className="journal-opening-notice">
                    {journalOpeningNotice}
                  </p>
                )}
              </div>
            )}
            {journalReady && journalOpeningNotice && (
              <p role="status" className="journal-opening-notice">
                {journalOpeningNotice}
              </p>
            )}
            <div className="physical-workspace" aria-hidden={!journalReady} inert={!journalReady ? true : undefined}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  ref={sectionFocusTarget}
                  key={view}
                  className="section-transition"
                  tabIndex={-1}
                  variants={sectionVariants(mode)}
                  initial="initial"
                  animate="enter"
                  exit="exit"
                  onAnimationComplete={(definition) => {
                    if (definition === "enter" && journalReady) {
                      sectionHeadingWithin(sectionFocusTarget.current)?.focus({ preventScroll: true });
                    }
                  }}
                  data-animation-owner="motion"
                >
                  {view === "journal" && (
                    <SceneHost
                      kind="player-section-enhancement"
                      hostKey={`journal-section-${snapshot.campaign.slug}`}
                      className="player-section-enhancement-host"
                    >
                      <JournalWorkspace
                        snapshot={snapshot}
                        mode={mode}
                        activeEvent={activeEvent}
                        openingPhase={openingPhase}
                        interactive={journalReady}
                        playbackRate={openingSpeed}
                        onSceneTargetsChange={(ready) => {
                          journalCeremonyTargets.current = ready;
                        }}
                        onAnnotationTargetChange={(ready) => {
                          journalAnnotationTarget.current = ready;
                        }}
                        onPageTurn={() =>
                          audio.current.playValidated({
                            name: "page-turn",
                            motionPolicy: policy,
                            motionOnly: true,
                            presentationValidated: true,
                            semanticLabel: "page-turn-complete",
                            allowedSemanticLabels: ["page-turn-complete"],
                          })
                        }
                      />
                      {activeEvent?.type === "CHAPTER_SOLVED" && (
                        <ChapterSolvedLocalTarget
                          eventId={activeEvent.id}
                          onChange={onChapterSolvedLocalTargetChange}
                        />
                      )}
                    </SceneHost>
                  )}
                  {view === "chart" && (
                    <VoyageChart
                      snapshot={snapshot}
                      mode={mode}
                      progressLocationKey={
                        activeEvent?.type === "MAP_LOCATION_REVEALED"
                          ? (eventPayloadKey(activeEvent) ?? undefined)
                          : undefined
                      }
                      progressRouteKey={
                        activeEvent?.type === "MAP_ROUTE_REVEALED"
                          ? (eventPayloadKey(activeEvent) ?? undefined)
                          : undefined
                      }
                      onTargetRegistrationChange={onChartTargetRegistrationChange}
                    />
                  )}
                  {view === "treasures" && (
                    <SceneHost
                      kind="player-section-enhancement"
                      hostKey={`treasure-altar-${snapshot.campaign.slug}`}
                      className="player-section-enhancement-host"
                    >
                      <TreasureAltar
                        snapshot={snapshot}
                        onArtifactTargetHandlesChange={onArtifactTargetHandlesChange}
                        onConnectionTargetHandleChange={onArtifactConnectionTargetHandleChange}
                        inspect={(key, element) => {
                          setInspectionOrigin(element);
                          setSelectedArtifact(key);
                        }}
                      />
                    </SceneHost>
                  )}
                  {view === "quests" && (
                    <SideQuestLedger
                      snapshot={snapshot}
                      mode={mode}
                      progressEvent={activeEvent}
                      onTargetRegistrationChange={(ready) => {
                        sideQuestTarget.current = ready;
                      }}
                    />
                  )}
                  {view === "log" && (
                    <ShipsLog
                      snapshot={snapshot}
                      navigate={navigate}
                      progressEventId={
                        activeEvent?.type === "JOURNAL_ANNOTATION_ADDED" ||
                        activeEvent?.type === "PLAYER_LOG_ENTRY_ADDED"
                          ? activeEvent.id
                          : undefined
                      }
                      onTargetRegistrationChange={onLogTargetRegistrationChange}
                    />
                  )}
                  {view === "finale" && (
                    <FinaleChamber
                      snapshot={snapshot}
                      mode={mode}
                      progressEventType={
                        activeEvent?.type === "FINALE_TEASED" || activeEvent?.type === "FINALE_REQUIREMENT_UPDATED"
                          ? activeEvent.type
                          : undefined
                      }
                      progressEventId={
                        activeEvent?.type === "FINALE_TEASED" || activeEvent?.type === "FINALE_REQUIREMENT_UPDATED"
                          ? activeEvent.id
                          : undefined
                      }
                      progressRequirementKey={
                        activeEvent?.type === "FINALE_REQUIREMENT_UPDATED"
                          ? (eventPayloadKey(activeEvent) ?? undefined)
                          : undefined
                      }
                      onTargetRegistrationChange={onFinaleTargetRegistrationChange}
                      onMechanismTargetChange={onFinaleMechanismTargetChange}
                      onMechanismStatusChange={onFinaleMechanismStatusChange}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <div
              className="persistent-objective"
              data-opening-actor="objective"
              aria-hidden={!journalReady}
              inert={!journalReady ? true : undefined}
            >
              <ObjectiveNote
                objective={objective}
                chapter={snapshot.chapter.ordinal}
                title={snapshot.chapter.title}
                hintCount={snapshot.chapter.hints?.length ?? 0}
                expanded={objectiveOpen}
                setExpanded={setObjectiveOpen}
                returnToClue={() => navigate("journal")}
              />
            </div>
            <AnimatePresence>
              {inspectedArtifact && (
                <ArtifactInspection
                  artifact={inspectedArtifact}
                  close={() => setSelectedArtifact(null)}
                  restoreFocus={inspectionOrigin}
                  onTargetHandlesChange={onInspectionTargetHandlesChange}
                />
              )}
            </AnimatePresence>
            {openingPhase !== "ENTRY_IDLE" && !journalReady && (
              <JournalOpeningScene
                animationSequence={animationSequence}
                showSkip={animation.isPlaying && animation.label !== "dark-sea"}
                skip={skipJournalOpening}
                onHostChange={onJournalOpeningHostChange}
              />
            )}
            {animation.isPlaying && animation.scene === "chapter-release" && (
              <div className="ceremony-controls">
                <span>Releasing the first seal · {animation.label.replaceAll("-", " ")}</span>
                <button onClick={() => director.skip()}>Reveal all now</button>
              </div>
            )}
            {!activeRequest && lastPresentedRequest && settledPresentationPolicy && (
              <aside
                className="progression-settled-notice"
                data-progress-event-id={lastPresentedRequest.eventId}
                data-progress-event-type={lastPresentedRequest.eventType}
                data-presentation-status={lastPresentationReceipt?.status ?? presentationStatus}
              >
                <h2>{settledPresentationPolicy.globalPresentation.heading}</h2>
                <p>{settledPresentationSummary}</p>
                <div role="group" aria-label="Voyage update actions">
                  {settledPresentationPolicy.relevantSection && (
                    <button type="button" onClick={() => navigate(settledPresentationPolicy.relevantSection!)}>
                      {lastPresentedRequest.eventType === "CHAPTER_RELEASED" && view !== "journal"
                        ? "Return to Journal"
                        : `Open ${settledPresentationPolicy.relevantSection}`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const event = eventHistory.current.get(lastPresentedRequest.eventId);
                      if (event) void playEvent(event, "replay");
                    }}
                  >
                    Replay presentation
                  </button>
                  {lastPresentationReceipt?.retryDisposition === "retryable" && (
                    <button
                      type="button"
                      onClick={() => {
                        const event = eventHistory.current.get(lastPresentedRequest.eventId);
                        if (event) void playEvent(event, "automatic");
                      }}
                    >
                      Retry presentation
                    </button>
                  )}
                  <button type="button" onClick={() => setLastPresentedRequest(null)}>
                    Dismiss
                  </button>
                </div>
              </aside>
            )}
            {presentationHistory.length > 0 && (
              <aside className="progression-history" aria-label="Presentation history" data-presentation-history>
                <details>
                  <summary>Presentation history</summary>
                  <ol>
                    {presentationHistory.map((entry) => {
                      const entryPolicy = policyForProgressionEvent(entry.eventType);
                      return (
                        <li key={entry.eventId} data-presentation-history-event={entry.eventId}>
                          <div>
                            <strong>{entryPolicy.globalPresentation.heading}</strong>
                            <small>
                              {entry.eventType} · Sequence {entry.eventSequence} · {entry.eventId}
                            </small>
                          </div>
                          <button
                            type="button"
                            data-replay-event-id={entry.eventId}
                            aria-label={`Replay ${entryPolicy.globalPresentation.heading} (${entry.eventId})`}
                            onClick={() => {
                              const event = eventHistory.current.get(entry.eventId);
                              if (event) void playEvent(event, "replay");
                            }}
                          >
                            Replay
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              </aside>
            )}
            {!animation.isPlaying && journalReady && (
              <button className="intro-replay-control" onClick={() => void openJournal(true)}>
                Replay introduction
              </button>
            )}
            <AnimationTestButton />
          </div>
        )
      }
    />
  );
}

function SceneHostHandleCapture({ onChange }: { onChange: (host: SceneHostHandle | null) => void }) {
  const host = useOptionalSceneHost();
  useLayoutEffect(() => {
    onChange(host);
    return () => onChange(null);
  }, [host, onChange]);
  return null;
}

function ChapterSolvedLocalTarget({
  eventId,
  onChange,
}: {
  eventId: string;
  onChange: (ready: ChapterSolvedLocalTargetReady | null) => void;
}) {
  const host = useOptionalSceneHost();
  const registration = useMemo(
    () => ({
      targetKey: `chapter-solved:${eventId}`,
      part: "solved-stamp",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [eventId],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(registration);

  useLayoutEffect(() => {
    if (!host || !handle) {
      onChange(null);
      return;
    }
    onChange({ eventId, host, target: handle });
    return () => onChange(null);
  }, [eventId, handle, host, onChange]);

  return (
    <span
      ref={bindTarget}
      className="chapter-solved-local-stamp"
      data-scene-part="solved-stamp"
      data-gsap-owned
      data-gsap-visual-boundary
      aria-hidden="true"
    >
      Solved
    </span>
  );
}

function JournalOpeningScene({
  animationSequence,
  showSkip,
  skip,
  onHostChange,
}: {
  animationSequence: string;
  showSkip: boolean;
  skip: () => void;
  onHostChange: (host: SceneHostHandle | null) => void;
}) {
  return (
    <SceneHost
      kind="journal-opening"
      hostKey={JOURNAL_OPENING_HOST_KEY}
      className={`voyage-introduction intro-${animationSequence}`}
      data-opening-actor="introduction"
      role="status"
      aria-live="polite"
    >
      <SceneHostHandleCapture onChange={onHostChange} />
      <JournalOpeningTargets showSkip={showSkip} skip={skip} />
    </SceneHost>
  );
}

function JournalOpeningTargets({ showSkip, skip }: { showSkip: boolean; skip: () => void }) {
  const title = useMemo(
    () => ({
      targetKey: "journal-opening:title",
      part: "title",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "clip-path", "opacity"] as const,
    }),
    [],
  );
  const horizon = useMemo(
    () => ({
      targetKey: "journal-opening:horizon",
      part: "horizon",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [],
  );
  const ocean = useMemo(
    () => ({
      targetKey: "journal-opening:ocean",
      part: "ocean",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [],
  );
  const fog = useMemo(
    () => ({
      targetKey: "journal-opening:fog-front",
      part: "fog-front",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [],
  );
  const emblem = useMemo(
    () => ({
      targetKey: "journal-opening:emblem",
      part: "emblem",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [],
  );
  const arrivalCopy = useMemo(
    () => ({
      targetKey: "journal-opening:arrival-copy",
      part: "arrival-copy",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [],
  );
  const arrivalAction = useMemo(
    () => ({
      targetKey: "journal-opening:arrival-action",
      part: "arrival-action",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [],
  );
  const { bindTarget: bindTitle } = useSceneTargetRegistration(title);
  const { bindTarget: bindHorizon } = useSceneTargetRegistration(horizon);
  const { bindTarget: bindOcean } = useSceneTargetRegistration(ocean);
  const { bindTarget: bindFog } = useSceneTargetRegistration(fog);
  const { bindTarget: bindEmblem } = useSceneTargetRegistration(emblem);
  const { bindTarget: bindArrivalCopy } = useSceneTargetRegistration(arrivalCopy);
  const { bindTarget: bindArrivalAction } = useSceneTargetRegistration(arrivalAction);

  return (
    <>
      <div ref={bindHorizon} className="intro-horizon" data-scene-part="horizon" data-gsap-owned aria-hidden="true" />
      <div ref={bindOcean} className="intro-wave" data-scene-part="ocean" data-gsap-owned aria-hidden="true" />
      <div ref={bindFog} className="intro-fog" data-scene-part="fog-front" data-gsap-owned aria-hidden="true" />
      <div ref={bindTitle} className="intro-title" data-scene-part="title" data-gsap-owned>
        <span>The Forever Treasure</span>
        <small>Voyage Companion</small>
      </div>
      <div ref={bindEmblem} className="intro-emblem" data-scene-part="emblem" data-gsap-owned aria-hidden="true">
        ✦
      </div>
      <p ref={bindArrivalCopy} data-scene-part="arrival-copy" data-gsap-owned>
        The journal wakes beneath paired stars.
      </p>
      <div
        ref={bindArrivalAction}
        className="intro-action-cue"
        data-scene-part="arrival-action"
        data-gsap-owned
        aria-hidden="true"
      >
        ✦
      </div>
      {showSkip && <button onClick={skip}>Skip ceremony</button>}
    </>
  );
}
