"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { studioCopy } from "@/language/studio-copy";

type PublishState = "idle" | "publishing" | "published" | "failed";

export function StudioStatusHeader({
  taleId,
  title,
  canUndo,
  canRedo,
  saveState,
  saveVisualState,
  publishState,
  publishedVersion,
  moreOpen,
  reducedMotion,
  layoutDuration,
  stateDuration,
  ceremonyDuration,
  onUndo,
  onRedo,
  onPreview,
  onValidate,
  onPublish,
  onOpenCommands,
  onToggleMore,
  onCloseMore,
  onDuplicate,
  onArchive,
}: {
  taleId: string;
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  saveState: string;
  saveVisualState: string;
  publishState: PublishState;
  publishedVersion: string | null;
  moreOpen: boolean;
  reducedMotion: boolean;
  layoutDuration: number;
  stateDuration: number;
  ceremonyDuration: number;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onValidate: () => void;
  onPublish: () => void;
  onOpenCommands: () => void;
  onToggleMore: () => void;
  onCloseMore: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  return (
    <motion.header
      className="editor-topbar"
      layoutId={`studio-editor-shell-${taleId}`}
      transition={{ duration: layoutDuration }}
    >
      <div>
        <Link href="/studio/library">← Studio</Link>
        <span className="draft-mark">Draft</span>
        <h1>{title}</h1>
      </div>
      <div className="editor-history">
        <button disabled={!canUndo} onClick={onUndo} aria-label="Undo last edit">
          ↶ Undo
        </button>
        <button disabled={!canRedo} onClick={onRedo} aria-label="Redo edit">
          ↷ Redo
        </button>
      </div>
      <p
        className={`save-state ${saveState.includes("failed") || saveState.includes("Conflict") ? "error" : ""}`}
        data-save-state={saveVisualState}
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={saveState}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: stateDuration }}
          >
            {saveState}
          </motion.span>
        </AnimatePresence>
      </p>
      <AnimatePresence initial={false}>
        {publishState === "published" && publishedVersion ? (
          <motion.span
            key={publishedVersion}
            className="publish-authority-seal"
            data-authority-state="confirmed"
            role="status"
            initial={reducedMotion ? false : { opacity: 0, scale: 1.2, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ceremonyDuration }}
          >
            <span aria-hidden="true">◆</span> Version {publishedVersion} published
          </motion.span>
        ) : null}
      </AnimatePresence>
      <div className="editor-primary-actions">
        <button type="button" onClick={onOpenCommands} aria-label="Open Studio command palette">
          Commands <kbd>Ctrl K</kbd>
        </button>
        <button type="button" onClick={onPreview}>
          {studioCopy.previewVoyage.value}
        </button>
        <button type="button" onClick={onValidate}>
          {studioCopy.validateChronicle.value}
        </button>
        <button
          type="button"
          className="publish-button"
          data-authority-state={publishState}
          disabled={publishState === "publishing"}
          aria-busy={publishState === "publishing"}
          onClick={onPublish}
        >
          {publishState === "publishing" ? "Publishing..." : studioCopy.publishChronicle.value}
        </button>
        <div className="editor-more">
          <button
            type="button"
            className="editor-more-trigger"
            aria-expanded={moreOpen}
            aria-controls="studio-more-actions"
            onClick={onToggleMore}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCloseMore();
            }}
          >
            More
          </button>
          {moreOpen ? (
            <div id="studio-more-actions">
              <Link href={`/studio/tales/${taleId}/settings`}>Chronicle settings</Link>
              <Link href={`/studio/tales/${taleId}/versions`}>{studioCopy.versionHistory.value}</Link>
              <button type="button" onClick={onDuplicate}>
                {studioCopy.duplicateChronicle.value}
              </button>
              <button type="button" className="danger" onClick={onArchive}>
                {studioCopy.archiveChronicle.value}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </motion.header>
  );
}
