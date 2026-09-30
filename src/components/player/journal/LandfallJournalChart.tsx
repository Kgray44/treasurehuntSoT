"use client";

import { useEffect, useRef, useState } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import { VoyageChart } from "@/components/player/workspace/VoyageChart";
import { BrowserGeolocationProvider } from "@/landfall/browser-geolocation";
import type { LandfallCurrentPosition } from "@/landfall/map-projection";
import { LandfallProviderRegistry } from "@/landfall/observation";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { LandfallRuntime } from "@/landfall/runtime";

export function LandfallJournalChart({
  sessionId,
  publishedVersionId,
  mode,
}: {
  sessionId: string;
  publishedVersionId: string;
  mode: MotionMode;
}) {
  const [bootstrap, setBootstrap] = useState<PlayerLandfallBootstrap | null>(null);
  const [message, setMessage] = useState("Loading Voyage Chart…");
  const [tracking, setTracking] = useState(false);
  const [browserAvailable, setBrowserAvailable] = useState(false);
  const [position, setPosition] = useState<LandfallCurrentPosition | null>(null);
  const runtime = useRef<LandfallRuntime | null>(null);
  const browser = useRef<BrowserGeolocationProvider | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/player/playthroughs/${encodeURIComponent(sessionId)}/landfall`, {
          cache: "no-store",
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Voyage Chart is unavailable.");
        const body = (await response.json()) as { available: false } | { available: true; bootstrap: PlayerLandfallBootstrap };
        if (!mounted) return;
        if (!body.available) {
          setMessage("");
          return;
        }
        const next = body.bootstrap;
        if (next.sessionId !== sessionId || next.publishedVersionId !== publishedVersionId)
          throw new Error("Voyage Chart version changed. Reopen the map.");
        const registry = new LandfallProviderRegistry();
        registry.register({
          id: "browser-geolocation",
          source: "BROWSER_GEOLOCATION",
          worldspaceKinds: ["PHYSICAL"],
          state: "AVAILABLE",
        });
        const active = new LandfallRuntime(next.runtimeDefinition, next, registry);
        active.setActiveWaypoint(next.activeWaypointId);
        runtime.current = active;
        const worldspace = next.runtimeDefinition.worldspaces[0];
        const waypoint = next.runtimeDefinition.waypoints.find((item) => item.id === next.activeWaypointId);
        if (
          worldspace.kind === "PHYSICAL" &&
          worldspace.coordinateReference.type === "WGS84" &&
          worldspace.observationPolicy.allowedSources.includes("BROWSER_GEOLOCATION") &&
          waypoint?.evidenceProfile.acceptedSources.includes("BROWSER_GEOLOCATION")
        )
          browser.current = new BrowserGeolocationProvider(navigator.geolocation ?? null, worldspace);
        setBrowserAvailable(Boolean(browser.current));
        setBootstrap(next);
        setMessage(
          worldspace.kind === "VIRTUAL"
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
      browser.current = null;
      runtime.current?.pause();
      runtime.current = null;
    };
  }, [publishedVersionId, sessionId]);

  useEffect(() => {
    if (!tracking) return;
    const timer = window.setInterval(() => {
      const fix = runtime.current?.currentPosition(Date.now());
      if (!fix) {
        setPosition(null);
        setMessage("Location signal is stale or uncertain. Waiting for a fresh accurate fix.");
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [tracking]);

  useEffect(() => {
    const stopInBackground = () => {
      if (document.visibilityState === "visible") return;
      browser.current?.stop();
      runtime.current?.pause();
      setTracking(false);
      setPosition(null);
      setMessage("Location is off while this tab is in the background. Use my location to resume.");
    };
    document.addEventListener("visibilitychange", stopInBackground);
    return () => document.removeEventListener("visibilitychange", stopInBackground);
  }, []);

  const stop = () => {
    browser.current?.stop();
    runtime.current?.pause();
    setTracking(false);
    setPosition(null);
    setMessage("Location is off. Use my location to resume.");
  };
  const start = () => {
    const provider = browser.current;
    const active = runtime.current;
    if (!provider || !active || !bootstrap?.activeWaypointId) return;
    active.resume();
    setTracking(true);
    setMessage("Requesting location for this open map…");
    provider.start(
      { sessionId, publishedVersionId },
      (observation) => {
        const now = Date.now();
        const outcome = active.ingest(observation, now);
        const fix = active.currentPosition(now);
        setPosition(
          fix && fix.coordinate.type === "WGS84"
            ? { coordinates: [fix.coordinate.longitude, fix.coordinate.latitude], accuracyMeters: fix.accuracy, confidence: outcome.confidence, observedAt: fix.observedAt }
            : null,
        );
        setMessage(
          outcome.failure === "WEAK_ACCURACY"
            ? "Location accuracy is too weak for a reliable position. Waiting for a better fix."
            : outcome.rejection
              ? "Location signal could not be used. Waiting for a fresh fix."
              : outcome.confidence === "CONFIRMED"
                ? "Location signal is locally confirmed. No visit has been recorded."
                : `Location signal: ${outcome.confidence.toLowerCase().replaceAll("_", " ")}. No visit has been recorded.`,
        );
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

  if (!bootstrap) return message ? <p role="status">{message}</p> : null;
  const worldspace = bootstrap.runtimeDefinition.worldspaces[0];
  const activeWaypoint = bootstrap.runtimeDefinition.waypoints.find((item) => item.id === bootstrap.activeWaypointId);
  return (
    <div className="landfall-journal-chart" data-landfall-player-chart data-worldspace-kind={worldspace.kind}>
      <p>{bootstrap.worldspaceName}</p>
      <p>Current objective: {activeWaypoint ? activeWaypoint.visibility.publicLabel ?? activeWaypoint.name : "No released location"}</p>
      <VoyageChart mode={mode} landfallScene={bootstrap.scene} landfallPosition={position} />
      {worldspace.kind === "PHYSICAL" && browserAvailable && bootstrap.activeWaypointId && (
        <button type="button" onClick={tracking ? stop : start}>
          {tracking ? "Stop using my location" : "Use my location"}
        </button>
      )}
      <p role="status" aria-live="polite">{message}</p>
    </div>
  );
}
