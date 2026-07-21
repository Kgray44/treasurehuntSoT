"use client";

/* eslint-disable @next/next/no-img-element -- The artifact SVG is presented inside the shared-layout shell. */

import { useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import type { PublicArtifact } from "@/domain/story";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHost, useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  SceneTargetHandle,
} from "@/animation/hosts/scene-host-types";

export type ArtifactInspectionExportableTarget = Readonly<{
  target: SceneTargetHandle;
  exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) => ExternalSceneTargetHandle;
}>;

export type ArtifactInspectionTargetHandles = Readonly<{
  artifactKey: string;
  layoutDestination: ArtifactInspectionExportableTarget | null;
  engraving: ArtifactInspectionExportableTarget | null;
  detailLight: ArtifactInspectionExportableTarget | null;
  /** GSAP-owned inner visual used for return handoff; Motion retains layout ownership. */
  returnVisual?: ArtifactInspectionExportableTarget | null;
}>;

type ArtifactInspectionProps = {
  artifact: PublicArtifact;
  close: () => void;
  restoreFocus: HTMLElement | null;
  onTargetHandlesChange?: (handles: ArtifactInspectionTargetHandles | null) => void;
};

type PreservedBackgroundState = Readonly<{
  element: HTMLElement;
  hadAriaHidden: boolean;
  ariaHidden: string | null;
  hadInertAttribute: boolean;
  inertAttribute: string | null;
  inert: boolean;
}>;

function isolateNonModalSiblings(modalContainer: HTMLElement) {
  const parent = modalContainer.parentElement;
  if (!parent) return () => undefined;
  const preserved = Array.from(parent.children)
    .filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element !== modalContainer &&
        !(["SCRIPT", "STYLE", "LINK", "META"] as const).includes(
          element.tagName as "SCRIPT" | "STYLE" | "LINK" | "META",
        ),
    )
    .map<PreservedBackgroundState>((element) => ({
      element,
      hadAriaHidden: element.hasAttribute("aria-hidden"),
      ariaHidden: element.getAttribute("aria-hidden"),
      hadInertAttribute: element.hasAttribute("inert"),
      inertAttribute: element.getAttribute("inert"),
      inert: element.inert,
    }));

  preserved.forEach(({ element }) => {
    element.inert = true;
    element.setAttribute("inert", "");
    element.setAttribute("aria-hidden", "true");
  });

  return () => {
    preserved.forEach(({ element, hadAriaHidden, ariaHidden, hadInertAttribute, inertAttribute, inert }) => {
      if (hadAriaHidden) element.setAttribute("aria-hidden", ariaHidden ?? "");
      else element.removeAttribute("aria-hidden");
      element.inert = inert;
      if (hadInertAttribute) element.setAttribute("inert", inertAttribute ?? "");
      else if (!inert) element.removeAttribute("inert");
    });
  };
}

function DialogSceneHost({ hostKey, titleId, children }: { hostKey: string; titleId: string; children: ReactNode }) {
  const authority = useContext(AnimationAuthorityContext);

  if (!authority) {
    // Isolated story/component renders may omit the product provider. Production is
    // always provider-backed; this compatibility wrapper does not mint authority.
    return (
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="artifact-inspection"
        data-artifact-inspection-state="readable"
        data-scene-host-unregistered="artifact-inspection"
        style={{ minWidth: 1, minHeight: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    );
  }

  return (
    <SceneHost
      as="section"
      kind="player-section-enhancement"
      hostKey={hostKey}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="artifact-inspection"
      data-artifact-inspection-state="readable"
      data-artifact-inspection-host={hostKey}
      style={{ minWidth: 1, minHeight: 1 }}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </SceneHost>
  );
}

function focusableElements(node: HTMLElement) {
  return Array.from(
    node.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((candidate) => !candidate.hasAttribute("hidden") && candidate.getAttribute("aria-hidden") !== "true");
}

function useExportableTarget(handle: SceneTargetHandle | null) {
  const host = useOptionalSceneHost();
  return useMemo<ArtifactInspectionExportableTarget | null>(() => {
    if (!host || !handle) return null;
    return Object.freeze({
      target: handle,
      exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) =>
        host.exportTarget({ ...request, target: handle }),
    });
  }, [handle, host]);
}

function ArtifactInspectionContents({
  artifact,
  titleId,
  onTargetHandlesChange,
}: Pick<ArtifactInspectionProps, "artifact" | "onTargetHandlesChange"> & { titleId: string }) {
  const layoutInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:inspection-layout-destination`,
      part: "artifact-layout-destination",
      runtime: "motion" as const,
      allowedProperties: ["layout"] as const,
      properties: ["layout"] as const,
    }),
    [artifact.key],
  );
  const engravingInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:inspection-engraving`,
      part: "artifact-engraving",
      ownerHint: "gsap" as const,
      allowedProperties: ["clip-path"] as const,
    }),
    [artifact.key],
  );
  const returnVisualInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:inspection-return-visual`,
      part: "artifact-return-visual",
      ownerHint: "gsap" as const,
      allowedProperties: ["opacity", "filter"] as const,
    }),
    [artifact.key],
  );
  const detailLightInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:inspection-detail-light`,
      part: "artifact-detail-light",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity", "filter"] as const,
    }),
    [artifact.key],
  );
  const {
    bindTarget: bindLayoutDestination,
    handle: layoutDestination,
    ownershipReady: layoutOwnershipReady,
  } = useRuntimeOwnedSceneTarget(layoutInput);
  const { bindTarget: bindEngraving, handle: engraving } = useSceneTargetRegistration(engravingInput);
  const { bindTarget: bindReturnVisual, handle: returnVisual } = useSceneTargetRegistration(returnVisualInput);
  const { bindTarget: bindDetailLight, handle: detailLight } = useSceneTargetRegistration(detailLightInput);
  const layoutDestinationRegistration = useExportableTarget(layoutDestination);
  const engravingRegistration = useExportableTarget(engraving);
  const returnVisualRegistration = useExportableTarget(returnVisual);
  const detailLightRegistration = useExportableTarget(detailLight);
  const bindLayoutDestinationNode = useCallback(
    (node: HTMLDivElement | null) => bindLayoutDestination(node),
    [bindLayoutDestination],
  );

  useEffect(() => {
    onTargetHandlesChange?.({
      artifactKey: artifact.key,
      layoutDestination: layoutDestinationRegistration,
      engraving: engravingRegistration,
      detailLight: detailLightRegistration,
      returnVisual: returnVisualRegistration,
    });
    return () => onTargetHandlesChange?.(null);
  }, [
    artifact.key,
    detailLightRegistration,
    engravingRegistration,
    layoutDestinationRegistration,
    onTargetHandlesChange,
    returnVisualRegistration,
  ]);

  return (
    <>
      <div className="inspection-pedestal">
        <motion.div
          ref={bindLayoutDestinationNode}
          {...(layoutOwnershipReady ? { layout: true, layoutId: `artifact-${artifact.key}` } : {})}
          className="inspection-object"
          data-runtime-boundary="motion"
          data-runtime-lease={layoutOwnershipReady ? "ready" : "gated"}
          data-shared-layout-id={layoutOwnershipReady ? `artifact-${artifact.key}` : undefined}
          data-artifact-key={artifact.key}
          data-artifact-target-role="layout-destination"
        >
          <span
            ref={bindReturnVisual}
            aria-hidden="true"
            data-runtime-boundary="gsap"
            data-scene-part="artifact-return-visual"
            data-artifact-key={artifact.key}
            data-artifact-target-role="return-visual"
            style={{ display: "grid", width: "100%", height: "100%", placeItems: "center", pointerEvents: "none" }}
          >
            {artifact.key.includes("compass") || artifact.name?.toLowerCase().includes("compass") ? (
              <img src="/illustrations/artifacts/compass-needle.svg" alt="" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">✦</span>
            )}
            <span
              ref={bindEngraving}
              aria-hidden="true"
              className="artifact-engraving-detail"
              data-runtime-boundary="gsap"
              data-scene-part="artifact-engraving"
              data-artifact-key={artifact.key}
              data-artifact-target-role="engraving"
              style={{ pointerEvents: "none" }}
            />
          </span>
        </motion.div>
        <div
          ref={bindDetailLight}
          className="pointer-light"
          aria-hidden="true"
          data-runtime-boundary="gsap"
          data-scene-part="artifact-detail-light"
          data-artifact-key={artifact.key}
          data-artifact-target-role="detail-light"
          style={{ pointerEvents: "none" }}
        />
      </div>
      <article className="artifact-story-card" data-artifact-key={artifact.key} data-static-readable="true">
        <p className="eyebrow">{artifact.state.replaceAll("_", " ")}</p>
        <h2 id={titleId}>{artifact.name}</h2>
        <p>{artifact.description ?? "This recovered Artifact is recorded in the Captain's Voyage Record."}</p>
        {artifact.discoveryText && <blockquote>{artifact.discoveryText}</blockquote>}
        <dl>
          <div>
            <dt>Category</dt>
            <dd>{artifact.category?.replaceAll("_", " ") ?? "Recovered artifact"}</dd>
          </div>
          {artifact.chapterOrdinal && (
            <div>
              <dt>Journal</dt>
              <dd>Chapter {artifact.chapterOrdinal}</dd>
            </div>
          )}
          {artifact.connectedArtifactKey && (
            <div>
              <dt>Connection</dt>
              <dd>A released relationship answers elsewhere on the altar.</dd>
            </div>
          )}
        </dl>
      </article>
    </>
  );
}

export function ArtifactInspection({ artifact, close, restoreFocus, onTargetHandlesChange }: ArtifactInspectionProps) {
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  const initialRestoreFocus = useRef(restoreFocus);
  const restoreFocusTarget = useRef<HTMLElement | null>(null);
  const capturedRestoreFocus = useRef(false);
  const reactInstanceId = useId();
  const titleId = `${reactInstanceId}-artifact-name`;
  const hostKey = `artifact-inspection:${artifact.key}:${reactInstanceId}`;

  useLayoutEffect(() => {
    closeRef.current = close;
  }, [close]);

  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!capturedRestoreFocus.current) {
      restoreFocusTarget.current = initialRestoreFocus.current ?? (document.activeElement as HTMLElement | null);
      capturedRestoreFocus.current = true;
    }
    const focusFirst = () => focusableElements(node!).at(0)?.focus();
    focusFirst();
    const restoreIsolation = backdrop.current ? isolateNonModalSiblings(backdrop.current) : () => undefined;

    const keydown = (event: KeyboardEvent) => {
      if (!node?.isConnected) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements(node);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (!node?.isConnected || node.contains(event.target as Node)) return;
      focusFirst();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      restoreIsolation();
      if (restoreFocusTarget.current?.isConnected) restoreFocusTarget.current.focus();
    };
  }, [artifact.key]);

  return (
    <motion.div
      ref={backdrop}
      className="artifact-inspection-backdrop"
      onClick={() => closeRef.current()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-runtime-boundary="motion"
    >
      <motion.div
        ref={dialog}
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 18, opacity: 0 }}
        data-runtime-boundary="motion"
        data-artifact-inspection-motion-wrapper
      >
        <DialogSceneHost key={hostKey} hostKey={hostKey} titleId={titleId}>
          <button className="close-inspection" onClick={() => closeRef.current()}>
            Close inspection
          </button>
          <ArtifactInspectionContents
            artifact={artifact}
            titleId={titleId}
            onTargetHandlesChange={onTargetHandlesChange}
          />
        </DialogSceneHost>
      </motion.div>
    </motion.div>
  );
}
