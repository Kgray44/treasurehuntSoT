"use client";

import { useMemo, useState } from "react";
import type { CapturePlatformAdapter } from "@/vision/capture-adapters";
import { recordingRoles } from "@/vision/authoring-domain";
import type {
  AuthoringMutate,
  StudioAuthoringAggregate,
  StudioAsset,
} from "@/components/studio/vision-authoring-types";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecordingReview({
  aggregate,
  adapter,
  csrfToken,
  mutate,
  reload,
}: {
  aggregate: StudioAuthoringAggregate;
  adapter: CapturePlatformAdapter;
  csrfToken: string;
  mutate: AuthoringMutate;
  reload: () => Promise<void>;
}) {
  const active = useMemo(() => aggregate.assets.filter((asset) => !asset.deletedAt), [aggregate.assets]);
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? "");
  const selected = active.find((asset) => asset.id === selectedId) ?? active[0];
  const [draftState, setDraft] = useState<StudioAsset | null>(selected ?? null);
  const [preview, setPreview] = useState<{ previewUrl: string; expiresAt: string } | null>(null);
  const [splitAt, setSplitAt] = useState(0);
  const [message, setMessage] = useState("");

  if (!active.length)
    return (
      <p className="authoring-empty">
        No saved recording manifests yet. Use the Companion panel above; Studio never invents a capture.
      </p>
    );
  if (!selected) return null;
  const draft = draftState?.id === selected.id ? draftState : selected;
  const referenced =
    aggregate.visualRegions.some((region) => region.recordingAssetId === selected.id) ||
    aggregate.buildJobs.length > 0 ||
    aggregate.tests.some(
      (test) =>
        test.lockedAt && Array.isArray(test.environment.assetIds) && test.environment.assetIds.includes(selected.id),
    );

  async function remove() {
    if (
      referenced ||
      !window.confirm(
        "Delete this managed local recording and mark its Studio manifest deleted? This cannot be undone.",
      )
    )
      return;
    setMessage("");
    try {
      await adapter.deleteCreatorArtifact(selected.id);
      const response = await fetch(`/api/vision-capture-sessions/${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The server manifest could not be marked deleted.");
      setSelectedId("");
      await reload();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Delete failed. The recording state must be reviewed in Companion.",
      );
    }
  }

  return (
    <section className="recording-review">
      <header>
        <div>
          <p className="eyebrow">Recording review</p>
          <h3>Curate retained evidence</h3>
        </div>
        <span>
          {active.length} recording{active.length === 1 ? "" : "s"}
        </span>
      </header>
      <label>
        <span>Recording</span>
        <select
          value={selected.id}
          onChange={(event) => {
            const next = active.find((asset) => asset.id === event.target.value) ?? null;
            setSelectedId(event.target.value);
            setDraft(next);
            setPreview(null);
            setSplitAt(Math.round((next?.durationMs ?? 0) / 2));
          }}
        >
          {active.map((asset) => (
            <option value={asset.id} key={asset.id}>
              {asset.label ?? asset.id} · {asset.role.toLocaleLowerCase().replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div className="recording-review-grid">
        <div>
          {preview ? (
            <video className="creator-preview" src={preview.previewUrl} controls muted />
          ) : (
            <div className="recording-placeholder">Preview stays local and expires after use.</div>
          )}
          <div className="inline-actions">
            <button
              type="button"
              onClick={() =>
                void adapter
                  .previewCreatorArtifact(selected.id)
                  .then(setPreview)
                  .catch((cause) => setMessage(cause instanceof Error ? cause.message : "Preview unavailable."))
              }
            >
              Preview
            </button>
            {preview && (
              <a href={preview.previewUrl} download={`${selected.label ?? selected.id}.webm`}>
                Export local copy
              </a>
            )}
            <a href="#studio-capture">Record replacement</a>
          </div>
          <dl className="asset-facts">
            <div>
              <dt>Duration</dt>
              <dd>{selected.durationMs === null ? "unknown" : `${(selected.durationMs / 1000).toFixed(1)} s`}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(selected.fileSize)}</dd>
            </div>
            <div>
              <dt>Integrity</dt>
              <dd>{selected.integrityState.toLocaleLowerCase().replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>{selected.cloudState.toLocaleLowerCase().replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <p className="quality-line">
            Quality:{" "}
            {typeof selected.qualitySummary.usableFrameCount === "number"
              ? `${selected.qualitySummary.usableFrameCount} usable frames`
              : "Companion did not report a usable-frame count"}
            {selected.qualitySummary.frozen === true ? " · frozen capture detected" : ""}
          </p>
        </div>
        <div>
          <label>
            <span>Name</span>
            <input value={draft.label ?? ""} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          </label>
          <label>
            <span>Notes</span>
            <textarea
              rows={3}
              value={draft.notes ?? ""}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          <label>
            <span>Evidence role</span>
            <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
              {recordingRoles.map((role) => (
                <option value={role} key={role}>
                  {role.toLocaleLowerCase().replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={draft.isUsable}
              onChange={(event) => setDraft({ ...draft, isUsable: event.target.checked })}
            />
            <span>Usable in BuildInput</span>
          </label>
          <div className="range-grid">
            <label>
              <span>Trim start (ms)</span>
              <input
                type="number"
                min={0}
                value={draft.segmentStartMs ?? 0}
                onChange={(event) => setDraft({ ...draft, segmentStartMs: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>Trim end (ms)</span>
              <input
                type="number"
                min={1}
                value={draft.segmentEndMs ?? draft.durationMs ?? 1}
                onChange={(event) => setDraft({ ...draft, segmentEndMs: Number(event.target.value) })}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              void mutate({
                operation: "UPDATE_ASSET",
                artifactId: draft.id,
                label: draft.label ?? "Recording",
                notes: draft.notes ?? "",
                role: draft.role,
                isUsable: draft.isUsable,
                segmentStartMs: draft.segmentStartMs,
                segmentEndMs: draft.segmentEndMs,
              })
            }
          >
            Save review
          </button>
          <div className="split-control">
            <label>
              <span>Split at (ms)</span>
              <input
                type="number"
                min={1}
                max={(selected.durationMs ?? 1) - 1}
                value={splitAt}
                onChange={(event) => setSplitAt(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() => void mutate({ operation: "SPLIT_ASSET", artifactId: selected.id, splitAtMs: splitAt })}
            >
              Create non-destructive logical segments
            </button>
            <small>
              The media file is not re-encoded; Studio stores two governed time ranges over the same local artifact.
            </small>
          </div>
          <button
            type="button"
            className="danger-button"
            disabled={referenced}
            title={referenced ? "Remove visual regions, locked tests, and build snapshots first." : undefined}
            onClick={() => void remove()}
          >
            Delete recording
          </button>
          {referenced && (
            <p className="dependency-note">
              Deletion is blocked because this recording is referenced by a region, locked test, or prepared BuildInput.
            </p>
          )}
        </div>
      </div>
      {message && (
        <p className="studio-error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
