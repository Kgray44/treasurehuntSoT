"use client";

import { useEffect, useState } from "react";

type Readiness = { status: string; sourceChecksum: string; blockingIssues?: unknown[]; requiredSuites?: Array<{ suiteId: string; status: string; reason: string }>; warnings?: unknown[] };

export function DrydockLaunchGate({ taleId, csrfToken }: { taleId: string; csrfToken: string }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch(`/api/studio/tales/${encodeURIComponent(taleId)}/readiness`, { cache: "no-store", headers: { "x-csrf-token": csrfToken } })
      .then(async (response) => {
        if (!response.ok) throw new Error("The Launch Gate could not load its current server decision.");
        return response.json() as Promise<{ readiness: Readiness }>;
      })
      .then((body) => active && setReadiness(body.readiness))
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : "The Launch Gate could not load."));
    return () => { active = false; };
  }, [csrfToken, taleId]);
  return <section className="studio-panel" aria-labelledby="drydock-launch-gate-title">
    <p className="eyebrow">Drydock</p><h2 id="drydock-launch-gate-title">Launch Gate</h2>
    {error ? <p role="alert">{error}</p> : !readiness ? <p aria-live="polite">Checking current launch readiness…</p> : <>
      <p><strong>{readiness.status.replaceAll("_", " ")}</strong></p>
      <p>Exact source checksum: <code>{readiness.sourceChecksum}</code></p>
      {readiness.blockingIssues?.length ? <p>{readiness.blockingIssues.length} blocking issue(s) require repair.</p> : null}
      {readiness.requiredSuites?.length ? <ul>{readiness.requiredSuites.map((suite) => <li key={suite.suiteId}>{suite.suiteId}: {suite.status} — {suite.reason}</li>)}</ul> : null}
      {readiness.warnings?.length ? <p>{readiness.warnings.length} governed warning(s) remain visible.</p> : null}
      <p>The publish action remains server-authoritative and is enabled only after a VERIFIED decision.</p>
    </>}
  </section>;
}
