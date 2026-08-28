"use client";

import { useEffect, useState } from "react";
import type { SupportAccessScope } from "@/admiralty/schemas";

type SupportRequest = {
  id: string;
  operator: string;
  operatorRoles: string[];
  purpose: string;
  requestedScopes: SupportAccessScope[];
  requestedRepairIds: string[];
  requestedAt: string;
  decisionDeadline: string;
  status: string;
  grant: null | {
    id: string;
    scopes: SupportAccessScope[];
    repairIds: string[];
    maximumRiskClass: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
  };
};
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

export function SupportAccessPanel() {
  const [csrfToken, setCsrfToken] = useState("");
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [status, setStatus] = useState("Loading Support Access…");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/account/support/requests", { cache: "no-store" });
    const result = (await response.json().catch(() => null)) as {
      csrfToken?: string;
      requests?: SupportRequest[];
      error?: string;
    } | null;
    if (!response.ok || !result?.csrfToken || !result.requests)
      throw new Error(result?.error ?? "Support Access is unavailable.");
    setCsrfToken(result.csrfToken);
    setRequests(result.requests);
    setStatus(result.requests.length ? "" : "No one has requested support access to your account.");
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/account/support/requests", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as {
          csrfToken?: string;
          requests?: SupportRequest[];
          error?: string;
        } | null;
        if (!response.ok || !result?.csrfToken || !result.requests)
          throw new Error(result?.error ?? "Support Access is unavailable.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setCsrfToken(result.csrfToken ?? "");
        setRequests(result.requests ?? []);
        setStatus(result.requests?.length ? "" : "No one has requested support access to your account.");
      })
      .catch((cause) => {
        if (active) setStatus(cause instanceof Error ? cause.message : "Support Access is unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function mutate(path: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setStatus("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "The decision could not be saved.");
      await load();
      setStatus("Your Support Access decision is in effect.");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "The decision could not be saved.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="support-access" aria-labelledby="support-access-heading">
      <div className="harbor-panel support-access__explanation">
        <h2 id="support-access-heading">You stay in control</h2>
        <p>
          A request names the person asking, their purpose, every diagnostic category, and any registered repair they
          may later propose. Approval lasts no more than 30 minutes and applies only to that operator and your account.
        </p>
        <p>
          <strong>Never included:</strong> passwords or hashes, session or OAuth tokens, provider and encryption keys,
          private Chronicle prose, reflections, Memories, answers, or private media.
        </p>
      </div>
      {status ? (
        <p className="harbor-panel" role="status">
          {status}
        </p>
      ) : null}
      <div className="support-access__list">
        {requests.map((request) => (
          <article className="harbor-panel support-access__request" key={request.id}>
            <div className="support-access__heading">
              <div>
                <small>{request.operatorRoles.join(" · ") || "Support operator"}</small>
                <h2>{request.operator}</h2>
              </div>
              <strong>{request.status}</strong>
            </div>
            <p>{request.purpose}</p>
            <h3>Requested diagnostic categories</h3>
            <ul>
              {request.requestedScopes.map((scope) => (
                <li key={scope}>{labels[scope]}</li>
              ))}
            </ul>
            <h3>Requested repair authority</h3>
            {request.requestedRepairIds.length ? (
              <ul>
                {request.requestedRepairIds.map((repairId) => (
                  <li key={repairId}>{repairId}</li>
                ))}
              </ul>
            ) : (
              <p>This is a read-only diagnostic request.</p>
            )}
            <p>
              <small>
                Decision available until {new Date(request.decisionDeadline).toLocaleString()}. If approved, access ends
                automatically 30 minutes after approval.
              </small>
            </p>
            {request.status === "REQUESTED" ? (
              <div className="support-access__actions">
                <button
                  type="button"
                  disabled={busy === request.id}
                  onClick={() =>
                    void mutate(
                      `/api/account/support/requests/${request.id}/decision`,
                      { decision: "APPROVE" },
                      request.id,
                    )
                  }
                >
                  Approve exact categories
                </button>
                <button
                  type="button"
                  className="support-access__deny"
                  disabled={busy === request.id}
                  onClick={() =>
                    void mutate(
                      `/api/account/support/requests/${request.id}/decision`,
                      { decision: "DENY" },
                      request.id,
                    )
                  }
                >
                  Deny
                </button>
              </div>
            ) : null}
            {request.status === "ACTIVE" && request.grant ? (
              <div className="support-access__active">
                <p>
                  Active until {new Date(request.grant.expiresAt).toLocaleString()} for:{" "}
                  {request.grant.scopes.map((scope) => labels[scope]).join(", ")}.
                  {request.grant.repairIds.length
                    ? ` Registered repair authority: ${request.grant.repairIds.join(", ")} (maximum risk ${request.grant.maximumRiskClass}).`
                    : " No repair authority was approved."}
                </p>
                <button
                  type="button"
                  className="support-access__deny"
                  disabled={busy === request.grant.id}
                  onClick={() =>
                    void mutate(
                      `/api/account/support/grants/${request.grant?.id}/revoke`,
                      { reason: "Account owner ended support access" },
                      request.grant?.id ?? request.id,
                    )
                  }
                >
                  Revoke now
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
