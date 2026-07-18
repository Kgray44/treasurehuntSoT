"use client";

import { useCallback, useEffect, useState } from "react";

type Candidate = {
  id: string;
  sourceAttemptId: string;
  waypointVersionId: string;
  humanTruthLabel: string;
  candidateReason: string;
  proposedPartition: string;
  rawFramesRetained: boolean;
  status: string;
  dispositionReason: string | null;
  createdAt: string;
};

export function VisionImprovementQueue() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [csrf, setCsrf] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/vision-improvement-candidates", { cache: "no-store" });
    const body = (await response.json()) as { candidates?: Candidate[]; csrfToken?: string };
    if (!response.ok) return setMessage("The improvement queue is unavailable.");
    setCandidates(body.candidates ?? []);
    setCsrf(body.csrfToken ?? "");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/vision-improvement-candidates", { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({
        ok: response.ok,
        body: (await response.json()) as { candidates?: Candidate[]; csrfToken?: string },
      }))
      .then(({ ok, body }) => {
        if (!ok) return setMessage("The improvement queue is unavailable.");
        setCandidates(body.candidates ?? []);
        setCsrf(body.csrfToken ?? "");
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError"))
          setMessage("The improvement queue is unavailable.");
      });
    return () => controller.abort();
  }, []);

  async function dispose(candidateId: string, action: "ACCEPT_FOR_CORPUS" | "REJECT" | "DEFER") {
    const reason = window.prompt("Record the evidence-based disposition reason.");
    if (!reason) return;
    const response = await fetch("/api/vision-improvement-candidates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ candidateId, action, reason }),
    });
    setMessage(response.ok ? "Improvement candidate disposition saved and audited." : "Disposition failed.");
    await load();
  }

  return (
    <section aria-labelledby="improvement-queue-heading">
      <h2 id="improvement-queue-heading">Hard-negative and improvement queue</h2>
      <p>
        Captain truth labels create metadata-only candidates. Raw Player frames are not retained; accepting a candidate
        marks it for governed Creator review and does not silently alter a locked corpus.
      </p>
      {message && <p role="status">{message}</p>}
      {!candidates.length ? (
        <p>No truth-labeled candidates are queued.</p>
      ) : (
        <div className="release-issue-list">
          {candidates.map((candidate) => (
            <article key={candidate.id}>
              <p>
                <strong>{candidate.humanTruthLabel.replaceAll("_", " ")}</strong> ·{" "}
                {candidate.proposedPartition.replaceAll("_", " ")} · {candidate.status.replaceAll("_", " ")}
              </p>
              <p>{candidate.candidateReason}</p>
              <p>
                Waypoint version <code>{candidate.waypointVersionId}</code> · raw frames retained:{" "}
                {candidate.rawFramesRetained ? "yes" : "no"}
              </p>
              {["QUEUED", "DEFERRED"].includes(candidate.status) && (
                <div className="library-card-actions">
                  <button type="button" onClick={() => void dispose(candidate.id, "ACCEPT_FOR_CORPUS")}>
                    Accept for corpus review
                  </button>
                  <button type="button" onClick={() => void dispose(candidate.id, "DEFER")}>
                    Defer
                  </button>
                  <button type="button" onClick={() => void dispose(candidate.id, "REJECT")}>
                    Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
