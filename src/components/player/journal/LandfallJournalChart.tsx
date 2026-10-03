"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import { VoyageChart } from "@/components/player/workspace/VoyageChart";
import { LandfallPresentation } from "@/components/player/journal/LandfallPresentation";
import { LandfallContextGuidance } from "@/components/player/journal/LandfallContextGuidance";
import { LandfallPlaceSearch } from "@/components/player/journal/LandfallPlaceSearch";
import { selectReleasedChartPlace } from "@/landfall/chart-search";
import { LandfallLandmarkPanel } from "@/components/player/journal/LandfallLandmarkPanel";
import { BrowserContextProvider, type BrowserContextTarget } from "@/landfall/browser-context";
import type { ContextualEvidence, ContextualSnapshot } from "@/landfall/contextual";
import { BrowserGeolocationProvider } from "@/landfall/browser-geolocation";
import {
  createLandfallNativeDriver,
  NativeForegroundLocationProvider,
  subscribeLandfallNativeLifecycle,
} from "@/landfall/native-bridge";
import { NativeContextProvider } from "@/landfall/native-context";
import { LandfallOfflineRegionPanel } from "@/components/player/journal/LandfallOfflineRegionPanel";
import { LandfallBackgroundPanel } from "@/components/player/journal/LandfallBackgroundPanel";
import { distance } from "@/landfall/geometry";
import type { LandfallCurrentPosition } from "@/landfall/map-projection";
import { LandfallProviderRegistry } from "@/landfall/observation";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { LandfallRuntime } from "@/landfall/runtime";
import type { LandfallObservation } from "@/landfall/observation";
import type { PlayerLandfallEvidence } from "@/landfall/server-evidence";
import type { PlayerJournalBlock } from "@/chronicle/journal-contract";
import { clearLandfallOfflineData, type OfflineAvailability } from "@/landfall/offline-store";
import { createPlayerLandfallReconciler } from "@/landfall/offline-reconcile-web";
import {
  clearLandfallEvidence,
  pendingLandfallEvidence,
  queueLandfallEvidence,
  rememberRevealedChart,
  restoreOfflineVoyage,
  releaseOfflineAssets,
} from "@/landfall/offline-web";

const bootstrapCache = new Map<string, { value: PlayerLandfallBootstrap; cachedAt: number }>();
const emptyPassages: PlayerJournalBlock[] = [];

function physicalGuidance(
  position: LandfallCurrentPosition | null,
  waypoint: PlayerLandfallBootstrap["runtimeDefinition"]["waypoints"][number] | undefined,
  worldspace: PlayerLandfallBootstrap["runtimeDefinition"]["worldspaces"][number],
) {
  if (!position || !waypoint || waypoint.geometry.type !== "POINT_RADIUS" || worldspace.kind !== "PHYSICAL")
    return null;
  const center = waypoint.geometry.center;
  if (center.type !== "WGS84") return null;
  const origin = { ...center, longitude: position.coordinates[0], latitude: position.coordinates[1] };
  const meters = distance(origin, center, worldspace);
  const radians = Math.PI / 180;
  const delta = (center.longitude - origin.longitude) * radians;
  const y = Math.sin(delta) * Math.cos(center.latitude * radians);
  const x =
    Math.cos(origin.latitude * radians) * Math.sin(center.latitude * radians) -
    Math.sin(origin.latitude * radians) * Math.cos(center.latitude * radians) * Math.cos(delta);
  const bearing = (Math.atan2(y, x) / radians + 360) % 360;
  const direction = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][
    Math.round(bearing / 45) % 8
  ];
  return { meters, direction };
}

function useLandfallController({
  sessionId,
  publishedVersionId,
  mode,
  historical,
  csrfToken,
  onProgress,
  enabled,
  loadEnabled = enabled,
  revision,
  passages = emptyPassages,
}: {
  sessionId: string;
  publishedVersionId: string;
  mode: MotionMode;
  historical: boolean;
  csrfToken: string;
  onProgress: () => void;
  enabled: boolean;
  loadEnabled?: boolean;
  revision: number;
  passages?: PlayerJournalBlock[];
}) {
  const [bootstrap, setBootstrap] = useState<PlayerLandfallBootstrap | null>(null);
  const [message, setMessage] = useState("Loading Voyage Chart…");
  const [tracking, setTracking] = useState(false);
  const [browserAvailable, setBrowserAvailable] = useState(false);
  const [position, setPosition] = useState<LandfallCurrentPosition | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<OfflineAvailability | null>(null);
  const [contextSnapshot, setContextSnapshot] = useState<ContextualSnapshot | null>(null);
  const [contextTracking, setContextTracking] = useState(false);
  const [contextMessage, setContextMessage] = useState("Optional motion and heading hints are off.");
  const [landmarkObservations, setLandmarkObservations] = useState<LandfallObservation[]>([]);
  const runtime = useRef<LandfallRuntime | null>(null);
  const browser = useRef<BrowserGeolocationProvider | NativeForegroundLocationProvider | null>(null);
  const contextBrowser = useRef<BrowserContextProvider | NativeContextProvider | null>(null);
  const contextSamples = useRef<ContextualEvidence[]>([]);
  const samples = useRef<LandfallObservation[]>([]);
  const submitting = useRef(false);
  const submittedEvidenceIds = useRef(new Set<string>());
  const pendingEvidence = useRef<PlayerLandfallEvidence | null>(null);
  const initialReconcileAttempted = useRef(false);
  const loadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loadEnabled) return;
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/landfall-offline-sw.js", { scope: "/player/" }).catch(() => undefined);
  }, [loadEnabled]);

  useEffect(() => {
    const connectivity = () => {
      navigator.serviceWorker?.controller?.postMessage({ type: "LANDFALL_CONNECTIVITY", offline: !navigator.onLine });
      if (navigator.serviceWorker?.controller)
        setAvailability((value) => (value ? { ...value, shell: "READY" } : value));
    };
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    navigator.serviceWorker?.addEventListener("controllerchange", connectivity);
    connectivity();
    return () => {
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      navigator.serviceWorker?.removeEventListener("controllerchange", connectivity);
    };
  }, []);

  useEffect(() => {
    if (!loadEnabled) return;
    const abort = new AbortController();
    loadAbort.current = abort;
    let mounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!mounted) return;
      setTracking(false);
      setPosition(null);
      setContextSnapshot(null);
      setContextTracking(false);
      setLandmarkObservations([]);
      try {
        const cacheKey = `${sessionId}:${publishedVersionId}:${csrfToken}:${historical ? "history" : "live"}`;
        let offlineCacheUsed = false;
        let body: { available: false } | { available: true; bootstrap: PlayerLandfallBootstrap };
        try {
          const response = await fetch(`/api/player/playthroughs/${encodeURIComponent(sessionId)}/landfall`, {
            cache: "no-store",
            signal: abort.signal,
          });
          if (!response.ok) {
            if ([401, 403, 404, 409].includes(response.status)) {
              await clearLandfallOfflineData();
              bootstrapCache.clear();
              setBootstrap(null);
              return;
            }
            throw new Error("Voyage Chart is unavailable.");
          }
          body = (await response.json()) as typeof body;
        } catch (cause) {
          if (abort.signal.aborted) throw cause;
          const cached = bootstrapCache.get(cacheKey);
          const record = await restoreOfflineVoyage(sessionId, publishedVersionId, csrfToken);
          const restored =
            record?.bootstrap ?? (cached && Date.now() - cached.cachedAt <= 30 * 60_000 ? cached.value : null);
          if (!restored) throw cause;
          if (record) setAvailability(record.availability);
          body = { available: true, bootstrap: restored };
          offlineCacheUsed = true;
        }
        if (!mounted || abort.signal.aborted) return;
        if (!body.available) {
          bootstrapCache.delete(cacheKey);
          setMessage("");
          return;
        }
        const next = body.bootstrap;
        if (next.sessionId !== sessionId || next.publishedVersionId !== publishedVersionId)
          throw new Error("Voyage Chart version changed. Reopen the map.");
        if (historical && !next.replayOnly) throw new Error("Historical chart state is unavailable.");
        if (!offlineCacheUsed) {
          bootstrapCache.set(cacheKey, { value: next, cachedAt: Date.now() });
          while (bootstrapCache.size > 4) bootstrapCache.delete(bootstrapCache.keys().next().value!);
          void rememberRevealedChart(next, csrfToken, passages)
            .then(setAvailability)
            .catch(() => {
              setAvailability(null);
            });
        }
        const registry = new LandfallProviderRegistry();
        registry.register({
          id: "browser-geolocation",
          source: "BROWSER_GEOLOCATION",
          worldspaceKinds: ["PHYSICAL"],
          state: "AVAILABLE",
        });
        const nativeDriver = createLandfallNativeDriver();
        if (nativeDriver)
          registry.register({
            id: nativeDriver.platform === "IOS" ? "ios-core-location" : "android-location",
            source: "NATIVE_LOCATION",
            worldspaceKinds: ["PHYSICAL"],
            state: "AVAILABLE",
          });
        const active = new LandfallRuntime(next.runtimeDefinition, next, registry);
        active.setActiveWaypoint(next.activeWaypointId);
        if (next.runtimeDefinition.routes[0]?.geometry) active.setActiveRoute(next.runtimeDefinition.routes[0].id);
        runtime.current = active;
        const worldspace = next.runtimeDefinition.worldspaces[0];
        if (!historical && !next.replayOnly && next.runtimeDefinition.context && worldspace.kind === "PHYSICAL")
          contextBrowser.current = createLandfallNativeDriver()
            ? new NativeContextProvider(worldspace.id)
            : new BrowserContextProvider(window as unknown as BrowserContextTarget, worldspace.id);
        const waypoint = next.runtimeDefinition.waypoints.find((item) => item.id === next.activeWaypointId);
        if (
          worldspace.kind === "PHYSICAL" &&
          worldspace.coordinateReference.type === "WGS84" &&
          nativeDriver &&
          worldspace.observationPolicy.allowedSources.includes("NATIVE_LOCATION") &&
          waypoint?.evidenceProfile.acceptedSources.includes("NATIVE_LOCATION")
        )
          browser.current = new NativeForegroundLocationProvider(nativeDriver, worldspace);
        else if (
          worldspace.kind === "PHYSICAL" &&
          worldspace.coordinateReference.type === "WGS84" &&
          worldspace.observationPolicy.allowedSources.includes("BROWSER_GEOLOCATION") &&
          waypoint?.evidenceProfile.acceptedSources.includes("BROWSER_GEOLOCATION")
        )
          browser.current = new BrowserGeolocationProvider(navigator.geolocation ?? null, worldspace);
        setBrowserAvailable(Boolean(browser.current));
        pendingEvidence.current = await pendingLandfallEvidence(sessionId, publishedVersionId, csrfToken).catch(
          () => null,
        );
        setBootstrap(next);
        setMessage(
          offlineCacheUsed
            ? "Offline chart restored from your authorized cache. Location results are local until synchronization; no new visit is confirmed."
            : worldspace.kind === "VIRTUAL"
              ? "Virtual chart ready. No live virtual position source is connected."
              : !next.activeWaypointId
                ? "No released waypoint is ready for location evaluation."
                : !browser.current
                  ? "This physical chart has no supported browser location source."
                  : "Location is off. Use my location only while this map is open.",
        );
      } catch {
        if (mounted && !abort.signal.aborted) setMessage("Voyage Chart is unavailable.");
      }
    };
    void load();
    return () => {
      mounted = false;
      abort.abort();
      browser.current?.stop();
      contextBrowser.current?.stop();
      contextBrowser.current = null;
      contextSamples.current = [];
      browser.current = null;
      runtime.current?.pause();
      runtime.current = null;
      samples.current = [];
      setLandmarkObservations([]);
      releaseOfflineAssets();
    };
  }, [csrfToken, historical, publishedVersionId, sessionId, revision, passages, loadEnabled]);

  useEffect(() => {
    if (!tracking && !contextTracking) return;
    const timer = window.setInterval(() => {
      const fix = runtime.current?.currentPosition(Date.now());
      setContextSnapshot(runtime.current?.contextSnapshot(Date.now()) ?? null);
      if (tracking && !fix) {
        setPosition(null);
        setMessage("Location signal is stale or uncertain. Waiting for a fresh accurate fix.");
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [tracking, contextTracking]);

  useEffect(() => {
    const stopInBackground = (nativeBackground = false) => {
      if (!nativeBackground && document.visibilityState === "visible") return;
      browser.current?.stop();
      contextBrowser.current?.stop();
      contextSamples.current = [];
      samples.current = [];
      setLandmarkObservations([]);
      setContextTracking(false);
      setContextSnapshot(null);
      runtime.current?.pause();
      setTracking(false);
      setPosition(null);
      setMessage("Location is off while this tab is in the background. Use my location to resume.");
    };
    const visibility = () => stopInBackground();
    const unsubscribe = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") stopInBackground(true);
    });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      unsubscribe();
    };
  }, []);

  const stop = () => {
    browser.current?.stop();
    contextBrowser.current?.stop();
    contextSamples.current = [];
    setContextTracking(false);
    setContextSnapshot(null);
    runtime.current?.pause();
    setTracking(false);
    setPosition(null);
    samples.current = [];
    setLandmarkObservations([]);
    setMessage("Location is off. Use my location to resume.");
  };
  const sendEvidence = async (evidence: PlayerLandfallEvidence) => {
    if (submitting.current) return;
    const ephemeral = evidence.method === "LANDMARK" || evidence.method === "EVIDENCE_BUNDLE";
    if (!navigator.onLine) {
      if (ephemeral) {
        setMessage("Verification needs a connection. Use the readable fallback; no visit was recorded.");
        return;
      }
      pendingEvidence.current = evidence;
      try {
        await queueLandfallEvidence(sessionId, publishedVersionId, csrfToken, evidence);
      } catch {
        pendingEvidence.current = null;
        setMessage(
          "Offline storage is unavailable or full. No visit was recorded. Keep a connection or use a fresh reading later.",
        );
        return;
      }
      setMessage(
        "Evidence queued durably on this device for at most 90 seconds. The Voyage has not confirmed a visit. Reconnect to synchronize.",
      );
      setAvailability((value) => (value ? { ...value, pendingEvidence: 1 } : value));
      return;
    }
    submitting.current = true;
    setMessage(
      pendingEvidence.current ? "Reconciling queued evidence with the Voyage…" : "Checking arrival with the Voyage…",
    );
    try {
      const queued = pendingEvidence.current !== null;
      const reconciler = createPlayerLandfallReconciler(sessionId, csrfToken, {
        pending: () =>
          queued ? pendingLandfallEvidence(sessionId, publishedVersionId, csrfToken) : Promise.resolve(evidence),
        clearEvidence: () => clearLandfallEvidence(sessionId, publishedVersionId, csrfToken),
        revoke: () => clearLandfallOfflineData(),
      });
      const result = await reconciler.reconcile();
      if (result === "RETRY") throw new Error("LANDFALL_RETRY_REQUIRED");
      if (result === "REVOKED") {
        pendingEvidence.current = null;
        setMessage("Voyage access expired or was revoked. Sign in and verify access before continuing.");
        return;
      }
      if (result === "EMPTY" || result === "CONFLICT") {
        pendingEvidence.current = null;
        setAvailability((value) => (value ? { ...value, pendingEvidence: 0 } : value));
        setMessage(
          result === "EMPTY"
            ? "Queued evidence expired. Use a fresh reading; no new visit was confirmed."
            : "Evidence could not be reconciled because the Voyage changed or rejected it. Refresh the Chart and use a fresh reading or configured fallback.",
        );
        onProgress();
        return;
      }
      pendingEvidence.current = null;
      await clearLandfallEvidence(sessionId, publishedVersionId, csrfToken);
      setAvailability((value) => (value ? { ...value, pendingEvidence: 0 } : value));
      browser.current?.stop();
      contextBrowser.current?.stop();
      contextSamples.current = [];
      samples.current = [];
      setLandmarkObservations([]);
      setContextTracking(false);
      setContextSnapshot(null);
      runtime.current?.pause();
      setTracking(false);
      setPosition(null);
      setMessage(
        result === "DUPLICATE"
          ? "The Voyage confirms this arrival was already recorded. The Chart has been refreshed."
          : evidence.method === "PLAYER_FALLBACK"
            ? "Your confirmation was recorded without a location claim."
            : "Arrival recorded in the Voyage.",
      );
      onProgress();
    } catch {
      if (ephemeral) {
        setMessage(
          "Verification could not be recorded. Retry with fresh evidence online or use the configured fallback.",
        );
        return;
      }
      pendingEvidence.current = evidence;
      try {
        await queueLandfallEvidence(sessionId, publishedVersionId, csrfToken, evidence);
        setMessage(
          "Evidence is queued durably on this device for at most 90 seconds. Reconnect to synchronize; no visit has been confirmed.",
        );
      } catch {
        pendingEvidence.current = null;
        setMessage(
          "The evidence could not be saved offline. No visit was confirmed. Use a fresh reading when connected.",
        );
      }
    } finally {
      submitting.current = false;
    }
  };
  useEffect(() => {
    const reconnect = () => {
      if (pendingEvidence.current) void sendEvidence(pendingEvidence.current);
      else
        setMessage((current) =>
          current.includes("offline") ? "Connected. Use my location for a fresh reading." : current,
        );
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  });
  useEffect(() => {
    if (bootstrap && navigator.onLine && pendingEvidence.current && !initialReconcileAttempted.current) {
      initialReconcileAttempted.current = true;
      void sendEvidence(pendingEvidence.current);
    }
  });
  const start = () => {
    const provider = browser.current;
    const active = runtime.current;
    if (!enabled || !provider || !active || !bootstrap?.activeWaypointId || historical || bootstrap.replayOnly) return;
    active.resume();
    setTracking(true);
    setMessage("Requesting location for this open map…");
    provider.start(
      { sessionId, publishedVersionId },
      (observation) => {
        const now = Date.now();
        const outcome = active.ingest(observation, now);
        setContextSnapshot(active.contextSnapshot(now));
        if (!outcome.rejection && observation.kind === "PHYSICAL_POSITION") {
          samples.current = [...samples.current, observation].slice(-20);
          setLandmarkObservations(samples.current);
        }
        const fix = active.currentPosition(now);
        setPosition(
          fix && fix.coordinate.type === "WGS84"
            ? {
                coordinates: [fix.coordinate.longitude, fix.coordinate.latitude],
                accuracyMeters: fix.accuracy,
                confidence: outcome.confidence,
                observedAt: fix.observedAt,
              }
            : null,
        );
        setMessage(
          outcome.failure === "ROUTE_MISMATCH"
            ? bootstrap.runtimeDefinition.routes[0]?.presentation?.deviationResponse === "CAPTAIN_REVIEW"
              ? "You appear off the authored route. Pause and ask your Captain for guidance. No visit has been recorded."
              : bootstrap.runtimeDefinition.routes[0]?.presentation?.deviationResponse === "NONE"
                ? "The route check did not qualify this reading. No visit has been recorded."
                : "You appear off the authored route. Return toward the route or use an available fallback. No visit has been recorded."
            : outcome.failure === "WEAK_ACCURACY"
              ? "Location accuracy is too weak for a reliable position. Waiting for a better fix."
              : outcome.rejection
                ? "Location signal could not be used. Waiting for a fresh fix."
                : outcome.confidence === "CONFIRMED"
                  ? "Location signal is locally confirmed. No visit has been recorded."
                  : `Location signal: ${outcome.confidence.toLowerCase().replaceAll("_", " ")}. No visit has been recorded.`,
        );
        const waypoint = bootstrap.runtimeDefinition.waypoints.find((item) => item.id === bootstrap.activeWaypointId);
        if (
          waypoint &&
          (outcome.confidence === "CONFIRMED" ||
            (outcome.confidence === "LIKELY_INSIDE" &&
              (waypoint.completion.requiredOutcome === "LIKELY_INSIDE" ||
                bootstrap.contextualArrivalWaypointId === waypoint.id))) &&
          !bootstrap.paused &&
          csrfToken &&
          !submitting.current &&
          !pendingEvidence.current &&
          !submittedEvidenceIds.current.has(observation.id)
        ) {
          submittedEvidenceIds.current.add(observation.id);
          const evidence = [...samples.current];
          void sendEvidence({
            schemaVersion: 1,
            sessionId,
            publishedVersionId,
            worldspaceId: bootstrap.runtimeDefinition.worldspaces[0].id,
            waypointId: waypoint.id,
            evidenceId: observation.id,
            expectedSequence: bootstrap.currentSequence,
            idempotencyKey: crypto.randomUUID(),
            method: "FOREGROUND_LOCATION",
            observations: evidence,
          });
        }
      },
      (permission) => {
        active.setPermission(permission);
        if (permission === "DENIED" || permission === "UNAVAILABLE") {
          setTracking(false);
          setPosition(null);
          setMessage(
            permission === "DENIED"
              ? "Location permission was denied. The chart remains available without a live position."
              : "Browser location is unavailable. The chart remains available without a live position.",
          );
        }
      },
    );
  };

  const confirmFallback = async (corroborate = false) => {
    if (
      !bootstrap?.activeWaypointId ||
      (corroborate && samples.current.length < 2) ||
      !csrfToken ||
      submitting.current ||
      pendingEvidence.current ||
      bootstrap.paused ||
      historical ||
      bootstrap.replayOnly
    )
      return;
    await sendEvidence({
      schemaVersion: 1,
      sessionId,
      publishedVersionId,
      worldspaceId: bootstrap.runtimeDefinition.worldspaces[0].id,
      waypointId: bootstrap.activeWaypointId,
      evidenceId: crypto.randomUUID(),
      expectedSequence: bootstrap.currentSequence,
      idempotencyKey: crypto.randomUUID(),
      method: corroborate ? "EVIDENCE_BUNDLE" : "PLAYER_FALLBACK",
      ...(corroborate
        ? {
            sources: [
              {
                method: "FOREGROUND_LOCATION" as const,
                evidenceId: samples.current.at(-1)!.id,
                observations: [...samples.current],
              },
              { method: "PLAYER_FALLBACK" as const, evidenceId: crypto.randomUUID() },
            ],
          }
        : {}),
    });
  };

  const toggleContext = async () => {
    if (contextTracking) {
      contextBrowser.current?.stop();
      contextSamples.current = [];
      setContextTracking(false);
      setContextMessage("Optional motion and heading hints are off.");
      setContextSnapshot(runtime.current?.discardSensorHints(Date.now()) ?? null);
      return;
    }
    const provider = contextBrowser.current;
    const active = runtime.current;
    if (!enabled || historical || bootstrap?.replayOnly || bootstrap?.paused || !provider || !active) return;
    active.resume();
    await provider.start(
      { sessionId, publishedVersionId },
      (evidence) => {
        contextSamples.current = [...contextSamples.current, evidence].slice(-16);
        setContextSnapshot(active.ingestContext(evidence, Date.now()));
      },
      (permission) => {
        setContextTracking(permission === "GRANTED");
        if (permission !== "GRANTED") {
          contextSamples.current = [];
          setContextSnapshot(active.discardSensorHints(Date.now()));
        }
        setContextMessage(
          permission === "GRANTED"
            ? "Optional motion and heading hints are on while this chart is open."
            : permission === "DENIED"
              ? "Motion permission was denied. Your chart and fallback remain available."
              : permission === "UNAVAILABLE"
                ? "Motion and heading are unavailable. Your chart and fallback remain available."
                : "Requesting motion permission…",
        );
      },
      true,
    );
  };
  const confirmLandmark = async (receipt: string) => {
    if (
      !enabled ||
      historical ||
      bootstrap?.replayOnly ||
      bootstrap?.paused ||
      !bootstrap?.activeWaypointId ||
      submitting.current ||
      pendingEvidence.current
    )
      return;
    await sendEvidence({
      schemaVersion: 1,
      sessionId,
      publishedVersionId,
      worldspaceId: bootstrap.runtimeDefinition.worldspaces[0].id,
      waypointId: bootstrap.activeWaypointId,
      evidenceId: crypto.randomUUID(),
      expectedSequence: bootstrap.currentSequence,
      idempotencyKey: crypto.randomUUID(),
      method: "LANDMARK",
      landmarkReceipt: receipt,
      observations: [...samples.current],
      ...(contextSamples.current.length ? { contextualEvidence: [...contextSamples.current] } : {}),
    });
  };

  useEffect(() => {
    if (enabled) return;
    browser.current?.stop();
    contextBrowser.current?.stop();
    contextSamples.current = [];
    runtime.current?.pause();
    samples.current = [];
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setTracking(false);
        setPosition(null);
        setContextTracking(false);
        setContextSnapshot(null);
        setLandmarkObservations([]);
      }
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  useEffect(() => {
    const clear = () => {
      loadAbort.current?.abort();
      bootstrapCache.clear();
      pendingEvidence.current = null;
      browser.current?.stop();
      contextBrowser.current?.stop();
      contextSamples.current = [];
      samples.current = [];
      setLandmarkObservations([]);
      runtime.current?.pause();
      setTracking(false);
      setPosition(null);
      setContextTracking(false);
      setContextSnapshot(null);
      setBootstrap(null);
      setMessage("Offline access cleared. Sign in and reopen the Voyage to continue.");
    };
    window.addEventListener("landfall-offline-cleared", clear);
    return () => window.removeEventListener("landfall-offline-cleared", clear);
  }, []);
  return {
    bootstrap,
    message,
    tracking,
    browserAvailable,
    position,
    replayId,
    setReplayId,
    start,
    stop,
    confirmFallback,
    mode,
    availability,
    contextSnapshot,
    contextTracking,
    contextMessage,
    toggleContext,
    confirmLandmark,
    observations: landmarkObservations,
    acquisitionEnabled: enabled,
    csrfToken,
  };
}

const LandfallControllerContext = createContext<ReturnType<typeof useLandfallController> | null>(null);

/** Exactly one provider owns browser location, evidence intake and reconciliation per Journal. */
export function LandfallJournalProvider({
  children,
  ...props
}: Parameters<typeof useLandfallController>[0] & { children: ReactNode }) {
  const controller = useLandfallController(props);
  return <LandfallControllerContext.Provider value={controller}>{children}</LandfallControllerContext.Provider>;
}

export function LandfallJournalChart({
  readOnly = false,
  worldspaceId,
  blockId,
}: { readOnly?: boolean; worldspaceId?: string; blockId?: string } = {}) {
  const controller = useContext(LandfallControllerContext);
  const [historicalChart, setHistoricalChart] = useState<PlayerLandfallBootstrap | null>(null);
  const [viewingMapId, setViewingMapId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<{ mapId: string; featureId: string; scope: string } | null>(null);
  useEffect(() => {
    if (!readOnly || !blockId || !controller?.bootstrap) return;
    const abort = new AbortController();
    const sessionId = controller.bootstrap.sessionId;
    void fetch(
      `/api/player/playthroughs/${encodeURIComponent(sessionId)}/landfall?block=${encodeURIComponent(blockId)}`,
      { cache: "no-store", signal: abort.signal },
    )
      .then(async (response) => {
        if (!response.ok) return;
        const value = await response.json();
        if (value.available && value.bootstrap.replayOnly && value.bootstrap.sessionId === sessionId)
          setHistoricalChart(value.bootstrap);
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [readOnly, blockId, controller?.bootstrap]);
  if (!controller) return null;
  const {
    bootstrap: currentBootstrap,
    message,
    tracking,
    browserAvailable,
    position: livePosition,
    replayId,
    setReplayId,
    start,
    stop,
    confirmFallback,
    mode,
    availability,
    contextSnapshot,
    contextTracking,
    contextMessage,
    toggleContext,
    confirmLandmark,
    observations,
    acquisitionEnabled,
    csrfToken,
  } = controller;
  const bootstrap = readOnly && blockId ? historicalChart : currentBootstrap;
  const position = readOnly ? null : livePosition;
  if (!bootstrap)
    return (
      <p role="status">
        {readOnly && blockId
          ? "Loading the released historical Chart. A connection is needed if this snapshot was not prepared."
          : message}
      </p>
    );
  const worldspace = bootstrap.runtimeDefinition.worldspaces[0];
  if (worldspaceId && worldspaceId !== worldspace.id)
    return (
      <p role="status">
        This Passage’s Worldspace is not currently released. The current Voyage Chart remains available in the Map
        drawer.
      </p>
    );
  const activeWaypoint = bootstrap.runtimeDefinition.waypoints.find((item) => item.id === bootstrap.activeWaypointId);
  const activeRoute = bootstrap.runtimeDefinition.routes[0];
  const guidance = physicalGuidance(position, activeWaypoint, worldspace);
  const replay = bootstrap.journeyPath.find((item) => item.id === replayId);
  const viewingMap =
    bootstrap.availableMaps?.find((item) => item.id === viewingMapId) ??
    bootstrap.availableMaps?.find((item) => item.id === bootstrap.scene.mapId);
  const isHistorical = bootstrap.replayOnly || readOnly;
  const searchScope = JSON.stringify([
    bootstrap.sessionId,
    bootstrap.publishedVersionId,
    bootstrap.currentSequence,
    blockId ?? null,
    isHistorical,
  ]);
  const viewedScene = viewingMap?.scene ?? bootstrap.scene;
  const searchedScene =
    selectedPlace?.scope === searchScope && selectedPlace.mapId === viewedScene.mapId
      ? selectReleasedChartPlace(viewedScene, selectedPlace.featureId)
      : viewedScene;
  const contextual = isHistorical
    ? (replay?.contextualSummary ?? bootstrap.contextualSummary ?? null)
    : contextSnapshot;
  const landmark = bootstrap.runtimeDefinition.context?.landmarks.find(
    (item) => item.id === activeWaypoint?.landmarkId,
  );
  return (
    <div className="landfall-journal-chart" data-landfall-player-chart data-worldspace-kind={worldspace.kind}>
      <p>{bootstrap.worldspaceName}</p>
      {(bootstrap.replayOnly || readOnly) && (
        <p>Historical Landfall chart. Replay is presentation only and never requests location or changes progress.</p>
      )}
      {!bootstrap.replayOnly && !readOnly && (
        <p>
          Current objective:{" "}
          {activeWaypoint ? (activeWaypoint.visibility.publicLabel ?? activeWaypoint.name) : "No released location"}
        </p>
      )}
      {activeWaypoint?.description && <p>{activeWaypoint.description}</p>}
      {activeWaypoint?.guidance?.clue && <p>{activeWaypoint.guidance.clue}</p>}
      {activeWaypoint?.guidance?.nearbyClue &&
        position &&
        ["NEARBY", "LIKELY_INSIDE", "CONFIRMED"].includes(position.confidence) && (
          <p>{activeWaypoint.guidance.nearbyClue}</p>
        )}
      {activeWaypoint?.guidance?.wrongDirectionClue && position?.confidence === "OUTSIDE" && (
        <p>{activeWaypoint.guidance.wrongDirectionClue}</p>
      )}
      {guidance &&
        (activeWaypoint?.guidance?.showDistance ||
          activeWaypoint?.guidance?.showBearing ||
          activeRoute?.presentation?.visibility === "ROUGH_BEARING") && (
          <p>
            {activeWaypoint?.guidance?.showDistance
              ? `Approximately ${Math.round(guidance.meters / 25) * 25} meters away. `
              : ""}
            {activeWaypoint?.guidance?.showBearing || activeRoute?.presentation?.visibility === "ROUGH_BEARING"
              ? `Rough bearing: ${guidance.direction}.`
              : ""}
          </p>
        )}
      <p>
        Offline chart: {availability ? "saved" : "restored or preparing"}. First-party map assets:{" "}
        {availability?.firstPartyAssets.toLowerCase() ?? "see map availability"}.
        {bootstrap.scene.renderer === "MAPLIBRE_STYLE"
          ? " External map tiles require a connection and are unavailable offline."
          : " This authored chart does not need external tiles."}
        {availability &&
          ` Last synchronized sequence ${availability.sequence} at ${new Date(availability.synchronizedAt).toLocaleTimeString()}. Offline shell: ${availability.shell === "READY" ? "prepared" : "requires connection until prepared"}. Pending evidence: ${availability.pendingEvidence}.`}
      </p>
      {bootstrap.paused && (
        <p role="status">The Captain paused Landfall progression. Current chart details remain readable.</p>
      )}
      {!readOnly && !bootstrap.replayOnly && (
        <LandfallOfflineRegionPanel
          sessionId={bootstrap.sessionId}
          publishedVersionId={bootstrap.publishedVersionId}
          sequence={bootstrap.currentSequence}
          csrfToken={csrfToken}
        />
      )}
      {!readOnly &&
        !bootstrap.replayOnly &&
        worldspace.kind === "PHYSICAL" &&
        worldspace.observationPolicy.allowedSources.includes("NATIVE_LOCATION") && (
          <LandfallBackgroundPanel sessionId={bootstrap.sessionId} csrfToken={csrfToken} />
        )}
      {activeRoute && (
        <section aria-label="Route progress">
          <strong>{activeRoute.name}</strong>
          <ol>
            {activeRoute.waypointIds.map((id) => {
              const waypoint = bootstrap.runtimeDefinition.waypoints.find((item) => item.id === id);
              if (!waypoint) return null;
              const visited = bootstrap.visitedIds.includes(id);
              return (
                <li key={id}>
                  {waypoint.visibility.publicLabel ?? waypoint.name} ·{" "}
                  {visited ? "visited" : id === bootstrap.activeWaypointId ? "next" : "ahead"}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {bootstrap.journeyPath.length > 0 && (
        <section aria-label="Journey history">
          <strong>Places reached</strong>
          <ol>
            {bootstrap.journeyPath
              .filter((item) => item.kind === "VISIT")
              .map((item) => {
                return (
                  <li key={item.id}>
                    {item.label}
                    {(bootstrap.replayOnly || readOnly) && (
                      <button type="button" onClick={() => setReplayId(item.id)}>
                        Replay arrival
                      </button>
                    )}
                  </li>
                );
              })}
          </ol>
          {(bootstrap.replayOnly || readOnly) && replay && (
            <p role="status" className="completion-stamp">
              Arrival recorded: {replay.label}
              {replay.confirmedAt ? ` · ${new Date(replay.confirmedAt).toLocaleString()}` : ""}
            </p>
          )}
        </section>
      )}
      <LandfallContextGuidance
        bootstrap={bootstrap}
        snapshot={contextual}
        historical={isHistorical}
        viewingMapId={viewingMap?.id ?? bootstrap.scene.mapId}
        onViewingMapChange={(id) => {
          setViewingMapId(id);
          setSelectedPlace(null);
        }}
      />
      <LandfallPlaceSearch
        key={searchScope}
        bootstrap={bootstrap}
        onSelect={(place) => {
          setViewingMapId(place.mapId);
          setSelectedPlace({ mapId: place.mapId, featureId: place.id, scope: searchScope });
        }}
        onClear={() => setSelectedPlace(null)}
      />
      <VoyageChart
        mode={mode}
        landfallScene={searchedScene}
        landfallPosition={!viewingMap || viewingMap.id === bootstrap.scene.mapId ? position : null}
      />
      {bootstrap.runtimeDefinition.context && worldspace.kind === "PHYSICAL" && !isHistorical && !bootstrap.paused && (
        <>
          <button type="button" onClick={() => void toggleContext()}>
            {contextTracking ? "Stop motion and heading hints" : "Allow motion and heading hints"}
          </button>
          <p role="status">
            {contextMessage} These hints are temporary; bounded recent hints may qualify an online landmark check. They
            do not establish an exact room or object.
          </p>
        </>
      )}
      {landmark && worldspace.kind === "PHYSICAL" && activeWaypoint && !isHistorical && !bootstrap.paused && (
        <LandfallLandmarkPanel
          sessionId={bootstrap.sessionId}
          publishedVersionId={bootstrap.publishedVersionId}
          expectedSequence={bootstrap.currentSequence}
          csrfToken={csrfToken}
          worldspaceId={worldspace.id}
          waypointId={activeWaypoint.id}
          landmark={landmark}
          observations={observations}
          eligible={Boolean(contextSnapshot?.eligibleLandmarkIds.includes(landmark.id))}
          historical={isHistorical || !acquisitionEnabled}
          onVerified={confirmLandmark}
        />
      )}
      {activeWaypoint && activeWaypoint.fallback.mode !== "NONE" && (
        <p>
          Fallback:{" "}
          {activeWaypoint.fallback.mode === "PLAYER"
            ? "Use Confirm arrival myself when you have checked the objective."
            : activeWaypoint.fallback.mode === "CAPTAIN"
              ? "Ask your Captain to verify arrival using the configured Captain action."
              : "Use the alternate waypoint provided by your Captain."}
        </p>
      )}
      <LandfallPresentation bootstrap={bootstrap} />
      {worldspace.kind === "PHYSICAL" &&
        browserAvailable &&
        bootstrap.activeWaypointId &&
        !bootstrap.paused &&
        !bootstrap.replayOnly &&
        !readOnly && (
          <button type="button" onClick={tracking ? stop : start}>
            {tracking ? "Stop using my location" : "Use my location"}
          </button>
        )}
      {activeWaypoint?.fallback.mode === "PLAYER" &&
        activeWaypoint.evidenceProfile.allowManualFallback &&
        activeWaypoint.evidenceProfile.acceptedSources.includes("PLAYER_CONFIRMATION") &&
        worldspace.observationPolicy.allowedSources.includes("PLAYER_CONFIRMATION") &&
        !bootstrap.paused &&
        !bootstrap.replayOnly &&
        !readOnly && (
          <button
            type="button"
            onClick={() => {
              void confirmFallback();
            }}
          >
            Confirm arrival myself
          </button>
        )}
      {worldspace.kind === "PHYSICAL" &&
        (activeWaypoint?.evidenceProfile.fusionPolicy?.minimumIndependentSources ?? 1) === 2 &&
        activeWaypoint?.fallback.mode === "PLAYER" &&
        activeWaypoint.evidenceProfile.allowManualFallback &&
        activeWaypoint.evidenceProfile.acceptedSources.includes("PLAYER_CONFIRMATION") &&
        worldspace.observationPolicy.allowedSources.includes("PLAYER_CONFIRMATION") &&
        activeWaypoint.evidenceProfile.acceptedSources.includes("BROWSER_GEOLOCATION") &&
        tracking &&
        position?.confidence === "LIKELY_INSIDE" &&
        !bootstrap.paused &&
        !bootstrap.replayOnly &&
        !readOnly && (
          <button type="button" onClick={() => void confirmFallback(true)}>
            Check location and my confirmation together
          </button>
        )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
