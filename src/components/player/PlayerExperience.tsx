"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type {
  AnimationSceneName,
  JournalPhaseOutcome,
  PresentationOutcome,
  SceneRequestSource,
} from "@/animation/core/animation-types";
import { AudioCuePlayer, type AudioCueName } from "@/animation/core/audio-cues";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { sectionVariants } from "@/animation/motion/variants";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import {
  isJournalInteractive,
  waitForJournalPhase,
  type JournalOpeningPhase,
} from "@/animation/journal/opening-machine";
import type { ClientProgressEvent, PublicSnapshot, ReplayablePresentation } from "@/domain/story";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";
import {
  canUseReadableChapterFallback,
  decideChapterPresentation,
  journalPhaseDisposition,
  presentationDiagnostic,
  receiptValidatesAudio,
  shouldSuppressChapterViewed,
  toChapterReleaseClientEvent,
} from "./presentation-policy";
import { ArtifactInspection } from "./workspace/ArtifactInspection";
import { CompanionHeader } from "./workspace/CompanionHeader";
import { CompanionNavigation, MobileNavigation } from "./workspace/CompanionNavigation";
import { FinaleChamber } from "./workspace/FinaleChamber";
import { JournalWorkspace } from "./workspace/JournalWorkspace";
import { ObjectiveNote } from "./workspace/ObjectiveNote";
import { ShipsLog } from "./workspace/ShipsLog";
import { SideQuestLedger } from "./workspace/SideQuestLedger";
import { TreasureAltar } from "./workspace/TreasureAltar";
import { companionViews, type CompanionView } from "./workspace/types";
import { VoyageChart } from "./workspace/VoyageChart";

const sceneByEvent: Partial<Record<ClientProgressEvent["type"], AnimationSceneName>> = {
  CHAPTER_RELEASED: "chapter-release",
  CHAPTER_SOLVED: "mark-solved",
  ARTIFACT_AWARDED: "artifact-award",
  ARTIFACT_SILHOUETTE_REVEALED: "artifact-award",
  ARTIFACT_CONNECTED: "artifact-connection",
  MAP_LOCATION_REVEALED: "map-reveal",
  MAP_ROUTE_REVEALED: "route-draw",
  SIDE_QUEST_DISCOVERED: "quest-discovery",
  SIDE_QUEST_UPDATED: "quest-discovery",
  SIDE_QUEST_COMPLETED: "quest-complete",
  JOURNAL_ANNOTATION_ADDED: "log-entry",
  PLAYER_LOG_ENTRY_ADDED: "log-entry",
  FINALE_TEASED: "finale-tease",
  FINALE_REQUIREMENT_UPDATED: "finale-requirement",
  CAMPAIGN_PAUSED: "pause",
  CAMPAIGN_RESUMED: "resume",
  STATE_REVERTED: "undo",
};

const cueByEvent: Partial<Record<ClientProgressEvent["type"], { name: AudioCueName; semanticLabel: string }>> = {
  CHAPTER_RELEASED: { name: "wax-crack", semanticLabel: "seal" },
  CHAPTER_SOLVED: { name: "stamp-impact", semanticLabel: "captain-stamp" },
  ARTIFACT_AWARDED: { name: "artifact-chime", semanticLabel: "artifact-settled" },
  MAP_LOCATION_REVEALED: { name: "compass-click", semanticLabel: "marker-stamp" },
  MAP_ROUTE_REVEALED: { name: "map-scratch", semanticLabel: "route-drawing" },
  FINALE_TEASED: { name: "mechanism-hum", semanticLabel: "mechanism-wakes" },
  CAMPAIGN_PAUSED: { name: "pause-wind-down", semanticLabel: "pause-stamp" },
  STATE_REVERTED: { name: "undo-reverse", semanticLabel: "ink-absorbing" },
};

const PLAYER_PROGRESSION_HOST_ID = "player-progression-host";
const JOURNAL_OPENING_HOST_ID = "player-journal-opening-host";

type PresentationFailure = {
  eventId: string;
  requestSource: SceneRequestSource;
  outcome: PresentationOutcome | "snapshot-unavailable" | "compatible-host-unavailable" | "acknowledgment-failed";
  diagnostic: string;
};

type CeremonyGate = {
  eventId: string;
  status: "checking" | "pending" | "acknowledged";
};

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

function waitForMountedElement(root: HTMLElement, selector: string, signal: AbortSignal, timeoutMs = 1_800) {
  return new Promise<boolean>((resolve) => {
    const deadline = performance.now() + timeoutMs;
    let frame = 0;
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      if (frame) window.cancelAnimationFrame(frame);
    };
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onAbort = () => settle(false);
    const check = () => {
      if (signal.aborted) return settle(false);
      const match = root.querySelector<HTMLElement>(selector);
      if (match?.isConnected) return settle(true);
      if (performance.now() >= deadline) return settle(false);
      frame = window.requestAnimationFrame(check);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    check();
  });
}

export function PlayerExperience({ initialSnapshot }: { initialSnapshot: PublicSnapshot }) {
  const root = useRef<HTMLElement>(null);
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
  const lastReleaseRef = useRef<ReplayablePresentation | null>(
    initialSnapshot.latestChapterReleasePresentation ?? null,
  );
  const [activeEvent, setActiveEvent] = useState<ClientProgressEvent | null>(null);
  const [pendingMandatoryEventId, setPendingMandatoryEventId] = useState<string | null>(null);
  const pendingMandatoryEventRef = useRef<string | null>(null);
  const [ceremonyGate, setCeremonyGate] = useState<CeremonyGate | null>(() =>
    initialSnapshot.latestChapterReleasePresentation
      ? { eventId: initialSnapshot.latestChapterReleasePresentation.eventId, status: "checking" }
      : null,
  );
  const [presentationFailure, setPresentationFailure] = useState<PresentationFailure | null>(null);
  const [staticChapterFallback, setStaticChapterFallback] = useState<ReplayablePresentation | null>(null);
  const [journalOpeningNotice, setJournalOpeningNotice] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [inspectionOrigin, setInspectionOrigin] = useState<HTMLElement | null>(null);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [textScale, setTextScaleState] = useState(1);
  const [texture, setTextureState] = useState(1);
  const [openingSpeed, setOpeningSpeed] = useState<0.25 | 0.5 | 1>(1);
  const eventChain = useRef<Promise<void>>(Promise.resolve());
  const openingRun = useRef<AbortController | null>(null);
  const presentationRun = useRef<AbortController | null>(null);
  const replayMutationGuard = useRef(false);
  const replayGuardTimer = useRef<number | null>(null);
  const openingBusy = useRef(false);
  const seenEvents = useRef(new Set<string>());
  const acknowledgedEvents = useRef(new Set<string>());
  const automaticPresentationAttempts = useRef(new Set<string>());
  const acknowledgmentRequests = useRef(new Map<string, Promise<boolean>>());
  const latestSequence = useRef(initialSnapshot.sequence);
  const audio = useRef(new AudioCuePlayer());
  const { director, snapshot: animation } = useAnimationDirector();
  const { mode, policy, cycle } = useMotionMode();
  const previousMotionMode = useRef(mode);
  const journalReady = isJournalInteractive(openingPhase);

  useEffect(() => {
    const audioEngine = audio.current;
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
      if (replayGuardTimer.current !== null) window.clearTimeout(replayGuardTimer.current);
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
    const response = await fetch(`/api/player/${initialSnapshot.campaign.slug}/snapshot`, { cache: "no-store" });
    if (!response.ok) throw new Error("The latest voyage state could not be loaded.");
    const next = (await response.json()) as PublicSnapshot;
    latestSequence.current = Math.max(latestSequence.current, next.sequence);
    snapshotRef.current = next;
    setSnapshot(next);
    const nextRelease = next.latestChapterReleasePresentation ?? null;
    lastReleaseRef.current = nextRelease;
    setLastRelease(nextRelease);
    setStaticChapterFallback((current) =>
      current && nextRelease && current.eventId === nextRelease.eventId ? nextRelease : null,
    );
    setCeremonyGate((current) => {
      if (!nextRelease) return null;
      return current?.eventId === nextRelease.eventId ? current : { eventId: nextRelease.eventId, status: "checking" };
    });
    if (!nextRelease) {
      pendingMandatoryEventRef.current = null;
      setPendingMandatoryEventId(null);
      setPresentationFailure(null);
    }
    return next;
  }, [initialSnapshot.campaign.slug]);

  const acknowledgeCeremony = useCallback(
    (eventId: string) => {
      if (acknowledgedEvents.current.has(eventId)) return Promise.resolve(true);
      const existing = acknowledgmentRequests.current.get(eventId);
      if (existing) return existing;
      const request = (async () => {
        try {
          const response = await fetch(`/api/player/${initialSnapshot.campaign.slug}/viewed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, deviceId: deviceId() }),
          });
          if (!response.ok) throw new Error("Ceremony acknowledgement was rejected.");
          acknowledgedEvents.current.add(eventId);
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

  const playEvent = useCallback(
    async (
      incomingEvent: ClientProgressEvent,
      requestSource: Extract<SceneRequestSource, "automatic" | "replay"> = "automatic",
      suppliedRelease?: ReplayablePresentation,
    ) => {
      const chapterRelease = incomingEvent.type === "CHAPTER_RELEASED";
      if (chapterRelease && requestSource === "automatic") {
        automaticPresentationAttempts.current.add(incomingEvent.id);
        pendingMandatoryEventRef.current = incomingEvent.id;
        flushSync(() => {
          setPendingMandatoryEventId(incomingEvent.id);
          setCeremonyGate({ eventId: incomingEvent.id, status: "pending" });
          setPresentationFailure(null);
          setStaticChapterFallback(null);
        });
      } else if (chapterRelease) {
        flushSync(() => setStaticChapterFallback(null));
      }

      const recordFailure = (failure: Omit<PresentationFailure, "eventId" | "requestSource">) => {
        setPresentationFailure({ eventId: incomingEvent.id, requestSource, ...failure });
      };

      const host = root.current;
      if (!host) {
        if (chapterRelease) {
          recordFailure({
            outcome: "compatible-host-unavailable",
            diagnostic: `event=${incomingEvent.id} outcome=compatible-host-unavailable`,
          });
        }
        return;
      }

      let release = suppliedRelease;
      if (chapterRelease && !release) {
        const current = snapshotRef.current.latestChapterReleasePresentation;
        if (current?.eventId === incomingEvent.id) release = current;
        else {
          try {
            const refreshed = await refreshSnapshot();
            if (refreshed.latestChapterReleasePresentation?.eventId === incomingEvent.id) {
              release = refreshed.latestChapterReleasePresentation;
            }
          } catch {
            setConnection("adrift");
          }
        }
      }

      if (chapterRelease && (!release || release.eventId !== incomingEvent.id)) {
        recordFailure({
          outcome: "snapshot-unavailable",
          diagnostic: `event=${incomingEvent.id} outcome=snapshot-unavailable`,
        });
        return;
      }

      const event = release ? toChapterReleaseClientEvent(release) : incomingEvent;
      if (release) {
        lastReleaseRef.current = release;
        setLastRelease(release);
      }
      const scene = sceneByEvent[event.type];
      if (!scene) {
        if (requestSource === "automatic") {
          await refreshSnapshot().catch(() => setConnection("adrift"));
        }
        return;
      }

      presentationRun.current?.abort();
      const controller = new AbortController();
      presentationRun.current = controller;
      if (requestSource === "replay") {
        if (replayGuardTimer.current !== null) window.clearTimeout(replayGuardTimer.current);
        replayMutationGuard.current = true;
      }
      const previousView = viewRef.current;
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const switchedToJournal = chapterRelease && previousView !== "journal";
      flushSync(() => {
        if (switchedToJournal) {
          viewRef.current = "journal";
          setView("journal");
        }
        setActiveEvent(event);
      });

      try {
        if (
          chapterRelease &&
          !(await waitForMountedElement(host, "[data-scene-part='sealed-parchment']", controller.signal))
        ) {
          recordFailure({
            outcome: "compatible-host-unavailable",
            diagnostic: `event=${event.id} outcome=compatible-host-unavailable`,
          });
          return;
        }

        const receipt = await director.play(scene, {
          root: host,
          hostId: PLAYER_PROGRESSION_HOST_ID,
          hostKind: chapterRelease ? "player-progression" : "progression",
          requestSource,
          eventOrActionId: event.id,
          signal: controller.signal,
          display: event.payload as Record<string, string | number | boolean>,
          telemetryContext: {
            route: "/tale",
            playerSection: chapterRelease ? "journal" : viewRef.current,
          },
          queue: true,
          ...(release
            ? {
                presentationFallback: async (context) => {
                  if (
                    !canUseReadableChapterFallback(
                      context.motionPolicy.level,
                      Boolean(release),
                      Boolean(context.signal?.aborted),
                    )
                  ) {
                    return {
                      completed: false as const,
                      readable: false,
                      reason: "readable-fallback-requires-reduced-motion",
                    };
                  }
                  flushSync(() => setStaticChapterFallback(release));
                  await nextFrame();
                  const fallback = host.querySelector<HTMLElement>("[data-chapter-readable-fallback]");
                  const readable =
                    fallback?.dataset.eventId === release.eventId &&
                    fallback.isConnected &&
                    Boolean(fallback.textContent?.includes(release.payload.title)) &&
                    Boolean(fallback.textContent?.includes(release.payload.objective));
                  return readable
                    ? { completed: true as const, readable: true as const, semanticState: "chapter-readable" }
                    : {
                        completed: false as const,
                        readable: false,
                        reason: "readable-fallback-verification-failed",
                      };
                },
              }
            : {}),
        });

        const cue = cueByEvent[event.type];
        if (cue) {
          const validated = receiptValidatesAudio(receipt, cue.semanticLabel);
          audio.current.playValidated({
            name: cue.name,
            motionPolicy: receipt.motionPolicy,
            motionOnly: true,
            presentationValidated: validated,
            semanticLabel: validated ? cue.semanticLabel : null,
            allowedSemanticLabels: [cue.semanticLabel],
          });
        }

        if (chapterRelease) {
          const alreadyAcknowledged = acknowledgedEvents.current.has(event.id);
          const decision = decideChapterPresentation(receipt, alreadyAcknowledged);
          if (decision.shouldAcknowledge) {
            const acknowledged = await acknowledgeCeremony(event.id);
            if (acknowledged) {
              pendingMandatoryEventRef.current = null;
              setPendingMandatoryEventId(null);
              setCeremonyGate({ eventId: event.id, status: "acknowledged" });
              setPresentationFailure(null);
            } else {
              recordFailure({
                outcome: "acknowledgment-failed",
                diagnostic: `event=${event.id} scene=${receipt.sceneName} instance=${receipt.sceneInstanceId} outcome=acknowledgment-failed`,
              });
            }
          } else if (decision.retryable) {
            recordFailure({ outcome: receipt.outcome, diagnostic: presentationDiagnostic(receipt) });
          } else if (decision.completed && alreadyAcknowledged) {
            pendingMandatoryEventRef.current = null;
            setPendingMandatoryEventId(null);
            setCeremonyGate({ eventId: event.id, status: "acknowledged" });
            setPresentationFailure(null);
          } else if (requestSource === "replay" && !pendingMandatoryEventRef.current) {
            setPresentationFailure(null);
          }
        }
      } catch {
        if (chapterRelease) {
          recordFailure({
            outcome: "runtime-failed",
            diagnostic: `event=${event.id} scene=${scene} outcome=director-rejected`,
          });
        }
      } finally {
        if (requestSource === "automatic") {
          await refreshSnapshot().catch(() => setConnection("adrift"));
        }
        setActiveEvent(null);
        if (switchedToJournal) {
          flushSync(() => {
            viewRef.current = previousView;
            setView(previousView);
          });
          if (host.isConnected) {
            await waitForMountedElement(host, "[data-section-heading]", controller.signal, 1_800);
            const focusTarget = previousFocus?.isConnected
              ? previousFocus
              : host.querySelector<HTMLElement>("[data-section-heading]");
            focusTarget?.focus({ preventScroll: true });
          }
        }
        if (presentationRun.current === controller) presentationRun.current = null;
        if (requestSource === "replay") {
          replayGuardTimer.current = window.setTimeout(() => {
            replayMutationGuard.current = false;
            replayGuardTimer.current = null;
          }, 50);
        }
      }
    },
    [acknowledgeCeremony, director, refreshSnapshot],
  );

  useEffect(() => {
    const source = new EventSource(
      `/api/player/${initialSnapshot.campaign.slug}/events?after=${latestSequence.current}`,
    );
    const offline = () => setConnection("adrift");
    const online = () => {
      setConnection("connecting");
      void refreshSnapshot()
        .then(() => setConnection("live"))
        .catch(() => setConnection("adrift"));
    };
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("adrift");
    source.addEventListener("progression", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as ClientProgressEvent;
      if (seenEvents.current.has(event.id)) return;
      seenEvents.current.add(event.id);
      latestSequence.current = Math.max(latestSequence.current, event.sequence);
      eventChain.current = eventChain.current.then(() => playEvent(event)).catch(() => undefined);
    });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      source.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [initialSnapshot.campaign.slug, playEvent, refreshSnapshot]);

  useEffect(() => {
    const report = (disconnected = false) => {
      if (replayMutationGuard.current) return Promise.resolve(undefined);
      return fetch(`/api/player/${snapshot.campaign.slug}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId(),
          route: `${location.pathname}#${view}`,
          visibility: document.visibilityState,
          acknowledgedSequence: snapshot.sequence,
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
  }, [snapshot.campaign.slug, snapshot.sequence, view]);

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
    const release = lastRelease;
    if (!journalReady || !release || ceremonyGate?.eventId !== release.eventId || ceremonyGate.status !== "checking") {
      return;
    }

    const controller = new AbortController();
    const reconcilePersistedCeremony = async () => {
      const query = new URLSearchParams({ eventId: release.eventId, deviceId: deviceId() });
      try {
        const response = await fetch(`/api/player/${snapshot.campaign.slug}/viewed?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Ceremony status could not be loaded.");
        const status = (await response.json()) as { acknowledged?: unknown };
        if (controller.signal.aborted) return;
        if (status.acknowledged === true) {
          acknowledgedEvents.current.add(release.eventId);
          pendingMandatoryEventRef.current = null;
          setPendingMandatoryEventId(null);
          setPresentationFailure(null);
          setCeremonyGate({ eventId: release.eventId, status: "acknowledged" });
          return;
        }

        pendingMandatoryEventRef.current = release.eventId;
        setPendingMandatoryEventId(release.eventId);
        setCeremonyGate({ eventId: release.eventId, status: "pending" });
        if (!automaticPresentationAttempts.current.has(release.eventId)) {
          void playEvent(toChapterReleaseClientEvent(release), "automatic", release);
        }
      } catch {
        if (controller.signal.aborted) return;
        pendingMandatoryEventRef.current = release.eventId;
        setPendingMandatoryEventId(release.eventId);
        setCeremonyGate({ eventId: release.eventId, status: "pending" });
        setConnection("adrift");
        setPresentationFailure({
          eventId: release.eventId,
          requestSource: "automatic",
          outcome: "snapshot-unavailable",
          diagnostic: `event=${release.eventId} outcome=ceremony-status-unavailable`,
        });
      }
    };
    void reconcilePersistedCeremony();
    return () => controller.abort();
  }, [ceremonyGate, journalReady, lastRelease, playEvent, snapshot.campaign.slug]);

  useEffect(() => {
    if (!journalReady || replayMutationGuard.current) return;
    const failedAutomaticChapter =
      presentationFailure?.requestSource === "automatic" ? presentationFailure.eventId : null;
    const unresolvedPersistedCeremony = Boolean(lastRelease && ceremonyGate?.status !== "acknowledged");
    if (
      view === "journal" &&
      shouldSuppressChapterViewed(pendingMandatoryEventId, failedAutomaticChapter, unresolvedPersistedCeremony)
    ) {
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
    ceremonyGate,
    journalReady,
    lastRelease,
    pendingMandatoryEventId,
    presentationFailure,
    refreshSnapshot,
    snapshot,
    view,
  ]);

  async function retryChapterPresentation() {
    let release = lastReleaseRef.current;
    if (presentationFailure && release?.eventId !== presentationFailure.eventId) {
      try {
        const refreshed = await refreshSnapshot();
        release = refreshed.latestChapterReleasePresentation ?? null;
      } catch {
        setConnection("adrift");
        return;
      }
    }
    if (!release || (presentationFailure && release.eventId !== presentationFailure.eventId)) return;
    await playEvent(toChapterReleaseClientEvent(release), "automatic", release);
  }

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
      const prelude = await director.play(first ? "first-arrival" : "session-reentry", {
        root: root.current,
        hostId: JOURNAL_OPENING_HOST_ID,
        hostKind: "arrival",
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

  return (
    <main
      ref={root}
      className={`voyage-shell stage-${animation.label} view-${view}${resettingJournal ? " journal-resetting" : ""}`}
      data-cinematic-sequence={animationSequence}
      data-journal-phase={openingPhase}
      data-journal-speed={openingSpeed}
      data-motion-mode={mode}
      data-scene-host-id={PLAYER_PROGRESSION_HOST_ID}
      data-scene-host-kind="player-progression"
      data-journal-scene-host-id={JOURNAL_OPENING_HOST_ID}
      style={{ "--player-text-scale": textScale, "--texture-opacity": texture } as React.CSSProperties}
    >
      <div className="ocean-depth" data-scene-part="workspace-light" data-gsap-owned aria-hidden="true">
        <div data-scene-part="sky" data-gsap-owned />
        <div data-scene-part="horizon" data-gsap-owned />
        <div data-scene-part="ocean" data-gsap-owned />
        <div data-scene-part="fog-back" data-gsap-owned />
        <div data-scene-part="fog-front" data-gsap-owned />
      </div>
      <div className="player-lantern" data-scene-part="lantern" data-gsap-owned aria-hidden="true">
        <i />
        <b />
      </div>
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
          canReplay={Boolean(lastRelease && ceremonyGate?.status === "acknowledged")}
          toggleMute={toggleMute}
          setVolume={setVolume}
          cycleMotion={cycle}
          setTextScale={setTextScale}
          setTexture={setTexture}
          replay={() => lastRelease && void playEvent(toChapterReleaseClientEvent(lastRelease), "replay", lastRelease)}
        />
        <CompanionNavigation view={view} unseen={snapshot.unseen} navigate={navigate} />
      </div>
      <div className="persistent-mobile-interface" aria-hidden={!journalReady} inert={!journalReady ? true : undefined}>
        <MobileNavigation view={view} unseen={snapshot.unseen} navigate={navigate} />
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
            key={view}
            className="section-transition"
            variants={sectionVariants(mode)}
            initial="initial"
            animate="enter"
            exit="exit"
            onAnimationComplete={(definition) => {
              if (definition === "enter" && journalReady) {
                document.querySelector<HTMLElement>("[data-section-heading]")?.focus({ preventScroll: true });
              }
            }}
            data-animation-owner="motion"
          >
            {view === "journal" && (
              <JournalWorkspace
                snapshot={snapshot}
                mode={mode}
                activeEvent={activeEvent}
                openingPhase={openingPhase}
                interactive={journalReady}
                playbackRate={openingSpeed}
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
            )}
            {view === "chart" && <VoyageChart snapshot={snapshot} mode={mode} />}
            {view === "treasures" && (
              <TreasureAltar
                snapshot={snapshot}
                inspect={(key, element) => {
                  setInspectionOrigin(element);
                  setSelectedArtifact(key);
                }}
              />
            )}
            {view === "quests" && <SideQuestLedger snapshot={snapshot} mode={mode} />}
            {view === "log" && <ShipsLog snapshot={snapshot} navigate={navigate} />}
            {view === "finale" && <FinaleChamber snapshot={snapshot} mode={mode} />}
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
          />
        )}
      </AnimatePresence>
      {openingPhase !== "ENTRY_IDLE" && !journalReady && (
        <div
          className={`voyage-introduction intro-${animationSequence}`}
          data-opening-actor="introduction"
          role="status"
          aria-live="polite"
        >
          <div className="intro-horizon" data-scene-part="horizon" data-gsap-owned aria-hidden="true" />
          <div className="intro-wave" data-scene-part="ocean" data-gsap-owned aria-hidden="true" />
          <div className="intro-fog" data-scene-part="fog-front" data-gsap-owned aria-hidden="true" />
          <div className="intro-title" data-scene-part="title" data-gsap-owned>
            <span>The Forever Treasure</span>
            <small>Voyage Companion</small>
          </div>
          <div className="intro-emblem" data-scene-part="emblem" data-gsap-owned aria-hidden="true">
            ✦
          </div>
          <p data-scene-part="arrival-copy" data-gsap-owned>
            The journal wakes beneath paired stars.
          </p>
          <div className="intro-action-cue" data-scene-part="arrival-action" data-gsap-owned aria-hidden="true">
            ✦
          </div>
          {animation.isPlaying && animation.label !== "dark-sea" && (
            <button onClick={skipJournalOpening}>Skip ceremony</button>
          )}
        </div>
      )}
      {(activeEvent?.type === "CHAPTER_SOLVED" || activeEvent?.type === "STATE_REVERTED") && (
        <div
          className="progression-mark"
          data-scene-part={activeEvent.type === "CHAPTER_SOLVED" ? "solved-stamp" : "undo-mark"}
          data-gsap-owned
          role="status"
        >
          {activeEvent.type === "CHAPTER_SOLVED" ? "SOLVED" : "RESTORED"}
        </div>
      )}
      {activeEvent && <PlayerProgressionProp event={activeEvent} />}
      {staticChapterFallback && (
        <section
          className="chapter-readable-fallback"
          data-chapter-readable-fallback
          data-event-id={staticChapterFallback.eventId}
          role="status"
          aria-live="polite"
        >
          <p>Chapter {staticChapterFallback.payload.ordinal}</p>
          <h2>{staticChapterFallback.payload.title}</h2>
          <p>{staticChapterFallback.payload.narrative}</p>
          <strong>{staticChapterFallback.payload.objective}</strong>
          {staticChapterFallback.payload.riddle && <p>{staticChapterFallback.payload.riddle}</p>}
        </section>
      )}
      {presentationFailure && (
        <aside className="presentation-retry" role="alert" aria-live="assertive">
          <p>The chapter ceremony could not be completed. Your progress is safe; try it again.</p>
          {process.env.NODE_ENV !== "production" && <code>{presentationFailure.diagnostic}</code>}
          <button onClick={() => void retryChapterPresentation()}>Retry ceremony</button>
        </aside>
      )}
      {animation.isPlaying && animation.scene === "chapter-release" && (
        <div className="ceremony-controls">
          <span>Releasing the first seal · {animation.label.replaceAll("-", " ")}</span>
          <button onClick={() => director.skip()}>Reveal all now</button>
        </div>
      )}
      {!animation.isPlaying && lastRelease && ceremonyGate?.status === "acknowledged" && journalReady && (
        <button
          className="replay-control"
          onClick={() => void playEvent(toChapterReleaseClientEvent(lastRelease), "replay", lastRelease)}
        >
          Replay ceremony
        </button>
      )}
      {!animation.isPlaying && journalReady && (
        <button className="intro-replay-control" onClick={() => void openJournal(true)}>
          Replay introduction
        </button>
      )}
      <AnimationTestButton />
    </main>
  );
}

function PlayerProgressionProp({ event }: { event: ClientProgressEvent }) {
  if (["ARTIFACT_AWARDED", "ARTIFACT_SILHOUETTE_REVEALED"].includes(event.type)) {
    return (
      <div className="player-event-prop artifact-event-prop" aria-hidden="true">
        <div data-scene-part="artifact-light" data-gsap-owned />
        <div data-scene-part="artifact-reveal" data-gsap-owned>
          ✦
        </div>
        <div data-scene-part="artifact-slot-target" />
      </div>
    );
  }
  if (["MAP_LOCATION_REVEALED", "MAP_ROUTE_REVEALED"].includes(event.type)) {
    return (
      <div className="player-event-prop map-event-prop" aria-hidden="true">
        <div data-scene-part="map-fog" data-gsap-owned />
        <svg viewBox="0 0 460 220">
          <path data-scene-part="route-path" data-gsap-owned d="M20 180C140 35 310 40 440 160" />
        </svg>
        <i data-scene-part="map-marker-new" data-gsap-owned>
          ✦
        </i>
      </div>
    );
  }
  if (["ARTIFACT_CONNECTED"].includes(event.type)) {
    return (
      <svg className="player-event-prop connection-event-prop" viewBox="0 0 460 220" aria-hidden="true">
        <path data-scene-part="artifact-connection-path" data-gsap-owned d="M30 170Q230 20 430 170" />
      </svg>
    );
  }
  if (["SIDE_QUEST_DISCOVERED", "SIDE_QUEST_UPDATED", "SIDE_QUEST_COMPLETED"].includes(event.type)) {
    return (
      <div className="player-event-prop quest-event-prop" aria-hidden="true">
        <div data-scene-part="quest-note-new" data-gsap-owned>
          OPTIONAL COURSE
        </div>
        <svg viewBox="0 0 460 220">
          <path data-scene-part="red-thread" data-gsap-owned d="M20 180C150 20 310 35 440 170" />
        </svg>
        <i data-scene-part="quest-stamp" data-gsap-owned>
          COMPLETE
        </i>
      </div>
    );
  }
  if (["JOURNAL_ANNOTATION_ADDED", "PLAYER_LOG_ENTRY_ADDED"].includes(event.type)) {
    return (
      <div
        className="player-event-prop log-event-prop"
        data-scene-part="log-entry-new"
        data-gsap-owned
        aria-hidden="true"
      >
        <i data-scene-part="log-symbol-new" data-gsap-owned>
          ✦
        </i>
      </div>
    );
  }
  if (["FINALE_TEASED", "FINALE_REQUIREMENT_UPDATED"].includes(event.type)) {
    return (
      <div className="player-event-prop finale-event-prop" aria-hidden="true">
        <i data-scene-part="finale-ring-outer" data-gsap-owned />
        <i data-scene-part="finale-ring-inner" data-gsap-owned />
        <svg viewBox="0 0 300 300">
          <path data-scene-part="finale-light-path" data-gsap-owned d="M150 12L278 150 150 288 22 150z" />
        </svg>
      </div>
    );
  }
  return null;
}
