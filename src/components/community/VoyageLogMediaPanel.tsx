"use client";
import { useEffect, useState } from "react";
type Candidate = {
  sourceOpaqueId: string;
  detectedMediaType: string;
  eligibility: "READY" | "QUARANTINED" | "UNAVAILABLE";
};
type Selected = { id: string; detectedMediaType: string; processingStatus: string; scanStatus: string };
const csrfHeaders = (csrf: string) => ({ "content-type": "application/json", "x-csrf-token": csrf });
export function VoyageLogMediaPanel({ voyageLogId }: { voyageLogId?: string }) {
  const [csrf, setCsrf] = useState("");
  const [candidates, setCandidates] = useState<readonly Candidate[]>([]);
  const [selected, setSelected] = useState<readonly Selected[]>([]);
  const [message, setMessage] = useState("Sign in to select publication-safe media.");
  async function refresh() {
    if (!voyageLogId) {
      setMessage("Choose a Voyage Log before selecting media.");
      return;
    }
    const session = await fetch("/api/player/session", { cache: "no-store" }).then((r) =>
      r.ok ? (r.json() as Promise<{ csrfToken?: string }>) : null,
    );
    if (!session?.csrfToken) return;
    setCsrf(session.csrfToken);
    const response = await fetch(`/api/community/voyage-logs/media?voyageLogId=${encodeURIComponent(voyageLogId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setCandidates([]);
      setSelected([]);
      setMessage("Publication-safe media is currently unavailable.");
      return;
    }
    const payload = (await response.json()) as {
      candidates: readonly Candidate[];
      selected: readonly Selected[];
      providerStatus: string;
    };
    setCandidates(payload.candidates);
    setSelected(payload.selected);
    setMessage(
      payload.providerStatus === "NOT_CONFIGURED"
        ? "New media selection is unavailable until Sealed Hold is connected."
        : payload.candidates.length
          ? "Choose an approved protected-media candidate."
          : "No media is ready for publication.",
    );
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [voyageLogId]);
  async function select(sourceOpaqueId: string) {
    if (!voyageLogId || !csrf) return;
    const response = await fetch("/api/community/voyage-logs/media", {
      method: "POST",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ voyageLogId, sourceOpaqueId }),
    });
    setMessage(
      response.ok ? "Media selected; publication consent may need review." : "Media could not be selected safely.",
    );
    if (response.ok) await refresh();
  }
  async function remove(mediaId: string) {
    if (!voyageLogId || !csrf) return;
    const response = await fetch("/api/community/voyage-logs/media", {
      method: "DELETE",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ voyageLogId, mediaId }),
    });
    setMessage(
      response.ok ? "Selected media removed; publication consent now requires review." : "Media could not be removed.",
    );
    if (response.ok) await refresh();
  }
  return (
    <section className="community-workflow__panel community-workflow__media" aria-labelledby="voyage-log-media-title">
      <h2 id="voyage-log-media-title">Publication-safe media</h2>
      <p>Media is read only through Sealed Hold. Original files and storage references are never shown here.</p>
      <p aria-live="polite">{message}</p>
      <section className="community-workflow__media-selected" aria-label="Selected Voyage Log media">
        <h3>Selected media</h3>
        {selected.length ? (
          <ul>
            {selected.map((item) => (
              <li key={item.id}>
                {item.detectedMediaType} ({item.scanStatus}, {item.processingStatus}){" "}
                <button type="button" disabled={!csrf} onClick={() => void remove(item.id)}>
                  Remove selected media
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No media is selected.</p>
        )}
      </section>
      <ul className="community-workflow__media-candidates" aria-label="Eligible protected-media candidates">
        {candidates.map((candidate) => (
          <li key={candidate.sourceOpaqueId}>
            <span>
              {candidate.detectedMediaType} {candidate.eligibility}
            </span>{" "}
            <button
              type="button"
              disabled={candidate.eligibility !== "READY" || !csrf}
              onClick={() => void select(candidate.sourceOpaqueId)}
            >
              Select for this Voyage Log
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
