"use client";

/* eslint-disable @next/next/no-img-element -- The chart SVG is a layered animation surface. */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets, voyageCompassConnectionStatus } from "@/animation/assets/rive-contracts";
import { SceneHost, useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  SceneHostHandle,
  SceneTargetHandle,
} from "@/animation/hosts/scene-host-types";
import type { PublicMapLocation, PublicSnapshot } from "@/domain/story";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject, type RiveRuntimeStatus, type RiveSignal } from "@/components/animation/RiveStatefulObject";

type ChartRoute = PublicSnapshot["mapRoutes"][number];

export type VoyageChartTargetKind =
  | "chart-motion-surface"
  | "location-layout"
  | "location-visual"
  | "route-path"
  | "ship-token"
  | "fog-mask";

export type VoyageChartTargetRegistration = Readonly<{
  kind: VoyageChartTargetKind;
  key: string;
  host: SceneHostHandle | null;
  handle: SceneTargetHandle | null;
  /**
   * Exact Phase 2 external capability. A progression scene may consume it only
   * when the Chart is mounted; the Chart never queues or acknowledges events.
   */
  exportForScene: ((request: Omit<ExternalTargetExportRequest, "target">) => ExternalSceneTargetHandle) | null;
}>;

export type VoyageChartProps = Readonly<{
  snapshot: PublicSnapshot;
  mode: MotionMode;
  /** Exact progress identity; it never falls back to array or DOM order. */
  progressLocationKey?: PublicMapLocation["key"];
  /** Exact progress identity; it never falls back to the final rendered route. */
  progressRouteKey?: ChartRoute["key"];
  onLocationActivate?: (locationKey: PublicMapLocation["key"]) => void;
  /** Gives the progression-host integrator the source host and exact target handle needed for a bounded export. */
  onTargetRegistrationChange?: (registration: VoyageChartTargetRegistration) => void;
  /** Optional local Rive/fallback truth only; never progression acknowledgment or ordering authority. */
  onCompassStatusChange?: (status: RiveRuntimeStatus | null) => void;
}>;

type VoyageCompassPose = "idle" | "bearing" | "arrived";

type VoyageCompassSemantics = Readonly<{
  pose: VoyageCompassPose;
  connectionStatus: number;
  bearingDegrees: number;
  courseProgress: number;
  hasCourse: boolean;
  routeKey: string | null;
  readable: string;
}>;

function normalizedRouteBearing(route: ChartRoute, locations: ReadonlyMap<string, PublicMapLocation>) {
  const from = locations.get(route.fromKey);
  const to = locations.get(route.toKey);
  if (from?.x === undefined || from.y === undefined || to?.x === undefined || to.y === undefined) return 0;
  const headingRadians = Math.atan2(to.x - from.x, -(to.y - from.y));
  return (((headingRadians / (Math.PI * 2)) % 1) + 1) % 1;
}

function resolveVoyageCompassSemantics(
  routes: readonly ChartRoute[],
  locations: ReadonlyMap<string, PublicMapLocation>,
  progressRouteKey: ChartRoute["key"] | undefined,
): VoyageCompassSemantics {
  const route = progressRouteKey ? routes.find((candidate) => candidate.key === progressRouteKey) : undefined;
  if (!route) {
    const pose = "idle" as const;
    return {
      pose,
      connectionStatus: voyageCompassConnectionStatus.idle,
      bearingDegrees: 0,
      courseProgress: 0,
      hasCourse: false,
      routeKey: null,
      readable: "The voyage compass is idle; no exact route bearing is active.",
    };
  }
  const bearingDegrees = normalizedRouteBearing(route, locations) * 360;
  const pose = route.state.trim().toUpperCase() === "ARRIVED" ? "arrived" : "bearing";
  return {
    pose,
    connectionStatus:
      pose === "arrived" ? voyageCompassConnectionStatus.arrived : voyageCompassConnectionStatus.bearing,
    bearingDegrees,
    courseProgress: pose === "arrived" ? 1 : 0,
    hasCourse: true,
    routeKey: route.key,
    readable:
      pose === "arrived"
        ? `The voyage compass marks arrival for route ${route.key}.`
        : `The voyage compass holds the released bearing for route ${route.key}.`,
  };
}

function useReportTarget(
  kind: VoyageChartTargetKind,
  key: string,
  handle: SceneTargetHandle | null,
  report: VoyageChartProps["onTargetRegistrationChange"],
) {
  const host = useOptionalSceneHost();
  const exportForScene = useMemo(
    () =>
      host && handle
        ? (request: Omit<ExternalTargetExportRequest, "target">) => host.exportTarget({ ...request, target: handle })
        : null,
    [handle, host],
  );

  useEffect(() => {
    if (!report || !host || !handle || !exportForScene) return;
    report({ kind, key, host, handle, exportForScene });
    return () => report({ kind, key, host: null, handle: null, exportForScene: null });
  }, [exportForScene, handle, host, key, kind, report]);
}

function uniqueByKey<T extends Readonly<{ key: string }>>(items: readonly T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function ChartMotionSurface({
  children,
  scale,
  pan,
  mode,
  report,
}: Readonly<{
  children: React.ReactNode;
  scale: number;
  pan: Readonly<{ x: number; y: number }>;
  mode: MotionMode;
  report: VoyageChartProps["onTargetRegistrationChange"];
}>) {
  const target = useMemo(
    () => ({
      targetKey: "chart:motion-surface",
      part: "chart-motion-surface",
      runtime: "motion" as const,
      allowedProperties: ["translate", "scale"] as const,
      properties: ["translate", "scale"] as const,
    }),
    [],
  );
  const { bindTarget, handle, ownershipReady } = useRuntimeOwnedSceneTarget(target);
  useReportTarget("chart-motion-surface", "chart", handle, report);

  return (
    <motion.div
      ref={bindTarget}
      className="illustrated-chart"
      {...(ownershipReady
        ? {
            animate: { scale, x: pan.x, y: pan.y },
            transition:
              mode === "reduced" ? { duration: 0.01 } : { type: "spring" as const, stiffness: 180, damping: 26 },
          }
        : {})}
      data-motion-layout-boundary
      data-motion-ownership={ownershipReady ? "ready" : "static"}
      data-chart-target-key="chart"
    >
      {children}
    </motion.div>
  );
}

function ChartRoutePath({
  route,
  d,
  isProgressTarget,
  report,
}: Readonly<{
  route: ChartRoute;
  d: string;
  isProgressTarget: boolean;
  report: VoyageChartProps["onTargetRegistrationChange"];
}>) {
  const target = useMemo(
    () => ({
      targetKey: `route:${route.key}:path`,
      part: "route-path",
      ownerHint: "gsap" as const,
      allowedProperties: ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"] as const,
    }),
    [route.key],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(target);
  useReportTarget("route-path", route.key, handle, report);

  return (
    <path
      ref={bindTarget}
      data-scene-part="route-path"
      data-gsap-visual-boundary
      data-route-key={route.key}
      data-progress-target={isProgressTarget ? "true" : undefined}
      d={d}
      style={{ pointerEvents: "none" }}
    />
  );
}

function ChartShipToken({
  campaignKey,
  report,
}: Readonly<{ campaignKey: string; report: VoyageChartProps["onTargetRegistrationChange"] }>) {
  const target = useMemo(
    () => ({
      targetKey: `ship:${campaignKey}:token`,
      part: "ship-token",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "translate", "rotate"] as const,
    }),
    [campaignKey],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(target);
  useReportTarget("ship-token", campaignKey, handle, report);

  return (
    <div
      ref={bindTarget}
      className="ship-token"
      data-scene-part="ship-token"
      data-gsap-visual-boundary
      data-ship-key={campaignKey}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      ▲
    </div>
  );
}

function ChartMarker({
  location,
  isProgressTarget,
  activate,
  report,
}: Readonly<{
  location: PublicMapLocation;
  isProgressTarget: boolean;
  activate: VoyageChartProps["onLocationActivate"];
  report: VoyageChartProps["onTargetRegistrationChange"];
}>) {
  const layoutTarget = useMemo(
    () => ({
      targetKey: `location:${location.key}:layout`,
      part: "map-marker-layout",
      runtime: "motion" as const,
      allowedProperties: ["layout"] as const,
      properties: ["layout"] as const,
    }),
    [location.key],
  );
  const visualTarget = useMemo(
    () => ({
      targetKey: `location:${location.key}:event-visual`,
      part: "map-marker",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "scale", "opacity", "filter"] as const,
    }),
    [location.key],
  );
  const {
    bindTarget: bindLayoutTarget,
    handle: layoutHandle,
    ownershipReady: layoutOwnershipReady,
  } = useRuntimeOwnedSceneTarget(layoutTarget);
  const { bindTarget: bindVisualTarget, handle: visualHandle } = useSceneTargetRegistration(visualTarget);
  useReportTarget("location-layout", location.key, layoutHandle, report);
  useReportTarget("location-visual", location.key, visualHandle, report);

  return (
    <motion.button
      ref={bindLayoutTarget}
      {...(layoutOwnershipReady ? { layout: true } : {})}
      type="button"
      className="illustrated-marker"
      data-scene-part="map-marker-layout"
      data-motion-layout-boundary
      data-motion-ownership={layoutOwnershipReady ? "ready" : "static"}
      data-location-key={location.key}
      data-progress-target={isProgressTarget ? "true" : undefined}
      style={{ left: `${location.x}%`, top: `${location.y}%` }}
      aria-label={`${location.name}, ${location.state.replaceAll("_", " ")}`}
      onClick={activate ? () => activate(location.key) : undefined}
    >
      <span
        ref={bindVisualTarget}
        data-scene-part="map-marker"
        data-gsap-visual-boundary
        data-marker-visual-key={location.key}
        data-progress-target={isProgressTarget ? "true" : undefined}
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        ✦
      </span>
      <b>{location.name}</b>
      <small>{location.regionLabel}</small>
    </motion.button>
  );
}

function ChartFogMask({
  campaignKey,
  report,
}: Readonly<{ campaignKey: string; report: VoyageChartProps["onTargetRegistrationChange"] }>) {
  const target = useMemo(
    () => ({
      targetKey: `fog:${campaignKey}`,
      part: "map-fog",
      ownerHint: "gsap" as const,
      allowedProperties: ["clip-path", "opacity"] as const,
    }),
    [campaignKey],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(target);
  useReportTarget("fog-mask", campaignKey, handle, report);

  return (
    <div
      ref={bindTarget}
      className="map-fog-mask"
      data-scene-part="map-fog"
      data-gsap-visual-boundary
      data-fog-key={campaignKey}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    />
  );
}

function VoyageChartContents({
  snapshot,
  mode,
  headingId,
  progressLocationKey,
  progressRouteKey,
  onLocationActivate,
  onTargetRegistrationChange,
  onCompassStatusChange,
}: VoyageChartProps & Readonly<{ headingId: string }>) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const chartLocations = useMemo(() => uniqueByKey(snapshot.mapLocations), [snapshot.mapLocations]);
  const chartRoutes = useMemo(() => uniqueByKey(snapshot.mapRoutes), [snapshot.mapRoutes]);
  const locations = useMemo(
    () => new Map(chartLocations.map((location) => [location.key, location])),
    [chartLocations],
  );
  const compass = useMemo(
    () => resolveVoyageCompassSemantics(chartRoutes, locations, progressRouteKey),
    [chartRoutes, locations, progressRouteKey],
  );
  const compassLifecycleIdentity = [
    snapshot.campaign.slug,
    `snapshot-${snapshot.sequence}`,
    compass.routeKey ?? "idle",
    compass.pose,
    compass.bearingDegrees.toFixed(2),
  ].join(":");

  return (
    <>
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Released bearings only</p>
          <h2 id={headingId}>Voyage Chart</h2>
        </div>
        <p>Pan, zoom, and inspect the chart without crossing into hidden waters.</p>
      </header>
      <div className="chart-instrument-bar" aria-label="Map controls">
        <button type="button" onClick={() => setScale((value) => Math.min(1.8, value + 0.2))}>
          Zoom in
        </button>
        <button type="button" onClick={() => setScale((value) => Math.max(0.8, value - 0.2))}>
          Zoom out
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset chart
        </button>
        <span>Zoom {Math.round(scale * 100)}%</span>
      </div>
      <p className="sr-only" data-voyage-compass-readable-status data-voyage-compass-state={compass.pose}>
        {compass.readable}
      </p>
      <div
        className="chart-viewport"
        tabIndex={0}
        aria-label="Interactive voyage chart. Use arrow keys to pan."
        onKeyDown={(event) => {
          const amount = 28;
          if (!event.key.startsWith("Arrow")) return;
          event.preventDefault();
          if (event.key === "ArrowLeft") setPan((current) => ({ ...current, x: current.x + amount }));
          if (event.key === "ArrowRight") setPan((current) => ({ ...current, x: current.x - amount }));
          if (event.key === "ArrowUp") setPan((current) => ({ ...current, y: current.y + amount }));
          if (event.key === "ArrowDown") setPan((current) => ({ ...current, y: current.y - amount }));
        }}
      >
        <ChartMotionSurface scale={scale} pan={pan} mode={mode} report={onTargetRegistrationChange}>
          <img src="/illustrations/chart/voyage-chart.svg" alt="" aria-hidden="true" />
          <svg viewBox="0 0 1200 780" className="route-overlay" aria-hidden="true">
            {chartRoutes.map((route) => {
              const from = locations.get(route.fromKey);
              const to = locations.get(route.toKey);
              if (from?.x === undefined || from.y === undefined || to?.x === undefined || to.y === undefined)
                return null;
              return (
                <ChartRoutePath
                  key={route.key}
                  route={route}
                  isProgressTarget={route.key === progressRouteKey}
                  report={onTargetRegistrationChange}
                  d={`M${from.x * 12} ${from.y * 7.8} C${from.x * 8 + to.x * 4} ${from.y * 7.8 - 70} ${from.x * 4 + to.x * 8} ${to.y * 7.8 + 50} ${to.x * 12} ${to.y * 7.8}`}
                />
              );
            })}
          </svg>
          <ChartShipToken campaignKey={snapshot.campaign.slug} report={onTargetRegistrationChange} />
          {chartLocations
            .filter((location) => location.x !== undefined && location.y !== undefined)
            .map((location) => (
              <ChartMarker
                key={location.key}
                location={location}
                isProgressTarget={location.key === progressLocationKey}
                activate={onLocationActivate}
                report={onTargetRegistrationChange}
              />
            ))}
          <ChartFogMask campaignKey={snapshot.campaign.slug} report={onTargetRegistrationChange} />
          <LottieEffect
            asset={lottieAssets.rollingFog}
            mode={mode}
            label="Fog of war moving over unrevealed chart regions"
            className="chart-lottie-fog"
          />
        </ChartMotionSurface>
        <VoyageCompassAdapter
          key={compassLifecycleIdentity}
          mode={mode}
          semantics={compass}
          nonce={snapshot.sequence}
          onStatusChange={onCompassStatusChange}
        />
      </div>
      <ol className="map-alternative" aria-label="Voyage locations">
        {chartLocations.map((location) => (
          <li key={location.key}>
            <span aria-hidden="true">⌖</span>
            <div>
              <strong>{location.name}</strong>
              <small>
                {location.state.replaceAll("_", " ")}
                {location.regionLabel ? ` · ${location.regionLabel}` : ""}
              </small>
              {location.description && <p>{location.description}</p>}
            </div>
          </li>
        ))}
      </ol>
      {chartRoutes.length > 0 && (
        <ol className="route-list" aria-label="Revealed route segments">
          {chartRoutes.map((route) => (
            <li key={route.key} data-route-list-key={route.key}>
              <span aria-hidden="true">→</span>
              <b>
                {locations.get(route.fromKey)?.name ?? "Known mark"} to{" "}
                {locations.get(route.toKey)?.name ?? "Known mark"}
              </b>
              {route.annotation && <small>{route.annotation}</small>}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function VoyageCompassAdapter({
  mode,
  semantics,
  nonce,
  onStatusChange,
}: Readonly<{
  mode: MotionMode;
  semantics: VoyageCompassSemantics;
  nonce: number;
  onStatusChange: VoyageChartProps["onCompassStatusChange"];
}>) {
  const signals = useMemo<readonly RiveSignal[]>(
    () => [
      { name: "connectionStatus", value: semantics.connectionStatus, nonce: nonce * 4 },
      { name: "bearingDegrees", value: semantics.bearingDegrees, nonce: nonce * 4 + 1 },
      { name: "courseProgress", value: semantics.courseProgress, nonce: nonce * 4 + 2 },
      { name: "hasCourse", value: semantics.hasCourse, nonce: nonce * 4 + 3 },
    ],
    [nonce, semantics.bearingDegrees, semantics.connectionStatus, semantics.courseProgress, semantics.hasCourse],
  );
  const [reportedStatus, setReportedStatus] = useState<RiveRuntimeStatus | null>(null);
  const statusRef = useRef<RiveRuntimeStatus | null>(null);
  const callbackRef = useRef(onStatusChange);

  useEffect(() => {
    const previous = callbackRef.current;
    if (previous === onStatusChange) return;
    previous?.(null);
    callbackRef.current = onStatusChange;
    if (statusRef.current) onStatusChange?.(statusRef.current);
  }, [onStatusChange]);

  useEffect(
    () => () => {
      callbackRef.current?.(null);
      callbackRef.current = undefined;
      statusRef.current = null;
    },
    [],
  );

  const publishStatus = useCallback((status: RiveRuntimeStatus) => {
    statusRef.current = status;
    setReportedStatus(status);
    callbackRef.current?.(status);
  }, []);

  return (
    <div
      aria-hidden="true"
      data-voyage-compass-contract
      data-rive-contract-availability={riveAssets.voyageCompass.availability}
      data-rive-runtime-status={reportedStatus ?? "pending"}
      data-rive-state={semantics.pose}
      data-rive-state-value={semantics.connectionStatus}
      data-rive-bearing-value={semantics.bearingDegrees.toFixed(2)}
      data-rive-route-key={semantics.routeKey ?? ""}
      data-rive-semantic-dispatches="connectionStatus,bearingDegrees,courseProgress,hasCourse"
      data-rive-inputs={riveAssets.voyageCompass.inputs.map((input) => input.name).join(",")}
      data-rive-reduced-pose={JSON.stringify(riveAssets.voyageCompass.reducedPose)}
      data-rive-reduced-equivalent="semantic-final-state"
      data-rive-production-art-status={riveAssets.voyageCompass.availability}
      style={{
        position: "absolute",
        zIndex: 8,
        right: "2.5%",
        bottom: "3.5%",
        width: "clamp(76px, 14%, 150px)",
        aspectRatio: "1",
        pointerEvents: "none",
        opacity: mode === "reduced" ? 0.72 : 0.88,
      }}
    >
      <RiveStatefulObject
        asset={riveAssets.voyageCompass}
        mode={mode}
        label={`Voyage compass, ${semantics.pose}`}
        signals={signals}
        reducedMotion={{
          stablePose: riveAssets.voyageCompass.reducedPose,
          allowedSemanticSignals: riveAssets.voyageCompass.reducedSemanticSignals,
        }}
        onStatus={publishStatus}
      />
    </div>
  );
}

export function VoyageChart(props: VoyageChartProps) {
  const headingId = useId();

  return (
    <SceneHost
      as="section"
      kind="player-section-enhancement"
      className="physical-section voyage-chart-section"
      aria-labelledby={headingId}
      data-section-heading
      tabIndex={-1}
    >
      <VoyageChartContents {...props} headingId={headingId} />
    </SceneHost>
  );
}
