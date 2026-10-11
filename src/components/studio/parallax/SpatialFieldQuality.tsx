"use client";
import { useState, useRef, useEffect } from "react";
import type { SpatialDraft } from "@/parallax/authoring";
import type { creatorFieldQuality } from "@/parallax/field-service";
import styles from "./SpatialStudio.module.css";
type Quality = Awaited<ReturnType<typeof creatorFieldQuality>>;
export function SpatialFieldQuality({
  draft,
  api,
  replace,
}: {
  draft: SpatialDraft;
  api: (body: unknown) => Promise<Quality & { reviewReceiptId: string; maturity: string }>;
  replace: (draft: SpatialDraft) => void;
}) {
  const [quality, setQuality] = useState<Quality | null>(null),
    [selected, setSelected] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const a = draft.content.adaptive;
  const latestDraft = useRef(draft);
  useEffect(() => {
    latestDraft.current = draft;
  }, [draft]);
  if (!a) return null;
  const load = async () => {
    const data = await api({ action: "FIELD_QUALITY", definitionId: draft.content.definitionId, draft });
    setQuality(data);
    return data;
  };
  const action = (run: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    void run()
      .catch((e) => setMessage(e.message))
      .finally(() => setBusy(false));
  };
  const row = quality?.observations.find((r) => r.id === selected);
  const next =
    quality?.review?.matchesDraftRecipes === false
      ? "CREATOR_REVIEWED"
      : quality?.review?.maturity === "CREATOR_REVIEWED"
        ? "CALIBRATED"
        : quality?.review?.maturity === "CALIBRATED"
          ? "VERIFIED"
          : "CREATOR_REVIEWED";
  return (
    <details className={styles.fieldQuality}>
      <summary>Field quality and Creator calibration review</summary>
      <p>
        Consent-based, bounded categories. Physical reports are self-reported; software does not certify AR accuracy.
        Simulation never promotes physical maturity.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          action(async () => {
            await load();
          })
        }
      >
        Load field quality
      </button>
      {quality && (
        <>
          <p>Evidence maturity: {quality.maturity}. Published recipes stay pinned when evidence changes.</p>
          <table>
            <caption>Placement quality by evidence source</caption>
            <thead>
              <tr>
                <th>Source</th>
                <th>Encounters</th>
                <th>Resolution</th>
                <th>Median search</th>
                <th>Exact reveal</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Synthetic", quality.quality.simulated],
                  ["Physical reports", quality.quality.physicalReports],
                ] as const
              ).map(([label, stats]) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>{stats.encounters}</td>
                  <td>{stats.resolutionSuccessPercent}%</td>
                  <td>{stats.medianSearchSeconds}s</td>
                  <td>{stats.exactRevealPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul>
            {quality.quality.physicalReports.guidance.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <label>
            Consented observation
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select evidence to review</option>
              {quality.observations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.versionId} · {r.metadata.provenance} · {r.metadata.placementQuality}
                </option>
              ))}
            </select>
          </label>
          {row && (
            <p>
              Surface: {row.metadata.surface ?? "none"}. Confidence: {row.metadata.confidence}. Search:{" "}
              {row.metadata.meaningfulSearchSeconds}s. Use placement controls to make bounded refinements, then approve
              a new recipe version.
            </p>
          )}
          <button
            disabled={
              busy ||
              !row ||
              row.metadata.provenance !== "PLAYER_REPORTED_PHYSICAL" ||
              (quality.review?.maturity === "VERIFIED" && quality.review.matchesDraftRecipes !== false)
            }
            onClick={() =>
              action(async () => {
                if (!row) return;
                const reviewBase = JSON.stringify(draft);
                const review = await api({
                  action: "CALIBRATION_REVIEW",
                  draft,
                  review: {
                    definitionId: draft.content.definitionId,
                    versionId: row.versionId,
                    evidenceId: row.id,
                    maturity: next,
                    expectedReviewId: quality.review?.id ?? null,
                    expectedRevision: quality.review?.revision ?? 0,
                  },
                });
                if (JSON.stringify(latestDraft.current) !== reviewBase) {
                  setQuality(null);
                  setMessage(
                    "The review was recorded for its original recipe. Your draft changed; load field quality again before applying evidence.",
                  );
                  return;
                }
                replace({
                  ...draft,
                  content: {
                    ...draft.content,
                    adaptive: {
                      ...a,
                      authoringApproach: "EVIDENCE_CALIBRATED",
                      calibration: { ...a.calibration, maturity: next, reviewReceiptId: review.reviewReceiptId },
                    },
                  },
                });
                await load();
                setMessage("Evidence approved. Save and create a new immutable version to publish this refinement.");
              })
            }
          >
            {next === "CREATOR_REVIEWED"
              ? "Approve Creator review"
              : next === "CALIBRATED"
                ? "Approve calibration refinement"
                : "Verify independent later encounters"}
          </button>
        </>
      )}
      <p aria-live="polite">{message}</p>
    </details>
  );
}
