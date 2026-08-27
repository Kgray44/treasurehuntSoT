"use client";

import { useEffect, useState } from "react";
import { fetchDrydockJson } from "@/components/studio/drydock-json-fetch";

type Requirement = { id: string; resolver: string; capability: string };
type Readiness = {
  status: string;
  sourceChecksum: string;
  blockingIssues?: Array<{ code: string }>;
  missingEvidence?: Requirement[];
  requiredSuites?: Array<{ suiteId: string; status: string; reason: string }>;
  warnings?: Array<{ code: string }>;
  waivers?: string[];
  externalEvidence?: Array<{ providerId: string; evidenceKind: string; status: string; safeSummary: string }>;
  evidenceDraft?: { validationRunId: string; requiredScenarioSuiteIds: string[] };
  publishedVersionId?: string;
  evidenceId?: string;
  safeFailureCode?: string;
};

const nextAction = (readiness: Readiness) => {
  if (readiness.status === "NEEDS_REPAIR") return "Fix blocking issues or provide the missing current-source evidence.";
  if (readiness.status === "TRIALS_INCOMPLETE") return "Run the required Sea Trial Suite against this exact source.";
  if (readiness.status === "READY_WITH_WARNINGS")
    return "Review the remaining warnings and governed waivers before publishing.";
  if (readiness.status === "VERIFIED") return "The server may now evaluate an immutable publication transaction.";
  if (readiness.status === "PUBLICATION_PENDING")
    return "Publication is in progress; do not treat this as a published version.";
  if (readiness.status === "PUBLISHED") return "Immutable publication evidence is bound to the returned version.";
  if (readiness.status === "PUBLICATION_FAILED")
    return "Publication did not commit. Preserve current verification only while its source remains current.";
  return "The server is still collecting the current launch facts.";
};

export function DrydockLaunchGate({
  taleId,
  csrfToken,
  onReadinessChange,
}: {
  taleId: string;
  csrfToken: string;
  onReadinessChange?: (status: string) => void;
}) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetchDrydockJson<{ readiness?: Readiness }>(`/api/studio/tales/${encodeURIComponent(taleId)}/readiness`, {
      cache: "no-store",
      headers: { "x-csrf-token": csrfToken },
    })
      .then((response) => {
        if (!active) return;
        if (!response.ok || !response.body.readiness)
          throw new Error("The Launch Gate could not load its current server decision.");
        const { readiness } = response.body;
        setReadiness(readiness);
        onReadinessChange?.(readiness.status);
      })
      .catch(
        (cause: unknown) =>
          active && setError(cause instanceof Error ? cause.message : "The Launch Gate could not load."),
      );
    return () => {
      active = false;
    };
  }, [csrfToken, onReadinessChange, taleId]);

  return (
    <section className="studio-panel" aria-labelledby="drydock-launch-gate-title">
      <p className="eyebrow">Drydock Overview</p>
      <h2 id="drydock-launch-gate-title">Launch Gate</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : !readiness ? (
        <p aria-live="polite">Checking current launch readiness…</p>
      ) : (
        <>
          <p aria-live="polite">
            <strong>{readiness.status.replaceAll("_", " ")}</strong>
          </p>
          <p>
            Exact source checksum: <code>{readiness.sourceChecksum}</code>
          </p>
          <p>{nextAction(readiness)}</p>
          {readiness.blockingIssues?.length ? (
            <p>{readiness.blockingIssues.length} blocking issue(s) require repair.</p>
          ) : null}
          {readiness.missingEvidence?.length ? (
            <section aria-label="Missing evidence">
              <h3>Missing current-source evidence</h3>
              <ul>
                {readiness.missingEvidence.map((requirement) => (
                  <li key={requirement.id}>
                    {requirement.id}: {requirement.resolver} ({requirement.capability})
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {readiness.requiredSuites?.length ? (
            <section aria-label="Required Sea Trials">
              <h3>Required Sea Trials</h3>
              <ul>
                {readiness.requiredSuites.map((suite) => (
                  <li key={suite.suiteId}>
                    {suite.suiteId}: {suite.status} â€” {suite.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {readiness.externalEvidence?.length ? (
            <section aria-label="External evidence">
              <h3>External evidence</h3>
              <ul>
                {readiness.externalEvidence.map((evidence) => (
                  <li key={`${evidence.providerId}:${evidence.evidenceKind}`}>
                    {evidence.providerId}/{evidence.evidenceKind}: {evidence.status}. {evidence.safeSummary}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {readiness.warnings?.length ? <p>{readiness.warnings.length} governed warning(s) remain visible.</p> : null}
          {readiness.waivers?.length ? <p>{readiness.waivers.length} governed waiver(s) remain active.</p> : null}
          {readiness.evidenceDraft ? (
            <p>
              Verification receipt: {readiness.evidenceDraft.validationRunId};{" "}
              {readiness.evidenceDraft.requiredScenarioSuiteIds.length} required Suite(s).
            </p>
          ) : null}
          {readiness.status === "PUBLISHED" ? (
            <p>
              Published version: <code>{readiness.publishedVersionId}</code>; immutable evidence:{" "}
              <code>{readiness.evidenceId}</code>.
            </p>
          ) : null}
          {readiness.status === "PUBLICATION_FAILED" ? (
            <p role="alert">Safe failure code: {readiness.safeFailureCode}</p>
          ) : null}
          <p>The publish action remains server-authoritative and is enabled only after a VERIFIED decision.</p>
        </>
      )}
    </section>
  );
}
