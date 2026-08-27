"use client";

import { useState } from "react";
import type { SupportAccessScope } from "@/admiralty/schemas";

type SupportCases = ReadonlyArray<{
  id: string;
  caseNumber: string;
  targetAccountId: string;
  title: string;
  safeSummary: string;
  status: string;
  openedAt: Date | string;
  correlationId: string;
  requestedScopes: SupportAccessScope[];
  requestedRepairIds: string[];
  consent: {
    requestId: string | null;
    status: string;
    expiresAt: Date | string | null;
    grantId: string | null;
    grantStatus: string;
    grantExpiresAt: Date | string | null;
    grantedRepairIds: string[];
    maximumRiskClass: string;
  };
  latestExecution: null | {
    id: string;
    status: string;
    startedAt: Date | string;
    completedAt: Date | string | null;
    deniedAccessCount: number;
    redactionCount: number;
    receiptDigest: string | null;
    supportExecutionGrant: null | {
      maximumRiskClass: string;
      remainingCommands: number;
      remainingAffectedRecords: number;
      maximumDomains: number;
      usedDomains: string;
      expiresAt: Date | string;
    };
    diagnosis: null | { primaryCause: string; confidence: string; uncertainty: string; unresolvedQuestions: string };
    findings: ReadonlyArray<{ code: string; summary: string; confidence: string; uncertainty: string }>;
    repairProposals: ReadonlyArray<{
      id: string;
      proposalType: string;
      repairId: string | null;
      targetType: string | null;
      targetId: string | null;
      targetRevision: string | null;
      proposalRevision: number | null;
      preview: string | null;
      summary: string;
      requiredUserConsent: boolean;
      requiresAdministrator: boolean;
      state: string;
      requiresHumanApproval: boolean;
    }>;
    evidenceReferences: ReadonlyArray<{
      sourceDomain: string;
      sourceReference: string;
      dataClassification: string;
      digest: string;
      redacted: boolean;
    }>;
  };
}>;

const labels: Record<SupportAccessScope, string> = {
  ACCOUNT_STATE: "Account state",
  AUTH_EVENTS: "Authentication events",
  CHRONICLE_HISTORY_METADATA: "Chronicle history metadata",
  TIDEGLASS_DIAGNOSTICS: "Tideglass comparison diagnostics",
  COMMUNITY_ACTIVITY: "Community activity",
  SESSION_DIAGNOSTICS: "Session diagnostics",
  PROFILE_DIAGNOSTICS: "Profile diagnostics",
  VOYAGE_MEMBERSHIP: "Voyage membership",
  RUNTIME_STATUS: "Safe runtime status",
  AUDIT_CORRELATION: "Audit correlation history",
};

const initialScopes: SupportAccessScope[] = ["ACCOUNT_STATE", "SESSION_DIAGNOSTICS"];
const repairOptions = [
  { id: "wayfarer.profile.reconcile", label: "Reconcile profile preferences", scope: "PROFILE_DIAGNOSTICS" as const },
  { id: "wayfarer.session.revoke-stale", label: "Revoke one stale session", scope: "SESSION_DIAGNOSTICS" as const },
  {
    id: "one-voyage.membership.reconcile",
    label: "Reconcile one inconsistent membership",
    scope: "VOYAGE_MEMBERSHIP" as const,
  },
];

function date(value: Date | string | null) {
  return value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
}

export function SupportCaseConsole({
  initialCases,
  csrfToken,
  canDiagnose,
}: {
  initialCases: SupportCases;
  csrfToken: string;
  canDiagnose: boolean;
}) {
  const [targetAccountId, setTargetAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [scopes, setScopes] = useState<SupportAccessScope[]>(initialScopes);
  const [repairIds, setRepairIds] = useState<string[]>([]);
  const [grantIds, setGrantIds] = useState<Record<string, string>>({});
  const [repairTargetIds, setRepairTargetIds] = useState<Record<string, string>>({});
  const [repairSelections, setRepairSelections] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "The support action could not be completed.");
    return payload;
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The support action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="chartroom-support">
      {notice ? (
        <p className="chartroom-notice" role="status">
          {notice}
        </p>
      ) : null}
      <section aria-labelledby="open-support-case-title">
        <h2 id="open-support-case-title">Open a governed support case</h2>
        <p>
          Diagnosis remains read-only. A repair can only be proposed later when this exact owner-visible request also
          names one of the registered commands below; consent never creates open-ended Administrator authority.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run("create", async () => {
              await post("/api/admin/support/cases", {
                targetAccountId,
                title,
                summary,
                requestedScopes: scopes,
                requestedRepairIds: repairIds,
              });
              setTargetAccountId("");
              setTitle("");
              setSummary("");
              setNotice(
                "Support case opened. The account owner must approve the exact scopes and any named repair authority.",
              );
              window.location.reload();
            });
          }}
        >
          <label>
            Target canonical account ID
            <input required value={targetAccountId} onChange={(event) => setTargetAccountId(event.target.value)} />
          </label>
          <label>
            Case title
            <input
              required
              minLength={8}
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Safe case summary visible to the account owner
            <textarea
              required
              minLength={8}
              maxLength={480}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>Exact diagnostic scopes</legend>
            {Object.entries(labels).map(([scope, label]) => (
              <label key={scope}>
                <input
                  type="checkbox"
                  checked={scopes.includes(scope as SupportAccessScope)}
                  onChange={(event) =>
                    setScopes((current) =>
                      event.target.checked
                        ? [...new Set([...current, scope as SupportAccessScope])]
                        : current.filter((candidate) => candidate !== scope),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Optional registered repair authority</legend>
            <p>Each choice is bounded, previewed before execution, and expires with the Support Access grant.</p>
            {repairOptions.map((repair) => (
              <label key={repair.id}>
                <input
                  type="checkbox"
                  checked={repairIds.includes(repair.id)}
                  onChange={(event) => {
                    setRepairIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, repair.id])]
                        : current.filter((candidate) => candidate !== repair.id),
                    );
                    if (event.target.checked) setScopes((current) => [...new Set([...current, repair.scope])]);
                  }}
                />
                {repair.label}
              </label>
            ))}
          </fieldset>
          <p>
            Never grantable: credentials, secrets, password material, private Chronicle content, private media, raw
            logs, or arbitrary system access.
          </p>
          <button type="submit" disabled={busy === "create" || !scopes.length}>
            {busy === "create" ? "Opening case…" : "Open support case and request consent"}
          </button>
        </form>
      </section>

      {canDiagnose ? (
        <section aria-labelledby="support-case-assurance-title">
          <h2 id="support-case-assurance-title">Confirm privileged work</h2>
          <p>Diagnosis requires recent privileged assurance and remains bound to this signed-in operator session.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run("assurance", async () => {
                await post("/api/admin/assurance", { password });
                setPassword("");
                setNotice("Recent privileged assurance is active for governed repair work.");
              });
            }}
          >
            <label>
              Confirm current password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busy === "assurance" || !password}>
              {busy === "assurance" ? "Verifying…" : "Verify for governed repair work"}
            </button>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="support-case-list-title">
        <h2 id="support-case-list-title">Your support cases</h2>
        {initialCases.length ? (
          <div className="chartroom-list">
            {initialCases.map((supportCase) => {
              const execution = supportCase.latestExecution;
              const grantId = grantIds[supportCase.id] ?? supportCase.consent.grantId ?? "";
              const selectedRepairId =
                repairSelections[supportCase.id] ?? supportCase.consent.grantedRepairIds[0] ?? "";
              return (
                <article key={supportCase.id}>
                  <div>
                    <strong>
                      {supportCase.caseNumber} · {supportCase.title}
                    </strong>
                    <span>{supportCase.status}</span>
                  </div>
                  <p>{supportCase.safeSummary}</p>
                  <dl className="chartroom-details">
                    <div>
                      <dt>Target</dt>
                      <dd>{supportCase.targetAccountId}</dd>
                    </div>
                    <div>
                      <dt>Consent</dt>
                      <dd>{supportCase.consent.grantStatus}</dd>
                    </div>
                    <div>
                      <dt>Approved scopes</dt>
                      <dd>{supportCase.requestedScopes.map((scope) => labels[scope]).join(" · ")}</dd>
                    </div>
                    <div>
                      <dt>Approved repairs</dt>
                      <dd>
                        {supportCase.consent.grantedRepairIds.length
                          ? supportCase.consent.grantedRepairIds.join(" · ")
                          : "Read-only diagnosis"}
                      </dd>
                    </div>
                    <div>
                      <dt>Autonomous ceiling</dt>
                      <dd>{supportCase.consent.maximumRiskClass}</dd>
                    </div>
                    <div>
                      <dt>Consent expiry</dt>
                      <dd>{date(supportCase.consent.grantExpiresAt ?? supportCase.consent.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt>Opened</dt>
                      <dd>{date(supportCase.openedAt)}</dd>
                    </div>
                  </dl>
                  {canDiagnose && supportCase.consent.grantStatus === "ACTIVE" ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(`diagnose:${supportCase.id}`, async () => {
                          await post(`/api/admin/support/cases/${supportCase.id}/diagnose`, { grantId });
                          setNotice(`Read-only diagnosis completed for ${supportCase.caseNumber}.`);
                          window.location.reload();
                        });
                      }}
                    >
                      <label>
                        Approved grant ID
                        <input
                          required
                          value={grantId}
                          onChange={(event) =>
                            setGrantIds((current) => ({ ...current, [supportCase.id]: event.target.value }))
                          }
                        />
                      </label>
                      <p>
                        Recent privileged assurance is required. This action reads only the scopes above; it cannot
                        execute a repair.
                      </p>
                      <button type="submit" disabled={busy === `diagnose:${supportCase.id}`}>
                        {busy === `diagnose:${supportCase.id}` ? "Diagnosing…" : "Run read-only diagnosis"}
                      </button>
                    </form>
                  ) : null}
                  {execution ? (
                    <section aria-label={`Diagnostic evidence for ${supportCase.caseNumber}`}>
                      <h3>Latest diagnostic execution · {execution.status}</h3>
                      <p>
                        Started {date(execution.startedAt)} · denied attempts {execution.deniedAccessCount} · redacted
                        evidence {execution.redactionCount}
                      </p>
                      {execution.findings.map((finding) => (
                        <p key={finding.code}>
                          <strong>{finding.code}</strong> · {finding.summary} ({finding.confidence})
                        </p>
                      ))}
                      {execution.diagnosis ? (
                        <p>
                          Diagnosis: {execution.diagnosis.primaryCause} · {execution.diagnosis.uncertainty}
                        </p>
                      ) : null}
                      {execution.repairProposals.map((proposal) => (
                        <section
                          key={proposal.repairId ?? proposal.proposalType}
                          aria-label={`Repair proposal ${proposal.proposalType}`}
                        >
                          <p>
                            Proposed next action ({proposal.state}): {proposal.summary}
                          </p>
                          {proposal.repairId ? (
                            <>
                              <p>
                                Registered command: <code>{proposal.repairId}</code> · target {proposal.targetType} ·{" "}
                                {proposal.targetId}
                                {proposal.requiresHumanApproval
                                  ? " · human approval required"
                                  : " · autonomous when all gates remain current"}
                              </p>
                              {proposal.preview ? (
                                <details>
                                  <summary>Mutation preview</summary>
                                  <pre>{proposal.preview}</pre>
                                </details>
                              ) : null}
                              {canDiagnose && proposal.state === "READY" ? (
                                <button
                                  type="button"
                                  disabled={busy === `execute:${proposal.repairId}:${proposal.targetId}`}
                                  onClick={() =>
                                    void run(`execute:${proposal.repairId}:${proposal.targetId}`, async () => {
                                      await post(`/api/admin/support/cases/${supportCase.id}/repairs/execute`, {
                                        grantId,
                                        proposalId: proposal.id,
                                        idempotencyKey: `support-${crypto.randomUUID().replaceAll("-", "")}`,
                                      });
                                      setNotice(`Repair execution completed for ${supportCase.caseNumber}.`);
                                      window.location.reload();
                                    })
                                  }
                                >
                                  {busy === `execute:${proposal.repairId}:${proposal.targetId}`
                                    ? "Executing…"
                                    : "Execute registered repair"}
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </section>
                      ))}
                      {execution.supportExecutionGrant ? (
                        <p>
                          Repair budget: {execution.supportExecutionGrant.remainingCommands} command(s),{" "}
                          {execution.supportExecutionGrant.remainingAffectedRecords} record(s),{" "}
                          {execution.supportExecutionGrant.maximumDomains} domain(s) remaining.
                        </p>
                      ) : null}
                      {execution.receiptDigest ? (
                        <p>
                          Auditable receipt digest: <code>{execution.receiptDigest}</code>
                        </p>
                      ) : null}
                      {execution.evidenceReferences.length ? (
                        <details>
                          <summary>Sanitized evidence provenance</summary>
                          <ul>
                            {execution.evidenceReferences.map((evidence) => (
                              <li key={`${evidence.sourceReference}:${evidence.digest}`}>
                                {evidence.sourceDomain} · {evidence.dataClassification} ·{" "}
                                {evidence.redacted ? "redacted reference" : "reference"} ·{" "}
                                <code>{evidence.digest}</code>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </section>
                  ) : null}
                  {canDiagnose &&
                  execution?.status === "COMPLETE" &&
                  supportCase.consent.grantedRepairIds.length &&
                  ![
                    "VERIFIED_RESOLVED",
                    "VERIFICATION_INCONCLUSIVE",
                    "CLOSED",
                    "CANCELLED",
                    "CONSENT_REVOKED",
                  ].includes(supportCase.status) ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const targetId = repairTargetIds[supportCase.id] ?? "";
                        void run(`propose:${supportCase.id}`, async () => {
                          await post(`/api/admin/support/cases/${supportCase.id}/repairs/propose`, {
                            grantId,
                            repairId: selectedRepairId,
                            targetId,
                          });
                          setNotice(`Mutation preview created for ${supportCase.caseNumber}.`);
                          window.location.reload();
                        });
                      }}
                    >
                      <h3>Registered repair proposal</h3>
                      <p>
                        Reloads current consent, assurance, target revision, and budget before creating a mutation
                        preview.
                      </p>
                      <label>
                        Registered repair
                        <select
                          value={selectedRepairId}
                          onChange={(event) =>
                            setRepairSelections((current) => ({ ...current, [supportCase.id]: event.target.value }))
                          }
                        >
                          {supportCase.consent.grantedRepairIds.map((repairId) => (
                            <option key={repairId} value={repairId}>
                              {repairId}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Target ID for the selected registered repair ({selectedRepairId})
                        <input
                          required
                          value={repairTargetIds[supportCase.id] ?? ""}
                          onChange={(event) =>
                            setRepairTargetIds((current) => ({ ...current, [supportCase.id]: event.target.value }))
                          }
                        />
                      </label>
                      <button type="submit" disabled={busy === `propose:${supportCase.id}`}>
                        {busy === `propose:${supportCase.id}` ? "Creating preview…" : "Create mutation preview"}
                      </button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p>No support cases have been opened by this operator.</p>
        )}
      </section>
    </div>
  );
}
