"use client";

/* eslint-disable @next/next/no-img-element -- Artifact SVGs are presented inside Motion-owned layout shells. */

import { useCallback, useEffect, useId, useMemo } from "react";
import { motion } from "motion/react";
import type { PublicArtifact, PublicSnapshot } from "@/domain/story";
import { useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  SceneTargetHandle,
} from "@/animation/hosts/scene-host-types";

export type TreasureAltarExportableTarget = Readonly<{
  target: SceneTargetHandle;
  exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) => ExternalSceneTargetHandle;
}>;

export type TreasureAltarArtifactTargetHandles = Readonly<{
  artifactKey: string;
  layoutSource: TreasureAltarExportableTarget | null;
  /** Backward-compatible award destination; it is the exact keyed silhouette capability. */
  cinematicDestination: TreasureAltarExportableTarget | null;
  silhouette?: TreasureAltarExportableTarget | null;
  connectionEndpoint?: TreasureAltarExportableTarget | null;
}>;

export type TreasureAltarConnectionTargetHandle = Readonly<{
  sourceArtifactKey: string;
  destinationArtifactKey: string;
  target: TreasureAltarExportableTarget | null;
}>;

type TreasureAltarProps = {
  snapshot: PublicSnapshot;
  inspect: (key: string, element: HTMLElement) => void;
  onArtifactTargetHandlesChange?: (handles: TreasureAltarArtifactTargetHandles) => void;
  onConnectionTargetHandleChange?: (handle: TreasureAltarConnectionTargetHandle) => void;
};

function useExportableTarget(handle: SceneTargetHandle | null) {
  const host = useOptionalSceneHost();
  return useMemo<TreasureAltarExportableTarget | null>(() => {
    if (!host || !handle) return null;
    return Object.freeze({
      target: handle,
      exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) =>
        host.exportTarget({ ...request, target: handle }),
    });
  }, [handle, host]);
}

function uniqueByKey<T extends Readonly<{ key: string }>>(items: readonly T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function ArtifactSlot({
  artifact,
  inspect,
  onArtifactTargetHandlesChange,
}: {
  artifact: PublicArtifact;
  inspect: TreasureAltarProps["inspect"];
  onArtifactTargetHandlesChange?: TreasureAltarProps["onArtifactTargetHandlesChange"];
}) {
  const known = Boolean(artifact.name) && artifact.state !== "SILHOUETTE";
  const layoutInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:altar-layout-source`,
      part: "artifact-slot-target",
      runtime: "motion" as const,
      allowedProperties: ["layout"] as const,
      properties: ["layout"] as const,
    }),
    [artifact.key],
  );
  const silhouetteInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:altar-silhouette`,
      part: "artifact-silhouette",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity", "filter"] as const,
    }),
    [artifact.key],
  );
  const endpointInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:altar-connection-endpoint`,
      part: "artifact-connection-endpoint",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "scale", "opacity", "filter"] as const,
    }),
    [artifact.key],
  );
  const {
    bindTarget: bindLayoutSource,
    handle: layoutSource,
    ownershipReady: layoutOwnershipReady,
  } = useRuntimeOwnedSceneTarget(layoutInput);
  const { bindTarget: bindSilhouette, handle: silhouette } = useSceneTargetRegistration(silhouetteInput);
  const { bindTarget: bindConnectionEndpoint, handle: connectionEndpoint } = useSceneTargetRegistration(endpointInput);
  const layoutSourceRegistration = useExportableTarget(layoutSource);
  const silhouetteRegistration = useExportableTarget(silhouette);
  const connectionEndpointRegistration = useExportableTarget(connectionEndpoint);
  const bindLayoutSourceNode = useCallback(
    (node: HTMLButtonElement | null) => bindLayoutSource(node),
    [bindLayoutSource],
  );

  useEffect(() => {
    onArtifactTargetHandlesChange?.({
      artifactKey: artifact.key,
      layoutSource: layoutSourceRegistration,
      cinematicDestination: silhouetteRegistration,
      silhouette: silhouetteRegistration,
      connectionEndpoint: connectionEndpointRegistration,
    });
    return () =>
      onArtifactTargetHandlesChange?.({
        artifactKey: artifact.key,
        layoutSource: null,
        cinematicDestination: null,
        silhouette: null,
        connectionEndpoint: null,
      });
  }, [
    artifact.key,
    connectionEndpointRegistration,
    layoutSourceRegistration,
    onArtifactTargetHandlesChange,
    silhouetteRegistration,
  ]);

  return (
    <motion.button
      ref={bindLayoutSourceNode}
      {...(layoutOwnershipReady ? { layout: true, layoutId: `artifact-${artifact.key}` } : {})}
      className={`artifact-slot state-${artifact.state.toLowerCase()}`}
      data-runtime-boundary="motion"
      data-runtime-lease={layoutOwnershipReady ? "ready" : "gated"}
      data-shared-layout-id={layoutOwnershipReady ? `artifact-${artifact.key}` : undefined}
      data-scene-part="artifact-slot-target"
      data-artifact-key={artifact.key}
      data-artifact-target-role="layout-source"
      style={{ left: `${artifact.displayX}%`, top: `${artifact.displayY}%` }}
      onClick={(event) => known && inspect(artifact.key, event.currentTarget)}
      aria-label={`${artifact.name ?? artifact.safeName ?? "Unknown artifact"}, ${artifact.state.toLowerCase()}`}
      disabled={!known}
    >
      <span
        ref={bindConnectionEndpoint}
        className="brass-mount"
        aria-hidden="true"
        data-runtime-boundary="gsap"
        data-scene-part="artifact-connection-endpoint"
        data-artifact-key={artifact.key}
        data-artifact-target-role="connection-endpoint"
        style={{ pointerEvents: "none" }}
      >
        <i />
        <i />
        <i />
      </span>
      <span
        ref={bindSilhouette}
        className="artifact-silhouette"
        aria-hidden="true"
        data-runtime-boundary="gsap"
        data-scene-part="artifact-silhouette"
        data-artifact-key={artifact.key}
        data-artifact-target-role="silhouette"
        style={{ pointerEvents: "none" }}
      >
        {artifact.key.includes("compass") || artifact.name?.toLowerCase().includes("compass") ? (
          <img
            src="/illustrations/artifacts/compass-needle.svg"
            alt=""
            aria-hidden="true"
            style={{ width: 72, height: 105, objectFit: "contain" }}
          />
        ) : (
          <span aria-hidden="true">{artifact.state === "SILHOUETTE" ? "?" : "✦"}</span>
        )}
      </span>
      <b>{artifact.name ?? artifact.safeName ?? "Unknown"}</b>
      <small>{artifact.category?.replaceAll("_", " ") ?? artifact.state}</small>
    </motion.button>
  );
}

function ArtifactConnectionPath({
  artifact,
  connected,
  onConnectionTargetHandleChange,
}: {
  artifact: PublicArtifact;
  connected: PublicArtifact;
  onConnectionTargetHandleChange?: TreasureAltarProps["onConnectionTargetHandleChange"];
}) {
  const pathInput = useMemo(
    () => ({
      targetKey: `artifact:${artifact.key}:connection-to:${connected.key}`,
      part: "artifact-connection-path",
      ownerHint: "gsap" as const,
      allowedProperties: ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"] as const,
    }),
    [artifact.key, connected.key],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(pathInput);
  const registration = useExportableTarget(handle);
  const bindPath = useCallback((node: SVGPathElement | null) => bindTarget(node), [bindTarget]);

  useEffect(() => {
    onConnectionTargetHandleChange?.({
      sourceArtifactKey: artifact.key,
      destinationArtifactKey: connected.key,
      target: registration,
    });
    return () =>
      onConnectionTargetHandleChange?.({
        sourceArtifactKey: artifact.key,
        destinationArtifactKey: connected.key,
        target: null,
      });
  }, [artifact.key, connected.key, onConnectionTargetHandleChange, registration]);

  return (
    <path
      ref={bindPath}
      data-scene-part="artifact-connection-path"
      data-runtime-boundary="gsap"
      data-source-artifact-key={artifact.key}
      data-destination-artifact-key={connected.key}
      style={{ pointerEvents: "none" }}
      d={`M${artifact.displayX * 10} ${artifact.displayY * 6.2} Q500 220 ${connected.displayX * 10} ${connected.displayY * 6.2}`}
    />
  );
}

export function TreasureAltar({
  snapshot,
  inspect,
  onArtifactTargetHandlesChange,
  onConnectionTargetHandleChange,
}: TreasureAltarProps) {
  const headingId = useId();
  const uniqueArtifacts = useMemo(() => uniqueByKey(snapshot.artifacts), [snapshot.artifacts]);
  const visible = uniqueArtifacts.filter((artifact) => artifact.state !== "UNKNOWN");
  const artifactsByKey = useMemo(
    () => new Map(uniqueArtifacts.map((artifact) => [artifact.key, artifact])),
    [uniqueArtifacts],
  );
  const altarLightInput = useMemo(
    () => ({
      targetKey: "treasure-altar:detail-light",
      part: "artifact-light",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity", "filter"] as const,
    }),
    [],
  );
  const { bindTarget: bindAltarLight } = useSceneTargetRegistration(altarLightInput);

  return (
    <section
      className="physical-section treasure-altar-section"
      aria-labelledby={headingId}
      data-section-heading
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Recovered Artifacts</p>
          <h2 id={headingId}>Artifact Collection</h2>
        </div>
        <p>Only Artifacts released for this Voyage appear here.</p>
      </header>
      <div className="altar-cabinet">
        <div className="altar-curtain left" aria-hidden="true" />
        <div className="altar-curtain right" aria-hidden="true" />
        <div
          className="altar-light"
          ref={bindAltarLight}
          data-scene-part="artifact-light"
          data-runtime-boundary="gsap"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        />
        <svg className="artifact-connections" viewBox="0 0 1000 620" aria-hidden="true">
          {visible
            .filter((artifact) => artifact.connectedArtifactKey)
            .map((artifact) => {
              const connected = artifactsByKey.get(artifact.connectedArtifactKey!);
              return connected && connected.state !== "UNKNOWN" ? (
                <ArtifactConnectionPath
                  key={`${artifact.key}:${connected.key}`}
                  artifact={artifact}
                  connected={connected}
                  onConnectionTargetHandleChange={onConnectionTargetHandleChange}
                />
              ) : null;
            })}
        </svg>
        <div className="assembly-outline" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {visible.length ? (
          visible.map((artifact) => (
            <ArtifactSlot
              key={artifact.key}
              artifact={artifact}
              inspect={inspect}
              onArtifactTargetHandlesChange={onArtifactTargetHandlesChange}
            />
          ))
        ) : (
          <div className="empty-altar">
            <span aria-hidden="true">◇</span>
            <strong>No Artifacts recovered yet</strong>
            <p>New Artifacts will appear here when the Captain releases them.</p>
          </div>
        )}
      </div>
      <div className="altar-legend">
        <span>
          <i className="unknown" />
          Unknown
        </span>
        <span>
          <i className="silhouette" />
          Silhouette
        </span>
        <span>
          <i className="awarded" />
          Awarded
        </span>
        <span>
          <i className="connected" />
          Connected
        </span>
      </div>
    </section>
  );
}
