"use client";

/* eslint-disable @next/next/no-img-element -- Artifact SVGs participate in direct FLIP-style transitions. */

import { motion } from "motion/react";
import type { PublicSnapshot } from "@/domain/story";

export function TreasureAltar({
  snapshot,
  inspect,
}: {
  snapshot: PublicSnapshot;
  inspect: (key: string, element: HTMLElement) => void;
}) {
  const visible = snapshot.artifacts.filter((artifact) => artifact.state !== "UNKNOWN");
  return (
    <section
      className="physical-section treasure-altar-section"
      aria-labelledby="altar-heading"
      data-section-heading
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Recovered curiosities</p>
          <h2 id="altar-heading">Treasure Altar</h2>
        </div>
        <p>Every silhouette, name, and connection remains driven by the captain&apos;s ledger.</p>
      </header>
      <div className="altar-cabinet">
        <div className="altar-curtain left" aria-hidden="true" />
        <div className="altar-curtain right" aria-hidden="true" />
        <div className="altar-light" data-scene-part="artifact-light" data-gsap-owned aria-hidden="true" />
        <svg className="artifact-connections" viewBox="0 0 1000 620" aria-hidden="true">
          {snapshot.artifacts
            .filter((artifact) => artifact.connectedArtifactKey)
            .map((artifact) => {
              const connected = snapshot.artifacts.find((item) => item.key === artifact.connectedArtifactKey);
              if (!connected) return null;
              return (
                <path
                  key={artifact.key}
                  data-scene-part="artifact-connection-path"
                  data-gsap-owned
                  d={`M${artifact.displayX * 10} ${artifact.displayY * 6.2} Q500 220 ${connected.displayX * 10} ${connected.displayY * 6.2}`}
                />
              );
            })}
        </svg>
        <div className="assembly-outline" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {visible.length ? (
          visible.map((artifact, index) => {
            const known = Boolean(artifact.name) && artifact.state !== "SILHOUETTE";
            return (
              <motion.button
                layoutId={`artifact-${artifact.key}`}
                key={artifact.key}
                className={`artifact-slot state-${artifact.state.toLowerCase()}`}
                data-scene-part={index === 0 ? "artifact-slot-target" : "artifact-slot"}
                style={{ left: `${artifact.displayX}%`, top: `${artifact.displayY}%` }}
                onClick={(event) => known && inspect(artifact.key, event.currentTarget)}
                aria-label={`${artifact.name ?? artifact.safeName ?? "Unknown artifact"}, ${artifact.state.toLowerCase()}`}
                disabled={!known}
              >
                <span className="brass-mount" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {index === 0 && known ? (
                  <img src="/illustrations/artifacts/compass-needle.svg" alt="" aria-hidden="true" />
                ) : (
                  <span className="artifact-silhouette" aria-hidden="true">
                    {artifact.state === "SILHOUETTE" ? "?" : "✦"}
                  </span>
                )}
                <b>{artifact.name ?? artifact.safeName ?? "Unknown"}</b>
                <small>{artifact.category?.replaceAll("_", " ") ?? artifact.state}</small>
              </motion.button>
            );
          })
        ) : (
          <div className="empty-altar">
            <span aria-hidden="true">◇</span>
            <strong>The velvet remembers no relic yet</strong>
            <p>Empty mounts wait without revealing what belongs to them.</p>
          </div>
        )}
        <div className="artifact-reveal-prop" data-scene-part="artifact-reveal" data-gsap-owned aria-hidden="true">
          <img src="/illustrations/artifacts/compass-needle.svg" alt="" />
        </div>
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
