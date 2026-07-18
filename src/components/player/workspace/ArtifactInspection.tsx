"use client";

/* eslint-disable @next/next/no-img-element -- The artifact SVG is transformed directly during inspection. */

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { PublicArtifact } from "@/domain/story";

export function ArtifactInspection({
  artifact,
  close,
  restoreFocus,
}: {
  artifact: PublicArtifact;
  close: () => void;
  restoreFocus: HTMLElement | null;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previouslyFocused = restoreFocus ?? (document.activeElement as HTMLElement | null);
    node?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"),
      );
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
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previouslyFocused?.focus();
    };
  }, [close, restoreFocus]);
  return (
    <motion.div
      className="artifact-inspection-backdrop"
      onClick={close}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-name"
        className="artifact-inspection"
        onClick={(event) => event.stopPropagation()}
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 18, opacity: 0 }}
      >
        <button className="close-inspection" onClick={close}>
          Close inspection
        </button>
        <div className="inspection-pedestal">
          <motion.div
            layoutId={`artifact-${artifact.key}`}
            className="inspection-object"
            data-scene-part="artifact-reveal"
            data-gsap-owned
          >
            {artifact.key.includes("compass") || artifact.name?.toLowerCase().includes("compass") ? (
              <img src="/illustrations/artifacts/compass-needle.svg" alt="" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">✦</span>
            )}
          </motion.div>
          <div className="pointer-light" aria-hidden="true" />
        </div>
        <div className="artifact-story-card" data-scene-part="artifact-engraving" data-gsap-owned>
          <p className="eyebrow">{artifact.state.replaceAll("_", " ")}</p>
          <h2 id="artifact-name">{artifact.name}</h2>
          <p>{artifact.description}</p>
          {artifact.discoveryText && <blockquote>{artifact.discoveryText}</blockquote>}
          <dl>
            <div>
              <dt>Category</dt>
              <dd>{artifact.category?.replaceAll("_", " ")}</dd>
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
        </div>
      </motion.section>
    </motion.div>
  );
}
