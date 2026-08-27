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
  consent: {
    requestId: string | null;
    status: string;
    expiresAt: Date | string | null;
    grantId: string | null;
    grantStatus: string;
    grantExpiresAt: Date | string | null;
  };
  latestExecution: null | {
    id: string;
    status: string;
    startedAt: Date | string;
    completedAt: Date | string | null;
    deniedAccessCount: number;
    redactionCount: number;
    receiptDigest: string | null;
    diagnosis: null | { primaryCause: string; confidence: string; uncertainty: string; unresolvedQuestions: string };
    findings: ReadonlyArray<{ code: string; summary: string; confidence: string; uncertainty: string }>;
    repairProposals: ReadonlyArray<{
      proposalType: string;
      summary: string;
      requiredUserConsent: boolean;
      requiresAdministrator: boolean;
      state: string;
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
  const [grantIds, setGrantIds] = useState<Record<string, string>>({});
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
        <h2 id="open-support-case-title">Open a read-only support case</h2>
        <p>
          S1 creates an exact case and a separate owner-visible consent request. It never changes account, Voyage,
          Community, job, session, configuration, or platform state.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run("create", async () => {
              await post("/api/admin/support/cases", { targetAccountId, title, summary, requestedScopes: scopes });
              setTargetAccountId("");
              setTitle("");
              setSummary("");
              setNotice("Support case opened. The account owner must approve the exact diagnostic scopes.");
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
                setNotice("Recent privileged assurance is active for read-only diagnosis.");
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
              {busy === "assurance" ? "Verifying…" : "Verify for read-only diagnosis"}
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
                        <p key={proposal.proposalType}>
                          Proposed next action ({proposal.state}): {proposal.summary}
                        </p>
                      ))}
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
