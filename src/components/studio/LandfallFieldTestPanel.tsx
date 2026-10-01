"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserGeolocationProvider, type ForegroundPermission } from "@/landfall/browser-geolocation";
import {
  BrowserContextProvider,
  type BrowserContextTarget,
  type BrowserContextPermission,
} from "@/landfall/browser-context";
import type { ContextualEvidence, ContextualSnapshot } from "@/landfall/contextual";
import type { LandfallObservation } from "@/landfall/observation";
import { LandfallProviderRegistry } from "@/landfall/observation";
import { LandfallRuntime } from "@/landfall/runtime";
import type { LandfallDefinition } from "@/landfall/schema";

type Receipt = {
  id: string;
  testedAt: string;
  stale: boolean;
  waypointId: string | null;
  routeId: string | null;
  result: string;
  confidence: string;
  accuracyBand: string | null;
  sampleCount: number;
  providerClass: string;
  warnings: string[];
};

export function LandfallFieldTestPanel({
  taleId,
  draftId,
  definition,
  worldspaceId,
  mapId,
  waypointId,
  routeId,
  csrfToken,
  sourceVersion,
  unsaved,
}: {
  taleId: string;
  draftId: string;
  definition: LandfallDefinition;
  worldspaceId: string;
  mapId: string;
  waypointId: string | null;
  routeId: string | null;
  csrfToken: string;
  sourceVersion: number;
  unsaved: boolean;
}) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [message, setMessage] = useState("Field tests use this draft and never progress a Player Voyage.");
  const [walking, setWalking] = useState(false);
  const [permission, setPermission] = useState<ForegroundPermission>("PROMPT");
  const [confidence, setConfidence] = useState("UNAVAILABLE");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const [sampleCount, setSampleCount] = useState(0);
  const [routeProgress, setRouteProgress] = useState<number | null>(null);
  const [battery, setBattery] = useState("unavailable");
  const [contextConsent, setContextConsent] = useState(false);
  const [contextPermission, setContextPermission] = useState<BrowserContextPermission>("PROMPT");
  const [contextSnapshot, setContextSnapshot] = useState<ContextualSnapshot | null>(null);
  const contextProvider = useRef<BrowserContextProvider | null>(null);
  const contextSamples = useRef<ContextualEvidence[]>([]);
  const provider = useRef<BrowserGeolocationProvider | null>(null);
  const runtime = useRef<LandfallRuntime | null>(null);
  const samples = useRef<LandfallObservation[]>([]);
  const worldspace = definition.worldspaces.find((item) => item.id === worldspaceId)!;
  const waypoint = definition.waypoints.find((item) => item.id === waypointId);
  const route = definition.routes.find((item) => item.id === routeId);
  const identity = { sessionId: `field-test-${draftId}`, publishedVersionId: `draft-${draftId}-${sourceVersion}` };

  useEffect(() => {
    provider.current?.stop();
    contextProvider.current?.stop();
    runtime.current?.pause();
    samples.current = [];
    contextSamples.current = [];
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setWalking(false);
      setSampleCount(0);
      setConfidence("UNAVAILABLE");
      setAccuracy(null);
      setLastAt(null);
      setRouteProgress(null);
      setContextSnapshot(null);
      setContextPermission("PROMPT");
    });
    return () => {
      active = false;
    };
  }, [sourceVersion, worldspaceId, mapId, waypointId, routeId, unsaved]);

  useEffect(() => {
    const background = () => {
      if (document.visibilityState === "visible") return;
      provider.current?.stop();
      contextProvider.current?.stop();
      runtime.current?.pause();
      samples.current = [];
      contextSamples.current = [];
      setWalking(false);
      setSampleCount(0);
      setContextSnapshot(null);
      setMessage("Test walk stopped while this tab is in the background. Start a new foreground test to continue.");
    };
    document.addEventListener("visibilitychange", background);
    return () => document.removeEventListener("visibilitychange", background);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch(`/api/studio/tales/${encodeURIComponent(taleId)}/landfall/field-tests`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { receipts: Receipt[] }) => {
        if (active) setReceipts(body.receipts);
      })
      .catch(() => {
        if (active) setMessage("Saved field-test receipts are unavailable.");
      });
    const batteryApi = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    void batteryApi
      .getBattery?.()
      .then((state) => {
        if (active) setBattery(`${Math.round(state.level * 100)}%${state.charging ? " · charging" : ""}`);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      provider.current?.stop();
      contextProvider.current?.stop();
      runtime.current?.pause();
      samples.current = [];
      contextSamples.current = [];
    };
  }, [taleId, sourceVersion]);

  useEffect(() => {
    if (!walking) return;
    const timer = window.setInterval(() => {
      setClock(Date.now());
      if (runtime.current) setContextSnapshot(runtime.current.contextSnapshot(Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [walking]);

  function start() {
    if (unsaved) {
      setMessage("Wait for Studio autosave before beginning a source-bound test walk.");
      return;
    }
    if (!waypoint || worldspace.kind !== "PHYSICAL" || worldspace.coordinateReference.type !== "WGS84") {
      setMessage("Select a physical waypoint to start a browser field walk.");
      return;
    }
    const registry = new LandfallProviderRegistry();
    registry.register({
      id: "browser-geolocation",
      source: "BROWSER_GEOLOCATION",
      worldspaceKinds: ["PHYSICAL"],
      state: "AVAILABLE",
    });
    const engine = new LandfallRuntime(
      {
        worldspaces: [worldspace],
        waypoints: [waypoint],
        routes: route ? [route] : [],
        transitions: [],
        context: definition.context,
      },
      identity,
      registry,
    );
    engine.setActiveWaypoint(waypoint.id);
    if (route) engine.setActiveRoute(route.id);
    engine.resume();
    runtime.current = engine;
    samples.current = [];
    contextSamples.current = [];
    setSampleCount(0);
    setConfidence("UNAVAILABLE");
    setAccuracy(null);
    setLastAt(null);
    setContextSnapshot(null);
    const location = new BrowserGeolocationProvider(navigator.geolocation ?? null, worldspace);
    provider.current = location;
    setWalking(true);
    setMessage("Foreground test walk is running. Browser readings stay in memory until you save a summarized receipt.");
    location.start(
      identity,
      (observation) => {
        const outcome = engine.ingest(observation, Date.now());
        setConfidence(outcome.confidence);
        setRouteProgress(engine.routeFraction);
        setContextSnapshot(engine.contextSnapshot(Date.now()));
        if (!outcome.rejection && observation.kind === "PHYSICAL_POSITION") {
          samples.current = [...samples.current, observation].slice(-20);
          setSampleCount(samples.current.length);
          setAccuracy(observation.accuracyMeters);
          setLastAt(Date.parse(observation.observedAt));
        }
        if (outcome.rejection)
          setMessage(`Reading not usable: ${outcome.rejection.toLowerCase().replaceAll("_", " ")}.`);
      },
      (state) => {
        engine.setPermission(state);
        setPermission(state);
        if (state === "DENIED" || state === "UNAVAILABLE") {
          location.stop();
          contextProvider.current?.stop();
          engine.pause();
          setWalking(false);
          setMessage("Browser location is unavailable. Save an incomplete receipt or test the configured fallback.");
        }
      },
    );
    if (definition.context && contextConsent && location.active) {
      const hints = new BrowserContextProvider(window as unknown as BrowserContextTarget, worldspace.id);
      contextProvider.current = hints;
      void hints.start(
        identity,
        (evidence) => {
          const snapshot = engine.ingestContext(evidence, Date.now());
          setContextSnapshot(snapshot);
          if (!snapshot.rejection) contextSamples.current = [...contextSamples.current, evidence].slice(-40);
        },
        setContextPermission,
        true,
      );
    } else setContextPermission(contextConsent ? "UNAVAILABLE" : "PROMPT");
  }

  function stop() {
    provider.current?.stop();
    contextProvider.current?.stop();
    runtime.current?.pause();
    setWalking(false);
    setMessage("Test walk stopped. The latest 20 readings remain in memory until saved or this panel closes.");
  }

  async function save(mode: "PHYSICAL_WALK" | "VIRTUAL_PREVIEW" | "FALLBACK_PREVIEW") {
    if (unsaved) {
      setMessage("Wait for Studio autosave before saving a receipt.");
      return;
    }
    if (navigator.onLine === false) {
      setMessage("Offline: a durable receipt needs a server connection. No receipt was saved.");
      return;
    }
    if (walking) stop();
    try {
      const response = await fetch(`/api/studio/tales/${encodeURIComponent(taleId)}/landfall/field-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          sourceVersion,
          worldspaceId,
          mapId,
          ...(waypointId ? { waypointId } : {}),
          ...(routeId ? { routeId } : {}),
          mode,
          permission,
          networkState: "ONLINE",
          observations: mode === "PHYSICAL_WALK" ? samples.current : [],
          contextualEvidence: mode === "PHYSICAL_WALK" ? contextSamples.current : [],
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409 ? "Draft changed; reopen this field test." : "Receipt could not be saved.",
        );
      const result = (await response.json()) as { result: string; warnings: string[] };
      samples.current = [];
      contextSamples.current = [];
      setMessage(`Sanitized ${result.result.toLowerCase()} receipt saved. ${result.warnings[0] ?? "No warning."}`);
      const list = await fetch(`/api/studio/tales/${encodeURIComponent(taleId)}/landfall/field-tests`, {
        cache: "no-store",
      });
      if (list.ok) setReceipts(((await list.json()) as { receipts: Receipt[] }).receipts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Receipt could not be saved.");
    }
  }

  return (
    <section className="landfall-field-test" aria-label="Creator field test">
      <h3>Creator test walk</h3>
      <p>
        This tests the draft. Browser location is reported by the device and is not independently verified. No raw trail
        is saved.
      </p>
      <div className="landfall-test-controls">
        {definition.context && worldspace.kind === "PHYSICAL" && (
          <label className="landfall-check">
            <input
              type="checkbox"
              checked={contextConsent}
              disabled={walking}
              onChange={(event) => setContextConsent(event.target.checked)}
            />
            Allow optional foreground heading and motion hints for this test
          </label>
        )}
        {worldspace.kind === "PHYSICAL" && waypoint && (
          <button type="button" disabled={unsaved && !walking} onClick={walking ? stop : start}>
            {walking ? "Stop test walk" : "Start test walk"}
          </button>
        )}
        {worldspace.kind === "PHYSICAL" && waypoint && (
          <button type="button" disabled={unsaved} onClick={() => void save("PHYSICAL_WALK")}>
            Save walk receipt
          </button>
        )}
        {worldspace.kind === "VIRTUAL" && (
          <button type="button" disabled={unsaved} onClick={() => void save("VIRTUAL_PREVIEW")}>
            Save virtual preview receipt
          </button>
        )}
        {waypoint && (
          <button type="button" disabled={unsaved} onClick={() => void save("FALLBACK_PREVIEW")}>
            Save fallback preview receipt
          </button>
        )}
      </div>
      <dl className="landfall-test-diagnostics">
        <div>
          <dt>Provider</dt>
          <dd>
            {worldspace.kind === "PHYSICAL" ? "browser geolocation" : "unavailable (no virtual telemetry connected)"}
          </dd>
        </div>
        <div>
          <dt>Permission</dt>
          <dd>{permission.toLowerCase()}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{accuracy === null ? "unavailable" : `${Math.round(accuracy)} m`}</dd>
        </div>
        <div>
          <dt>Sample age</dt>
          <dd>
            {lastAt === null
              ? "unavailable"
              : `${Math.max(0, Math.round(((clock ?? lastAt) - lastAt) / 1000))} s at last update`}
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{confidence.toLowerCase().replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Readings</dt>
          <dd>{sampleCount} of 20 retained in memory</dd>
        </div>
        <div>
          <dt>Dwell target</dt>
          <dd>{waypoint ? `${waypoint.evidenceProfile.dwellSeconds} s` : "unavailable"}</dd>
        </div>
        <div>
          <dt>Route progress</dt>
          <dd>{routeProgress === null ? "unavailable" : `${Math.round(routeProgress * 100)}%`}</dd>
        </div>
        <div>
          <dt>Deviation</dt>
          <dd>
            {route?.semantics === "NAVIGATIONAL" && route.geometry ? "See route progress and warnings" : "unavailable"}
          </dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online"}</dd>
        </div>
        <div>
          <dt>Battery</dt>
          <dd>{battery}</dd>
        </div>
        {definition.context && (
          <>
            <div>
              <dt>Region guidance</dt>
              <dd>
                {contextSnapshot
                  ? `${contextSnapshot.state.toLowerCase()} · ${definition.context.regions.find((item) => item.id === contextSnapshot.regionId)?.name ?? "region unavailable"}`
                  : "unavailable"}
              </dd>
            </div>
            <div>
              <dt>Context evidence</dt>
              <dd>
                {contextSnapshot?.evidenceCategories.length
                  ? contextSnapshot.evidenceCategories.join(", ").toLowerCase()
                  : "unavailable"}
              </dd>
            </div>
            <div>
              <dt>Optional sensors</dt>
              <dd>
                {contextConsent ? contextPermission.toLowerCase() : "not enabled"}; elevation{" "}
                {contextSnapshot?.evidenceCategories.includes("ELEVATION") ? "available" : "unavailable"}
              </dd>
            </div>
            <div>
              <dt>Context route</dt>
              <dd>
                {contextSnapshot?.routeMatch
                  ? `segment ${contextSnapshot.routeMatch.segmentIndex + 1} · ${contextSnapshot.routeMatch.direction.toLowerCase()}${contextSnapshot.routeMatch.ambiguous ? " · uncertain" : ""}`
                  : "unavailable"}
              </dd>
            </div>
            <div>
              <dt>Landmark recognition</dt>
              <dd>unavailable · use the configured readable fallback</dd>
            </div>
          </>
        )}
      </dl>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <h4>Saved receipts</h4>
      {receipts.length ? (
        <ul>
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <strong>{receipt.result.toLowerCase()}</strong> ·{" "}
              {receipt.providerClass.toLowerCase().replaceAll("_", " ")} · {new Date(receipt.testedAt).toLocaleString()}
              {receipt.stale && <strong> · stale after draft edits</strong>}
              <span>
                {" "}
                · {receipt.sampleCount} readings · {receipt.confidence.toLowerCase().replaceAll("_", " ")}
              </span>
              {receipt.warnings.length > 0 && (
                <ul>
                  {receipt.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No field-test receipts for this draft.</p>
      )}
    </section>
  );
}
