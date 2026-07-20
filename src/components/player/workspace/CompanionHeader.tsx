"use client";

import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";
import { useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  SceneTargetHandle,
} from "@/animation/hosts/scene-host-types";
import { canonicalTerms } from "@/language/canonical-terms";

export const companionHeaderDimTargetKey = "companion-header-dim" as const;

const companionHeaderDimTarget = Object.freeze({
  targetKey: companionHeaderDimTargetKey,
  part: companionHeaderDimTargetKey,
  ownerHint: "gsap" as const,
  allowedProperties: ["opacity" as const],
});

const companionHeaderDimStyle = Object.freeze({
  position: "absolute" as const,
  inset: 0,
  zIndex: 3,
  pointerEvents: "none" as const,
  background: "rgba(2, 13, 15, 0.72)",
  opacity: 0,
});

export type CompanionHeaderDimTargetRegistration = Readonly<{
  key: typeof companionHeaderDimTargetKey;
  target: SceneTargetHandle;
  exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) => ExternalSceneTargetHandle;
}>;

export type CompanionHeaderProps = {
  connection: "connecting" | "live" | "adrift";
  muted: boolean;
  volume: number;
  mode: MotionMode;
  textScale: number;
  texture: number;
  canReplay: boolean;
  toggleMute: () => void;
  setVolume: (value: number) => void;
  cycleMotion: () => void;
  setTextScale: (value: number) => void;
  setTexture: (value: number) => void;
  replay: () => void;
  onDimTargetChange?: (registration: CompanionHeaderDimTargetRegistration | null) => void;
};

function useCompanionHeaderDimTarget(onDimTargetChange: CompanionHeaderProps["onDimTargetChange"]) {
  const host = useOptionalSceneHost();
  const { bindTarget, handle } = useSceneTargetRegistration(companionHeaderDimTarget);
  const registration = useMemo<CompanionHeaderDimTargetRegistration | null>(() => {
    if (!host || !handle) return null;
    return Object.freeze({
      key: companionHeaderDimTargetKey,
      target: handle,
      exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) =>
        host.exportTarget({ ...request, target: handle }),
    });
  }, [handle, host]);

  useEffect(() => {
    onDimTargetChange?.(registration);
    return () => {
      if (registration) onDimTargetChange?.(null);
    };
  }, [onDimTargetChange, registration]);

  return bindTarget;
}

export function CompanionHeader({
  connection,
  muted,
  volume,
  mode,
  textScale,
  texture,
  canReplay,
  toggleMute,
  setVolume,
  cycleMotion,
  setTextScale,
  setTexture,
  replay,
  onDimTargetChange,
}: CompanionHeaderProps) {
  const bindDimTarget = useCompanionHeaderDimTarget(onDimTargetChange);

  return (
    <header className="companion-bar">
      <span
        ref={bindDimTarget}
        className="companion-cinematic-dim companion-header-dim"
        data-scene-part={companionHeaderDimTargetKey}
        data-runtime-boundary="gsap"
        aria-hidden="true"
        style={companionHeaderDimStyle}
      />
      <div className="companion-title">
        <p className="eyebrow">{canonicalTerms.product}</p>
        <h1>{canonicalTerms.player}</h1>
      </div>
      <div className="companion-controls">
        <motion.span layout className={`connection ${connection}`} aria-live="polite">
          <i aria-hidden="true" />
          {connection === "live" ? "Connected" : connection === "adrift" ? "Connection lost" : "Connecting"}
        </motion.span>
        <button onClick={toggleMute} aria-pressed={muted}>
          {muted ? "Sound off" : "Sound on"}
        </button>
        <label className="volume-control">
          Volume
          <input
            aria-label="Master volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
        <button
          onClick={cycleMotion}
          aria-pressed={mode !== "full"}
          aria-label={`Motion: ${mode}. Change motion setting`}
        >
          {mode === "full" ? "Full motion" : mode === "gentle" ? "Gentle motion" : "Reduced motion"}
        </button>
        <button
          onClick={() =>
            document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.()
          }
        >
          Companion mode
        </button>
        <details className="preference-menu">
          <summary>Preferences</summary>
          <label>
            Text size
            <input
              aria-label="Text size"
              type="range"
              min="0.9"
              max="1.35"
              step="0.05"
              value={textScale}
              onChange={(event) => setTextScale(Number(event.target.value))}
            />
          </label>
          <label>
            Texture
            <input
              aria-label="Texture intensity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={texture}
              onChange={(event) => setTexture(Number(event.target.value))}
            />
          </label>
          <button onClick={replay} disabled={!canReplay}>
            Replay last ceremony
          </button>
        </details>
      </div>
    </header>
  );
}
