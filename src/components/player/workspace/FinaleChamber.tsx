"use client";

/* eslint-disable @next/next/no-img-element -- The mechanism SVG is a direct animation target. */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { AnimatedProperty, MotionMode } from "@/animation/core/animation-types";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { SceneHost, useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  SceneHostHandle,
  SceneTargetHandle,
} from "@/animation/hosts/scene-host-types";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject, type RiveRuntimeStatus, type RiveSignal } from "@/components/animation/RiveStatefulObject";

type FinaleEventType = Extract<ClientProgressEvent["type"], "FINALE_TEASED" | "FINALE_REQUIREMENT_UPDATED">;
type FinaleRequirement = PublicSnapshot["finale"]["requirements"][number];

export type FinaleChamberTargetKind =
  | "finale-ring-outer"
  | "finale-ring-inner"
  | "finale-light-path"
  | "requirement-layout"
  | "requirement-socket"
  | "requirement-path";

export type FinaleChamberTargetRegistration = Readonly<{
  kind: FinaleChamberTargetKind;
  /** `mechanism` for shared mechanism parts; otherwise the exact authoritative requirement key. */
  key: string;
  host: SceneHostHandle | null;
  handle: SceneTargetHandle | null;
}>;

export const finaleMechanismTargetAllowedProperties = Object.freeze([
  "transform",
  "opacity",
] as const) satisfies readonly AnimatedProperty[];

export type FinaleMechanismTargetReady = Readonly<{
  key: "finale-mechanism";
  target: SceneTargetHandle;
  allowedProperties: typeof finaleMechanismTargetAllowedProperties;
  exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) => ExternalSceneTargetHandle;
}>;

export type FinaleChamberProps = Readonly<{
  snapshot: PublicSnapshot;
  mode: MotionMode;
  /** Presentation identity is decoration only; it never queues, replays, acknowledges, or owns fallback. */
  progressEventType?: FinaleEventType;
  /** Exact immutable event identity; changes retract the prior local mechanism status before remount. */
  progressEventId?: ClientProgressEvent["id"];
  /** Exact `FINALE_REQUIREMENT_UPDATED.payload.key`; never inferred from array position. */
  progressRequirementKey?: FinaleRequirement["key"];
  onTargetRegistrationChange?: (registration: FinaleChamberTargetRegistration) => void;
  /** Static SVG/CSS mechanism authority only; Rive canvas and state-machine surfaces are excluded. */
  onMechanismTargetChange?: (ready: FinaleMechanismTargetReady | null) => void;
  /** `null` immediately retracts stale readiness/fallback authority during cleanup or identity replacement. */
  onMechanismStatusChange?: (status: RiveRuntimeStatus | null) => void;
}>;

type FinalePose = "dormant" | "teased" | "sealed" | "partial" | "ready" | "unlocking" | "unlocked" | "complete";

type FinaleFallbackSemantics = Readonly<{
  label: string;
  description: string;
}>;

const finaleFallbackSemantics = Object.freeze({
  dormant: {
    label: "dormant",
    description: "The mechanism rests without an active seal response.",
  },
  teased: {
    label: "tease wake",
    description: "The mechanism is awake while the final seal remains closed.",
  },
  sealed: {
    label: "sealed",
    description: "The final seal is closed and visibly holding.",
  },
  partial: {
    label: "requirement partial",
    description: "The mechanism shows incomplete requirement progress.",
  },
  ready: {
    label: "ready",
    description: "The requirements are ready and the seal is poised.",
  },
  unlocking: {
    label: "mechanism unlock",
    description: "The seal is parting into its unlocking pose.",
  },
  unlocked: {
    label: "chamber expansion",
    description: "The final seal is open and the chamber is revealed.",
  },
  complete: {
    label: "complete",
    description: "The finale mechanism has reached its complete pose.",
  },
} satisfies Record<FinalePose, FinaleFallbackSemantics>);

function authoritativeFinalePose(state: string): FinalePose {
  switch (state.toUpperCase()) {
    case "TEASED":
      return "teased";
    case "SEALED":
    case "LOCKED":
      return "sealed";
    case "REQUIREMENTS_PARTIAL":
    case "PARTIAL":
      return "partial";
    case "READY":
      return "ready";
    case "UNLOCKING":
      return "unlocking";
    case "UNLOCKED":
      return "unlocked";
    case "COMPLETE":
    case "COMPLETED":
      return "complete";
    default:
      return "dormant";
  }
}

function useReportTarget(
  kind: FinaleChamberTargetKind,
  key: string,
  handle: SceneTargetHandle | null,
  report: FinaleChamberProps["onTargetRegistrationChange"],
) {
  const host = useOptionalSceneHost();

  useEffect(() => {
    if (!report || !host || !handle) return;
    report({ kind, key, host, handle });
    return () => report({ kind, key, host: null, handle: null });
  }, [handle, host, key, kind, report]);
}

function MechanismTargets({ report }: { report: FinaleChamberProps["onTargetRegistrationChange"] }) {
  const outerInput = useMemo(
    () => ({
      targetKey: "finale:mechanism:ring-outer",
      part: "finale-ring-outer",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform"] as const,
    }),
    [],
  );
  const innerInput = useMemo(
    () => ({
      targetKey: "finale:mechanism:ring-inner",
      part: "finale-ring-inner",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform"] as const,
    }),
    [],
  );
  const pathInput = useMemo(
    () => ({
      targetKey: "finale:mechanism:light-path",
      part: "finale-light-path",
      ownerHint: "gsap" as const,
      allowedProperties: ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"] as const,
    }),
    [],
  );
  const { bindTarget: bindOuter, handle: outerHandle } = useSceneTargetRegistration(outerInput);
  const { bindTarget: bindInner, handle: innerHandle } = useSceneTargetRegistration(innerInput);
  const { bindTarget: bindPath, handle: pathHandle } = useSceneTargetRegistration(pathInput);
  useReportTarget("finale-ring-outer", "mechanism", outerHandle, report);
  useReportTarget("finale-ring-inner", "mechanism", innerHandle, report);
  useReportTarget("finale-light-path", "mechanism", pathHandle, report);

  return (
    <>
      <div
        ref={bindOuter}
        className="finale-ring outer"
        data-scene-part="finale-ring-outer"
        data-gsap-visual-boundary
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      />
      <div
        ref={bindInner}
        className="finale-ring inner"
        data-scene-part="finale-ring-inner"
        data-gsap-visual-boundary
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      />
      <svg viewBox="0 0 640 640" aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <path
          ref={bindPath}
          data-scene-part="finale-light-path"
          data-gsap-visual-boundary
          d="M320 66L500 140 574 320 500 500 320 574 140 500 66 320 140 140z"
        />
      </svg>
    </>
  );
}

function StaticFinaleMechanism({
  pose,
  progress,
  mode,
  report,
  onReadyChange,
}: Readonly<{
  pose: FinalePose;
  progress: number;
  mode: MotionMode;
  report: FinaleChamberProps["onTargetRegistrationChange"];
  onReadyChange: FinaleChamberProps["onMechanismTargetChange"];
}>) {
  const targetInput = useMemo(
    () => ({
      targetKey: "finale-mechanism",
      part: "finale-mechanism",
      ownerHint: "gsap" as const,
      allowedProperties: finaleMechanismTargetAllowedProperties,
    }),
    [],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(targetInput);
  const host = useOptionalSceneHost();
  const ready = useMemo<FinaleMechanismTargetReady | null>(() => {
    if (!host || !handle) return null;
    return Object.freeze({
      key: "finale-mechanism" as const,
      target: handle,
      allowedProperties: finaleMechanismTargetAllowedProperties,
      exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) =>
        host.exportTarget({ ...request, target: handle }),
    });
  }, [handle, host]);

  useEffect(() => {
    if (!ready) return;
    onReadyChange?.(ready);
    return () => onReadyChange?.(null);
  }, [onReadyChange, ready]);

  return (
    <div
      ref={bindTarget}
      className="finale-mechanism-static"
      data-scene-part="finale-mechanism"
      data-runtime-boundary="gsap"
      data-gsap-visual-boundary
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <img
        src="/illustrations/finale/celestial-mechanism.svg"
        alt=""
        aria-hidden="true"
        style={{ width: "100%", height: "100%" }}
      />
      <div
        className="finale-fallback-pose"
        data-finale-fallback="css-svg"
        data-finale-state={pose}
        data-finale-state-index={riveAssets.finaleMechanism.states.indexOf(pose)}
        data-finale-semantic-label={finaleFallbackSemantics[pose].label}
        data-finale-progress={progress.toFixed(3)}
        data-finale-motion-mode={mode}
        data-finale-reduced-equivalent="semantic-final-state"
        data-finale-production-art-status="blocked_external_asset"
        data-runtime-boundary="css"
        aria-hidden="true"
      >
        <svg viewBox="0 0 240 240" focusable="false" aria-hidden="true">
          <circle className="finale-fallback-halo" cx="120" cy="120" r="105" />
          <circle className="finale-fallback-orbit finale-fallback-orbit-outer" cx="120" cy="120" r="91" />
          <circle className="finale-fallback-orbit finale-fallback-orbit-inner" cx="120" cy="120" r="68" />
          <circle className="finale-fallback-progress-track" cx="120" cy="120" r="80" pathLength="1" />
          <circle
            className="finale-fallback-progress"
            cx="120"
            cy="120"
            r="80"
            pathLength="1"
            style={{ strokeDasharray: `${progress} ${Math.max(0, 1 - progress)}` }}
          />
          <g className="finale-fallback-spokes">
            <path d="M120 31V68M120 172V209M31 120H68M172 120H209" />
            <path d="M57 57L83 83M157 157L183 183M183 57L157 83M83 157L57 183" />
          </g>
          <g className="finale-fallback-seal finale-fallback-seal-left">
            <path d="M120 72A48 48 0 0 0 120 168L106 151V89Z" />
          </g>
          <g className="finale-fallback-seal finale-fallback-seal-right">
            <path d="M120 72A48 48 0 0 1 120 168L134 151V89Z" />
          </g>
          <circle className="finale-fallback-core" cx="120" cy="120" r="18" />
          <path className="finale-fallback-completion-mark" d="M101 120L115 134 141 105" />
        </svg>
      </div>
      <MechanismTargets report={report} />
    </div>
  );
}

function FinaleRequirementRow({
  item,
  isProgressRequirement,
  report,
}: {
  item: FinaleRequirement;
  isProgressRequirement: boolean;
  report: FinaleChamberProps["onTargetRegistrationChange"];
}) {
  const layoutInput = useMemo(
    () => ({
      targetKey: `finale:requirement:${item.key}:layout`,
      part: "finale-requirement-layout",
      runtime: "motion" as const,
      allowedProperties: ["layout"] as const,
      properties: ["layout"] as const,
    }),
    [item.key],
  );
  const socketInput = useMemo(
    () => ({
      targetKey: `finale:requirement:${item.key}:socket`,
      part: "finale-requirement-socket",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity", "filter"] as const,
    }),
    [item.key],
  );
  const pathInput = useMemo(
    () => ({
      targetKey: `finale:requirement:${item.key}:path`,
      part: "finale-light-path",
      ownerHint: "gsap" as const,
      allowedProperties: ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"] as const,
    }),
    [item.key],
  );
  const {
    bindTarget: bindLayout,
    handle: layoutHandle,
    ownershipReady: layoutOwnershipReady,
  } = useRuntimeOwnedSceneTarget(layoutInput);
  const { bindTarget: bindSocket, handle: socketHandle } = useSceneTargetRegistration(socketInput);
  const { bindTarget: bindPath, handle: pathHandle } = useSceneTargetRegistration(pathInput);
  useReportTarget("requirement-layout", item.key, layoutHandle, report);
  useReportTarget("requirement-socket", item.key, socketHandle, report);
  useReportTarget("requirement-path", item.key, pathHandle, report);

  return (
    <motion.li
      ref={bindLayout}
      {...(layoutOwnershipReady ? { layout: true } : {})}
      data-requirement-key={item.key}
      data-motion-layout-boundary
      data-motion-ownership={layoutOwnershipReady ? "ready" : "static"}
      data-progress-target={isProgressRequirement ? "true" : undefined}
    >
      <div>
        <span>
          {item.label}
          {item.optional ? " · optional" : ""}
        </span>
        <strong>
          {item.current} / {item.target}
        </strong>
      </div>
      <div
        ref={bindSocket}
        className="socket-row"
        data-scene-part="finale-requirement-socket"
        data-requirement-socket-key={item.key}
        data-progress-target={isProgressRequirement ? "true" : undefined}
        data-gsap-visual-boundary
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        <svg
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          width="100%"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        >
          <path
            ref={bindPath}
            data-scene-part="finale-light-path"
            data-requirement-path-key={item.key}
            data-progress-target={isProgressRequirement ? "true" : undefined}
            data-gsap-visual-boundary
            d="M2 5H98"
          />
        </svg>
        {Array.from({ length: item.target }, (_, index) => (
          <i key={index} className={index < item.current ? "lit" : ""} aria-hidden="true" />
        ))}
      </div>
    </motion.li>
  );
}

function FinaleMechanismAdapter({
  mode,
  pose,
  stateValue,
  progress,
  completed,
  total,
  nonce,
  onStatusChange,
}: Readonly<{
  mode: MotionMode;
  pose: FinalePose;
  stateValue: number;
  progress: number;
  completed: number;
  total: number;
  nonce: number;
  onStatusChange: FinaleChamberProps["onMechanismStatusChange"];
}>) {
  const signals = useMemo<readonly [RiveSignal, RiveSignal]>(
    () => [
      { name: "state", value: stateValue, nonce: nonce * 2 },
      { name: "progress", value: progress, nonce: nonce * 2 + 1 },
    ],
    [nonce, progress, stateValue],
  );
  const [signalIndex, setSignalIndex] = useState<0 | 1>(0);
  const [reportedStatus, setReportedStatus] = useState<RiveRuntimeStatus | null>(null);
  const pendingTerminalStatus = useRef<Extract<RiveRuntimeStatus, "ready" | "fallback"> | null>(null);
  const statusRef = useRef<RiveRuntimeStatus | null>(null);
  const callbackRef = useRef(onStatusChange);
  const activeSignal = signals[signalIndex];

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

  const handleRuntimeStatus = useCallback(
    (status: RiveRuntimeStatus) => {
      if ((status === "ready" || status === "fallback") && signalIndex === 0) {
        pendingTerminalStatus.current = status;
        setSignalIndex(1);
        return;
      }
      if (status === "failed" && signalIndex === 0) setSignalIndex(1);
      publishStatus(status);
    },
    [publishStatus, signalIndex],
  );

  useEffect(() => {
    if (signalIndex !== 1 || !pendingTerminalStatus.current) return;
    const terminalStatus = pendingTerminalStatus.current;
    const timer = window.setTimeout(() => {
      pendingTerminalStatus.current = null;
      publishStatus(terminalStatus);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [publishStatus, signalIndex]);

  return (
    <div
      className="finale-rive-contract"
      data-rive-contract-availability={riveAssets.finaleMechanism.availability}
      data-rive-runtime-status={reportedStatus ?? "pending"}
      data-rive-semantic-signals="state,progress"
      data-rive-state-value={stateValue}
      data-rive-progress-value={progress.toFixed(3)}
      data-rive-active-signal={activeSignal.name}
      data-rive-semantic-dispatches={signalIndex === 0 ? "state" : "state,progress"}
      data-rive-reduced-pose={JSON.stringify(riveAssets.finaleMechanism.reducedPose)}
    >
      <RiveStatefulObject
        asset={riveAssets.finaleMechanism}
        mode={mode}
        label={`Finale mechanism, ${pose}; ${completed} of ${total} progress`}
        signal={activeSignal}
        reducedMotion={{
          stablePose: riveAssets.finaleMechanism.reducedPose,
          allowedSemanticSignals: riveAssets.finaleMechanism.reducedSemanticSignals,
        }}
        onStatus={handleRuntimeStatus}
      />
    </div>
  );
}

export function FinaleChamber({
  snapshot,
  mode,
  progressEventType,
  progressEventId,
  progressRequirementKey,
  onTargetRegistrationChange,
  onMechanismTargetChange,
  onMechanismStatusChange,
}: FinaleChamberProps) {
  const headingId = useId();
  const pose = authoritativeFinalePose(snapshot.finale.state);
  const completed = snapshot.finale.requirements.reduce((sum, item) => sum + Math.min(item.current, item.target), 0);
  const total = snapshot.finale.requirements.reduce((sum, item) => sum + item.target, 0);
  const progress = total > 0 ? completed / total : 0;
  const stateValue = riveAssets.finaleMechanism.states.indexOf(pose);
  const fallbackSemantics = finaleFallbackSemantics[pose];
  const mechanismLifecycleIdentity = [
    snapshot.campaign.slug,
    progressEventId ?? `snapshot-${snapshot.sequence}`,
    progressEventType ?? "authoritative",
    progressRequirementKey ?? "mechanism",
    `pose-${pose}`,
    `progress-${completed}-${total}`,
  ].join(":");
  const changedRequirement = progressRequirementKey
    ? snapshot.finale.requirements.find((item) => item.key === progressRequirementKey)
    : undefined;
  const presentationState =
    progressEventType === "FINALE_TEASED"
      ? "tease-settled"
      : progressEventType === "FINALE_REQUIREMENT_UPDATED"
        ? "requirement-update-settled"
        : "authoritative-settled";
  const readableStatus =
    progressEventType === "FINALE_REQUIREMENT_UPDATED" && changedRequirement
      ? `${changedRequirement.label}: ${changedRequirement.current} of ${changedRequirement.target}. Mechanism state ${pose}.`
      : progressEventType === "FINALE_TEASED"
        ? `The final seal is awake and remains ${pose}.`
        : `Mechanism state ${pose}. ${completed} of ${total} progress steps are visible.`;
  return (
    <SceneHost
      as="section"
      kind="player-section-enhancement"
      className="physical-section finale-chamber"
      aria-labelledby={headingId}
      data-section-heading
      data-finale-authoritative-state={snapshot.finale.state.trim().toUpperCase() || "DORMANT"}
      data-finale-pose={pose}
      data-finale-semantic-label={fallbackSemantics.label}
      data-finale-progress={progress.toFixed(3)}
      data-finale-reduced-equivalent="semantic-final-state"
      data-finale-presentation-state={presentationState}
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">{snapshot.finale.state.replaceAll("_", " ")}</p>
          <h2 id={headingId}>The Final Seal</h2>
        </div>
        <p>{snapshot.finale.teaser ?? "The inner chamber remains structurally present and safely unreadable."}</p>
      </header>
      <p className="finale-readable-status" data-finale-readable-status>
        {readableStatus}
      </p>
      <p className="finale-fallback-readable-status" data-finale-fallback-readable-status>
        <strong>{fallbackSemantics.label}</strong>
        <span>
          {fallbackSemantics.description} {completed} of {total} progress steps are visible.
        </span>
      </p>
      <div className="celestial-chamber" data-finale-progress={progress.toFixed(3)}>
        <div className="constellation-field" aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <LottieEffect
          asset={lottieAssets.rollingFog}
          mode={mode}
          label="Celestial fog around the dormant finale mechanism"
          className="finale-fog"
        />
        <div className="finale-machine">
          <StaticFinaleMechanism
            key={`static-${mechanismLifecycleIdentity}`}
            pose={pose}
            progress={progress}
            mode={mode}
            report={onTargetRegistrationChange}
            onReadyChange={onMechanismTargetChange}
          />
          <FinaleMechanismAdapter
            key={`rive-${mechanismLifecycleIdentity}`}
            mode={mode}
            pose={pose}
            stateValue={stateValue}
            progress={progress}
            completed={completed}
            total={total}
            nonce={snapshot.sequence}
            onStatusChange={onMechanismStatusChange}
          />
        </div>
        <ul className="finale-requirements">
          {snapshot.finale.requirements.map((item) => (
            <FinaleRequirementRow
              key={item.key}
              item={item}
              isProgressRequirement={
                progressEventType === "FINALE_REQUIREMENT_UPDATED" && item.key === progressRequirementKey
              }
              report={onTargetRegistrationChange}
            />
          ))}
        </ul>
      </div>
    </SceneHost>
  );
}
