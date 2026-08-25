"use client";

import { useEffect, useState } from "react";

type Compatibility = {
  status: string;
  sourceChecksum: string;
  policyVersion: string;
  supportedBlockCount: number;
  findings: Array<{ code: string; blockId?: string; message: string }>;
};

const nextAction = (compatibility: Compatibility) => {
  if (compatibility.status === "COMPATIBLE")
    return "The current governed reader supports this source without an upcast.";
  if (compatibility.status === "COMPATIBLE_WITH_UPCAST")
    return "Review the in-memory upcasts before publishing; the immutable source is unchanged.";
  if (compatibility.status === "UNSUPPORTED" || compatibility.status === "CORRUPT_OR_INVALID")
    return "Repair or migrate the affected Passage before publication.";
  return "Review compatibility findings before the server evaluates publication.";
};

export function DrydockCompatibilityPanel({ taleId, csrfToken }: { taleId: string; csrfToken: string }) {
  const [compatibility, setCompatibility] = useState<Compatibility | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch(`/api/studio/tales/${encodeURIComponent(taleId)}/compatibility`, {
      cache: "no-store",
      headers: { "x-csrf-token": csrfToken },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Compatibility could not load its current server assessment.");
        return response.json() as Promise<{ compatibility: Compatibility }>;
      })
      .then((body) => active && setCompatibility(body.compatibility))
      .catch(
        (cause: unknown) =>
          active && setError(cause instanceof Error ? cause.message : "Compatibility could not load."),
      );
    return () => {
      active = false;
    };
  }, [csrfToken, taleId]);

  return (
    <section className="studio-panel" aria-labelledby="drydock-compatibility-title">
      <p className="eyebrow">Drydock Compatibility</p>
      <h2 id="drydock-compatibility-title">Compatibility</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : !compatibility ? (
        <p aria-live="polite">Checking current reader compatibility…</p>
      ) : (
        <>
          <p aria-live="polite">
            <strong>{compatibility.status.replaceAll("_", " ")}</strong>
          </p>
          <p>
            Exact source checksum: <code>{compatibility.sourceChecksum}</code>
          </p>
          <p>
            Policy: {compatibility.policyVersion}; supported Passages: {compatibility.supportedBlockCount}.
          </p>
          <p>{nextAction(compatibility)}</p>
          {compatibility.findings.length ? (
            <section aria-label="Compatibility findings">
              <h3>Compatibility findings</h3>
              <ul>
                {compatibility.findings.map((finding) => (
                  <li key={`${finding.code}:${finding.blockId ?? "source"}`}>
                    {finding.code}
                    {finding.blockId ? ` (${finding.blockId})` : ""}: {finding.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p>No compatibility findings were reported.</p>
          )}
        </>
      )}
    </section>
  );
}
