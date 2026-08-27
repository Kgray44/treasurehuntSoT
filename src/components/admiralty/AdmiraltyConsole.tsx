"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { admiraltyOverview } from "@/admiralty/projections";
import type { SupportAccessScope } from "@/admiralty/schemas";

type Overview = Awaited<ReturnType<typeof admiraltyOverview>>;
const scopeLabels: Record<SupportAccessScope, string> = {
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
const scopes = Object.keys(scopeLabels) as SupportAccessScope[];

function date(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not available in this phase";
}

function ProjectionValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>Not available</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ol>
        {value.map((item, index) => (
          <li key={index}>
            <ProjectionValue value={item} />
          </li>
        ))}
      </ol>
    ) : (
      <span>None</span>
    );
  if (typeof value === "object")
    return (
      <dl>
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{key.replaceAll(/([a-z])([A-Z])/gu, "$1 $2").replaceAll("_", " ")}</dt>
            <dd>
              <ProjectionValue value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{String(value)}</span>;
}

export function AdmiraltyConsole({ initialOverview }: { initialOverview: Overview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [password, setPassword] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<SupportAccessScope[]>(["ACCOUNT_STATE"]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [supportResult, setSupportResult] = useState<unknown>(null);

  async function request(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": overview.operator.csrfToken },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(result?.error ?? "The request could not be completed.");
    return result;
  }

  async function refresh() {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!response.ok) throw new Error("The Admiralty overview could not be refreshed.");
    setOverview((await response.json()) as Overview);
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The request could not be completed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="admiralty" aria-labelledby="admiralty-title">
      <header className="admiralty__masthead">
        <div>
          <p className="admiralty__eyebrow">Voyagewright · Admiralty</p>
          <h1 id="admiralty-title">Raise the Colors</h1>
          <p>Governed authority, scoped support, and evidence—without a second identity system.</p>
        </div>
        <div className="admiralty__exit">
          <Link href="/">Return to Voyagewright</Link>
          <SignOutButton />
        </div>
      </header>

      {notice ? (
        <p className="admiralty__notice" role="alert">
          {notice}
        </p>
      ) : null}

      <section className="admiralty__grid" aria-label="Admiralty overview">
        <article className="admiralty-card admiralty-card--identity">
          <p className="admiralty-card__kicker">Current operator</p>
          <h2>{overview.operator.displayName}</h2>
          <p className="admiralty__mono">{overview.operator.accountId}</p>
          <dl>
            <div>
              <dt>Roles</dt>
              <dd>{overview.operator.roles.join(", ")}</dd>
            </div>
            <div>
              <dt>Session ends</dt>
              <dd>{date(overview.operator.sessionExpiresAt)}</dd>
            </div>
          </dl>
          <details>
            <summary>{overview.operator.capabilities.length} named capabilities</summary>
            <ul className="admiralty__capabilities">
              {overview.operator.capabilities.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
          </details>
        </article>

        <article className="admiralty-card">
          <p className="admiralty-card__kicker">Privileged assurance</p>
          <h2>
            {overview.assurance.level === "ADMIN_REAUTHENTICATED" ? "Recently verified" : "Base administrative access"}
          </h2>
          <p>
            {overview.assurance.recent
              ? `Valid until ${date(overview.assurance.expiresAt)}.`
              : "Higher-risk actions require a fresh password check."}
          </p>
          <form
            className="admiralty-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run("reauth", async () => {
                await request("/api/admin/assurance", { password });
                setPassword("");
                await refresh();
                setNotice("Privileged assurance is active for this session.");
              });
            }}
          >
            <label htmlFor="admiralty-password">Confirm current password</label>
            <input
              id="admiralty-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="submit" disabled={busy === "reauth"}>
              {busy === "reauth" ? "Verifying…" : "Verify for privileged work"}
            </button>
          </form>
        </article>

        <article className="admiralty-card">
          <p className="admiralty-card__kicker">Environment identity</p>
          <h2>
            {overview.environment.application} {overview.environment.version}
          </h2>
          <dl>
            <div>
              <dt>Environment</dt>
              <dd>{overview.environment.environment}</dd>
            </div>
            <div>
              <dt>Build identity</dt>
              <dd>{overview.environment.buildIdentity ?? "Not available in this phase"}</dd>
            </div>
          </dl>
          <p className="admiralty__truth">
            Database, worker, release, backup, and provider command systems are registered but not active in Phase 1.
          </p>
        </article>

        <article className="admiralty-card">
          <p className="admiralty-card__kicker">Living registry</p>
          <h2>{overview.registry.total} governed floor entries</h2>
          <p>
            {overview.registry.implemented} implemented now · {overview.registry.dormant} deliberately dormant
          </p>
          <dl>
            {Object.entries(overview.registry.byCategory).map(([category, count]) => (
              <div key={category}>
                <dt>{category.replaceAll("_", " ")}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </article>
      </section>

      <section className="admiralty-panel" aria-labelledby="support-console-title">
        <div className="admiralty-panel__heading">
          <div>
            <p className="admiralty-card__kicker">User-approved Support Access</p>
            <h2 id="support-console-title">Request only what the person can review</h2>
          </div>
          <p>
            {overview.support.activeGrantCount} active · {overview.support.pendingRequestCount} awaiting a decision
          </p>
        </div>
        <form
          className="admiralty-support-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("support-request", async () => {
              await request("/api/admin/support/requests", {
                targetAccountId,
                purpose,
                requestedScopes: selectedScopes,
              });
              setPurpose("");
              await refresh();
              setNotice("The scoped request is ready for the account owner to review.");
            });
          }}
        >
          <label>
            Target canonical account ID
            <input value={targetAccountId} onChange={(event) => setTargetAccountId(event.target.value)} required />
          </label>
          <label>
            Plain-language purpose
            <textarea
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              minLength={8}
              maxLength={240}
              required
            />
          </label>
          <fieldset>
            <legend>Exact requested categories</legend>
            {scopes.map((scope) => (
              <label key={scope} className="admiralty-check">
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope)}
                  onChange={(event) =>
                    setSelectedScopes((current) =>
                      event.target.checked ? [...current, scope] : current.filter((item) => item !== scope),
                    )
                  }
                />
                <span>{scopeLabels[scope]}</span>
              </label>
            ))}
          </fieldset>
          <p className="admiralty__exclusions">
            Always excluded: passwords, session and OAuth tokens, provider or encryption keys, private Chronicle prose,
            and private media.
          </p>
          <button type="submit" disabled={busy === "support-request" || !selectedScopes.length}>
            {busy === "support-request" ? "Creating request…" : "Create scoped request"}
          </button>
        </form>

        <div className="admiralty-request-list">
          {overview.support.recent.length ? (
            overview.support.recent.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.status}</strong>
                  <span className="admiralty__mono">{item.targetAccountId}</span>
                </div>
                <p>{item.purpose}</p>
                <p>{item.scopes.map((scope) => scopeLabels[scope]).join(" · ")}</p>
                <small>Ends or decision expires {date(item.expiresAt)}</small>
                {item.status === "REQUESTED" ? (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() =>
                      void run(item.id, async () => {
                        await request(`/api/admin/support/requests/${item.id}/cancel`, { reason: "No longer needed" });
                        await refresh();
                      })
                    }
                  >
                    Cancel request
                  </button>
                ) : null}
                {item.status === "ACTIVE" && item.grantId ? (
                  <div className="admiralty-scope-actions">
                    {item.scopes.map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        disabled={busy === `${item.id}:${scope}`}
                        onClick={() =>
                          void run(`${item.id}:${scope}`, async () =>
                            setSupportResult(
                              await request("/api/admin/support/read", {
                                grantId: item.grantId,
                                targetAccountId: item.targetAccountId,
                                scope,
                              }),
                            ),
                          )
                        }
                      >
                        {scopeLabels[scope]}
                      </button>
                    ))}
                    {overview.operator.capabilities.includes("SECURITY_OPERATE") ? (
                      <button
                        type="button"
                        className="admiralty-button--danger"
                        disabled={busy === `revoke:${item.id}`}
                        onClick={() =>
                          void run(`revoke:${item.id}`, async () => {
                            await request(`/api/admin/support/grants/${item.grantId}/revoke`, {
                              reason: "Security operator ended support access",
                            });
                            await refresh();
                          })
                        }
                      >
                        Revoke grant
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p>No Support Access requests have been created by this operator.</p>
          )}
        </div>
        {supportResult ? (
          <details className="admiralty-result" open>
            <summary>Authorized support projection</summary>
            <div className="admiralty-projection">
              <ProjectionValue value={supportResult} />
            </div>
          </details>
        ) : null}
      </section>

      <section className="admiralty-panel" aria-labelledby="audit-title">
        <div className="admiralty-panel__heading">
          <div>
            <p className="admiralty-card__kicker">Canonical evidence</p>
            <h2 id="audit-title">Recent administrative audit</h2>
          </div>
          <p>{overview.audit.recentCount24Hours} events in 24 hours</p>
        </div>
        <ol className="admiralty-audit">
          {overview.audit.recent.map((event) => (
            <li key={`${event.correlationId}:${event.action}`}>
              <div>
                <strong>{event.action.replaceAll("ADMIRALTY_", "").replaceAll("_", " ")}</strong>
                <span>{event.outcome}</span>
              </div>
              <p>
                {event.resourceType} · {event.resourceId}
              </p>
              <small>
                {date(event.createdAt)} · {event.correlationId}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
