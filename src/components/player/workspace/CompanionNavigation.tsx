"use client";

import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  SceneTargetHandle,
} from "@/animation/hosts/scene-host-types";
import type { PublicSnapshot } from "@/domain/story";
import { companionViews, type CompanionView } from "./types";

export const companionDesktopNavigationDimTargetKey = "companion-desktop-navigation-dim" as const;
export const companionMobileNavigationDimTargetKey = "companion-mobile-navigation-dim" as const;

type CompanionNavigationDimTargetKey =
  | typeof companionDesktopNavigationDimTargetKey
  | typeof companionMobileNavigationDimTargetKey;

const companionDesktopNavigationDimTarget = Object.freeze({
  targetKey: companionDesktopNavigationDimTargetKey,
  part: companionDesktopNavigationDimTargetKey,
  ownerHint: "gsap" as const,
  allowedProperties: ["opacity"] as const,
});

const companionMobileNavigationDimTarget = Object.freeze({
  targetKey: companionMobileNavigationDimTargetKey,
  part: companionMobileNavigationDimTargetKey,
  ownerHint: "gsap" as const,
  allowedProperties: ["opacity"] as const,
});

const companionNavigationDimStyle = Object.freeze({
  position: "absolute" as const,
  inset: 0,
  zIndex: 3,
  pointerEvents: "none" as const,
  background: "rgba(2, 13, 15, 0.72)",
  opacity: 0,
});

export type CompanionNavigationDimTargetRegistration<
  Key extends CompanionNavigationDimTargetKey = CompanionNavigationDimTargetKey,
> = Readonly<{
  key: Key;
  target: SceneTargetHandle;
  exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) => ExternalSceneTargetHandle;
}>;

type CompanionNavigationProps = {
  view: CompanionView;
  unseen: PublicSnapshot["unseen"];
  navigate: (view: CompanionView) => void;
};

export type DesktopCompanionNavigationProps = CompanionNavigationProps & {
  onDimTargetChange?: (
    registration: CompanionNavigationDimTargetRegistration<typeof companionDesktopNavigationDimTargetKey> | null,
  ) => void;
};

export type MobileCompanionNavigationProps = CompanionNavigationProps & {
  onDimTargetChange?: (
    registration: CompanionNavigationDimTargetRegistration<typeof companionMobileNavigationDimTargetKey> | null,
  ) => void;
};

function useCompanionNavigationDimTarget<Key extends CompanionNavigationDimTargetKey>(
  target: Readonly<{
    targetKey: Key;
    part: Key;
    ownerHint: "gsap";
    allowedProperties: readonly ["opacity"];
  }>,
  onDimTargetChange: ((registration: CompanionNavigationDimTargetRegistration<Key> | null) => void) | undefined,
) {
  const host = useOptionalSceneHost();
  const { bindTarget, handle } = useSceneTargetRegistration(target);
  const registration = useMemo<CompanionNavigationDimTargetRegistration<Key> | null>(() => {
    if (!host || !handle) return null;
    return Object.freeze({
      key: target.targetKey,
      target: handle,
      exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) =>
        host.exportTarget({ ...request, target: handle }),
    });
  }, [handle, host, target.targetKey]);

  useEffect(() => {
    onDimTargetChange?.(registration);
    return () => {
      if (registration) onDimTargetChange?.(null);
    };
  }, [onDimTargetChange, registration]);

  return bindTarget;
}

export function CompanionNavigation({ view, unseen, navigate, onDimTargetChange }: DesktopCompanionNavigationProps) {
  const bindDimTarget = useCompanionNavigationDimTarget(companionDesktopNavigationDimTarget, onDimTargetChange);

  return (
    <nav className="companion-navigation" aria-label="Companion sections">
      <span
        ref={bindDimTarget}
        className="companion-cinematic-dim companion-desktop-navigation-dim"
        data-scene-part={companionDesktopNavigationDimTargetKey}
        data-runtime-boundary="gsap"
        aria-hidden="true"
        style={companionNavigationDimStyle}
      />
      {companionViews.map((item) => (
        <button
          key={item.key}
          aria-current={view === item.key ? "page" : undefined}
          className={view === item.key ? "active" : ""}
          onClick={() => navigate(item.key)}
        >
          {view === item.key && <motion.i layoutId="active-companion-section" className="active-nav-plate" />}
          <span aria-hidden="true">{item.symbol}</span>
          <b>{item.shortLabel}</b>
          {unseen[item.key] > 0 && (
            <motion.small layoutId={`unseen-${item.key}`} aria-label={`${unseen[item.key]} unseen`}>
              New
            </motion.small>
          )}
        </button>
      ))}
    </nav>
  );
}

export function MobileNavigation({ view, unseen, navigate, onDimTargetChange }: MobileCompanionNavigationProps) {
  const bindDimTarget = useCompanionNavigationDimTarget(companionMobileNavigationDimTarget, onDimTargetChange);

  return (
    <nav className="mobile-nav" aria-label="Companion views">
      <span
        ref={bindDimTarget}
        className="companion-cinematic-dim companion-mobile-navigation-dim"
        data-scene-part={companionMobileNavigationDimTargetKey}
        data-runtime-boundary="gsap"
        aria-hidden="true"
        style={companionNavigationDimStyle}
      />
      {companionViews.map((item) => (
        <button
          aria-current={view === item.key ? "page" : undefined}
          className={view === item.key ? "active" : ""}
          onClick={() => navigate(item.key)}
          key={item.key}
        >
          <span aria-hidden="true">{item.symbol}</span>
          {item.shortLabel}
          {unseen[item.key] > 0 && <span className="sr-only">, new content</span>}
        </button>
      ))}
    </nav>
  );
}
