"use client";

import { useEffect, useState, type ReactNode } from "react";

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

type OperationStatus = "loading" | "ready" | "error" | "unavailable" | "unauthorized";

const statusMessage: Record<OperationStatus, string> = {
  loading: "Loading operational status.",
  ready: "Operational status is current.",
  error: "Operational status could not be refreshed. Try again.",
  unavailable: "Operational status is temporarily unavailable.",
  unauthorized: "Operational status is unavailable or requires Administrator access.",
};

function OperationalSection({
  title,
  detail,
  status,
  emptyMessage,
  children,
}: {
  title: string;
  detail?: string;
  status: OperationStatus;
  emptyMessage?: string;
  children?: ReactNode;
}) {
  const state = status === "ready" && emptyMessage ? "empty" : status;
  const fallback =
    status === "loading"
      ? `Loading ${title.toLocaleLowerCase()}.`
      : status === "unauthorized"
        ? "Administrator access is required to view this operational section."
        : status === "unavailable"
          ? "This operational section is temporarily unavailable."
          : "This operational section could not be loaded. Refresh to try again.";
  return (
    <section className="studio-editor-section" data-async-state={`private-operations-${state}`}>
      <h2>{title}</h2>
      {detail ? <p>{detail}</p> : null}
      {status === "ready" ? (
        emptyMessage ? (
          <p>{emptyMessage}</p>
        ) : (
          children
        )
      ) : (
        <p aria-busy={status === "loading" || undefined}>{fallback}</p>
      )}
    </section>
  );
}

export function PrivateOperationsConsole() {
  const [status, setStatus] = useState<OperationStatus>("loading");
  const [state, setState] = useState<State | null>(null);
  const refresh = async () => {
    setStatus("loading");
    setState(null);
    try {
      const response = await fetch("/api/studio/private-content/operations", { cache: "no-store" });
      if (!response.ok) {
        setStatus(
          response.status === 401 || response.status === 403
            ? "unauthorized"
            : response.status === 503
              ? "unavailable"
              : "error",
        );
        return;
      }
      const nextState = (await response.json()) as unknown;
      if (!nextState || typeof nextState !== "object") {
        setStatus("error");
        return;
      }
      setState(nextState as State);
      setStatus("ready");
    } catch {
      setStatus("unavailable");
    }
  };
  useEffect(() => {
    const initialFetch = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(initialFetch);
  }, []);

  const protectedMedia = status === "ready" ? state?.protectedMedia : undefined;
  const providers = status === "ready" && Array.isArray(state?.providers) ? state.providers : undefined;
  const backupRuns = status === "ready" && Array.isArray(state?.backupRuns) ? state.backupRuns : undefined;
  const drills = status === "ready" && Array.isArray(state?.drills) ? state.drills : undefined;
  const repairs = status === "ready" && Array.isArray(state?.repairs) ? state.repairs : undefined;
  const sectionStatus = (available: boolean): OperationStatus =>
    status === "ready" && !available ? "unavailable" : status;

  return (
    <main className="studio-home" aria-labelledby="private-operations-title">
      <header className="studio-home-header">
        <div>
          <p className="eyebrow">Private Chronicle</p>
          <h1 id="private-operations-title">Operational readiness</h1>
          <p>Provider state, backups, restore drills, and repair plans use sanitized identifiers only.</p>
        </div>
      </header>
      <p
        role={status === "error" || status === "unavailable" || status === "unauthorized" ? "alert" : "status"}
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage[status]}
      </p>
      <button
        type="button"
        onClick={() => void refresh()}
        aria-busy={status === "loading"}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Refreshing provider readiness" : "Refresh provider readiness"}
      </button>
      <OperationalSection
        title="Protected media"
        detail="Metadata only; protected originals and derivatives are never previewed here."
        status={sectionStatus(Boolean(protectedMedia))}
      >
        <ul>
          <li>Registered media: {protectedMedia?.total}</li>
          <li>Ready derivatives: {protectedMedia?.readyDerivatives}</li>
          <li>Blocked by consent: {protectedMedia?.blockedConsent}</li>
          <li>Withdrawn derivatives: {protectedMedia?.withdrawnDerivatives}</li>
          <li>Stale or expired grants: {protectedMedia?.staleGrants}</li>
        </ul>
      </OperationalSection>
      <OperationalSection
        title="Provider readiness"
        status={sectionStatus(Boolean(providers))}
        emptyMessage={providers?.length === 0 ? "No provider status records were returned." : undefined}
      >
        <ul>
          {providers?.map((provider) => (
            <li key={provider.kind}>
              <strong>{provider.kind}</strong>: {provider.configurationState} ({provider.safeCode})
            </li>
          ))}
        </ul>
      </OperationalSection>
      <OperationalSection
        title="Backups and restore drills"
        status={sectionStatus(Boolean(backupRuns) && Boolean(drills))}
        emptyMessage={
          backupRuns?.length === 0 && drills?.length === 0
            ? "No backup runs or restore drills have been recorded."
            : undefined
        }
      >
        <ul>
          {backupRuns?.map((backup) => (
            <li key={backup.backupId}>
              Backup {backup.backupId}: {backup.state}
            </li>
          ))}
          {drills?.map((drill) => (
            <li key={`${drill.targetIdentity}:${drill.state}`}>
              Restore drill {drill.targetIdentity}: {drill.state}
            </li>
          ))}
        </ul>
      </OperationalSection>
      <OperationalSection
        title="Repair plans"
        status={sectionStatus(Boolean(repairs))}
        emptyMessage={repairs?.length === 0 ? "No repair plans have been recorded." : undefined}
      >
        <ul>
          {repairs?.map((repair) => (
            <li key={repair.digest}>
              Plan {repair.digest.slice(0, 12)}: {repair.state}; {repair._count.actions} actions;{" "}
              {repair.dryRun ? "dry run" : "approved execution"}
            </li>
          ))}
        </ul>
      </OperationalSection>
    </main>
  );
}
