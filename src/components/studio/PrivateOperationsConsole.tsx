"use client";
import { useEffect, useState } from "react";
type State = {
  providers?: Array<{ kind: string; provider: string; configurationState: string; safeCode: string }>;
  backupRuns?: Array<{ backupId: string; state: string; verifiedAt?: string }>;
  repairs?: Array<{ digest: string; state: string; dryRun: boolean; expiresAt: string; _count: { actions: number } }>;
  drills?: Array<{ targetIdentity: string; state: string; resultCode?: string }>;
  protectedMedia?: {
    total: number;
    readyDerivatives: number;
    blockedConsent: number;
    withdrawnDerivatives: number;
    staleGrants: number;
  };
};
export function PrivateOperationsConsole() {
  const [state, setState] = useState<State>({});
  const [message, setMessage] = useState("Loading operational status.");
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const response = await fetch("/api/studio/private-content/operations", { cache: "no-store" });
      if (!response.ok) {
        setMessage("Operational status is unavailable or requires Administrator access.");
        return;
      }
      setState((await response.json()) as State);
      setMessage("Operational status is current.");
    } catch {
      setMessage("Operational status is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const initialFetch = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(initialFetch);
  }, []);
  return (
    <main className="studio-home" aria-labelledby="private-operations-title">
      <header className="studio-home-header">
        <div>
          <p className="eyebrow">Private Chronicle</p>
          <h1 id="private-operations-title">Operational readiness</h1>
          <p>Provider state, backups, restore drills, and repair plans use sanitized identifiers only.</p>
        </div>
      </header>
      <p role="status" aria-live="polite" aria-atomic="true">
        {message}
      </p>
      <button
        type="button"
        onClick={() => {
          setLoading(true);
          void refresh();
        }}
        aria-busy={loading}
        disabled={loading}
      >
        {loading ? "Refreshing provider readiness" : "Refresh provider readiness"}
      </button>
      <section className="studio-editor-section">
        <h2>Protected media</h2>
        <p>Metadata only; protected originals and derivatives are never previewed here.</p>
        <ul>
          <li>Registered media: {state.protectedMedia?.total ?? 0}</li>
          <li>Ready derivatives: {state.protectedMedia?.readyDerivatives ?? 0}</li>
          <li>Blocked by consent: {state.protectedMedia?.blockedConsent ?? 0}</li>
          <li>Withdrawn derivatives: {state.protectedMedia?.withdrawnDerivatives ?? 0}</li>
          <li>Stale or expired grants: {state.protectedMedia?.staleGrants ?? 0}</li>
        </ul>
      </section>
      <section className="studio-editor-section">
        <h2>Provider readiness</h2>
        <ul>
          {state.providers?.map((provider) => (
            <li key={provider.kind}>
              <strong>{provider.kind}</strong>: {provider.configurationState} ({provider.safeCode})
            </li>
          )) ?? <li>No provider status is available.</li>}
        </ul>
      </section>
      <section className="studio-editor-section">
        <h2>Backups and restore drills</h2>
        <ul>
          {state.backupRuns?.map((backup) => (
            <li key={backup.backupId}>
              Backup {backup.backupId}: {backup.state}
            </li>
          )) ?? <li>No backup runs have been recorded.</li>}
          {state.drills?.map((drill) => (
            <li key={`${drill.targetIdentity}:${drill.state}`}>
              Restore drill {drill.targetIdentity}: {drill.state}
            </li>
          ))}
        </ul>
      </section>
      <section className="studio-editor-section">
        <h2>Repair plans</h2>
        <ul>
          {state.repairs?.map((repair) => (
            <li key={repair.digest}>
              Plan {repair.digest.slice(0, 12)}: {repair.state}; {repair._count.actions} actions;{" "}
              {repair.dryRun ? "dry run" : "approved execution"}
            </li>
          )) ?? <li>No repair plans have been recorded.</li>}
        </ul>
      </section>
    </main>
  );
}
