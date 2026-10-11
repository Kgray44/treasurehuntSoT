"use client";
import { useState } from "react";
import { enableAdaptiveAuthoring, interpretPlacementPhrase } from "@/parallax/adaptive-authoring";
import { draftSchema, type SpatialDraft } from "@/parallax/authoring";
import styles from "./SpatialStudio.module.css";

/** Review seam: proposal preview is transient; canonical apply is one existing history edit. */
export function PlacementComposer({
  draft,
  selectedId,
  aiAvailable,
  onPreview,
  onApply,
}: {
  draft: SpatialDraft;
  selectedId: string | null;
  aiAvailable: boolean;
  onPreview: (draft: SpatialDraft | null) => void;
  onApply: (draft: SpatialDraft) => void;
}) {
  const [request, setRequest] = useState(""),
    [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<{
    draft: SpatialDraft;
    binding: string;
    selected: string;
    explanation: string;
  } | null>(null);
  const valid = proposal?.binding === JSON.stringify(draft) && proposal?.selected === selectedId;
  return (
    <section className={styles.composer} aria-label="Contextual spatial assistance">
      <div className={styles.assistantHeading}>
        <span>✦ SPATIAL ASSISTANCE</span>
        <small>
          {aiAvailable
            ? "Configured provider available in AI assistance"
            : "AI provider unavailable · supported phrase rules available"}
        </small>
      </div>
      <div className={styles.commandLine}>
        <input
          aria-label="Spatial placement instruction"
          maxLength={500}
          value={request}
          onChange={(e) => {
            setRequest(e.target.value);
            setProposal(null);
            onPreview(null);
          }}
          placeholder="Place the selected letter on a table near the entrance…"
        />
        <button
          disabled={!selectedId || !request.trim()}
          onClick={() => {
            const result = interpretPlacementPhrase(request, selectedId!);
            setMessage(result.explanation);
            if (result.status !== "PROPOSED") {
              setProposal(null);
              onPreview(null);
              return;
            }
            const next = enableAdaptiveAuthoring(draft);
            const index = next.content.adaptive!.recipes.findIndex((r) => r.entityId === selectedId);
            next.content.adaptive!.recipes[index] = result.recipe;
            const parsed = draftSchema.parse(next);
            setProposal({
              draft: parsed,
              binding: JSON.stringify(draft),
              selected: selectedId!,
              explanation: result.explanation,
            });
            onPreview(parsed);
          }}
        >
          Preview placement
        </button>
      </div>
      {message && (
        <div className={styles.proposalReview}>
          <p>{message}</p>
          {proposal && (
            <>
              <strong>
                {valid
                  ? "PROPOSAL PREVIEW · draft unchanged"
                  : "STALE PROPOSAL · scene changed; request a fresh preview"}
              </strong>
              <small>
                {proposal.draft.content
                  .adaptive!.recipes.find((r) => r.entityId === proposal.selected)!
                  .preferredSurfaces.join(" / ")}{" "}
                · safety exclusions enforced · synthetic resolution
              </small>
              <button
                disabled={!valid}
                onClick={() => {
                  if (!valid) return;
                  onApply(proposal.draft);
                  setProposal(null);
                  onPreview(null);
                  setMessage("Placement applied as one reversible edit. Undo restores the previous scene.");
                }}
              >
                Approve placement
              </button>
              <button
                onClick={() => {
                  setProposal(null);
                  onPreview(null);
                  setMessage("");
                }}
              >
                Discard preview
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
