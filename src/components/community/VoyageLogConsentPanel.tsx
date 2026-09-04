"use client";

import { useEffect, useState } from "react";
import { voyageLogConsentScopes } from "@/community/voyage-log-consent-contract";

type Consent = { scope: string; state: string; expiresAt?: string | null };
type InboxItem = { voyageLogId: string; scope: string; state: string; expiresAt?: string | null };
type OwnerDashboard = {
  voyageLogId: string;
  lifecycleState: string;
  participants: Array<{ id: string; displayName: string; protected: boolean; consents: Consent[] }>;
};

function csrfHeaders(csrf: string) {
  return { "content-type": "application/json", "x-csrf-token": csrf };
}

export function VoyageLogConsentPanel({ voyageLogId }: { voyageLogId?: string }) {
  const [csrf, setCsrf] = useState("");
  const [owner, setOwner] = useState<OwnerDashboard | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [message, setMessage] = useState("");
  async function refresh() {
    const session = await fetch("/api/player/session", { cache: "no-store" }).then((response) =>
      response.ok ? (response.json() as Promise<{ csrfToken?: string }>) : null,
    );
    if (!session?.csrfToken) {
      setMessage("Sign in to manage publication consent.");
      return;
    }
    setCsrf(session.csrfToken);
    const [ownerResponse, inboxResponse] = await Promise.all([
      voyageLogId
        ? fetch(`/api/community/voyage-logs/consent?voyageLogId=${encodeURIComponent(voyageLogId)}`, {
            cache: "no-store",
          })
        : Promise.resolve(null),
      fetch("/api/community/voyage-logs/consent/inbox", { cache: "no-store" }),
    ]);
    if (ownerResponse?.ok) setOwner((await ownerResponse.json()) as OwnerDashboard);
    if (inboxResponse.ok) setInbox((await inboxResponse.json()) as InboxItem[]);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [voyageLogId]);
  async function respond(item: InboxItem, decision: "APPROVED" | "DECLINED") {
    const response = await fetch("/api/community/voyage-logs/consent/respond", {
      method: "POST",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ voyageLogId: item.voyageLogId, scope: item.scope, decision }),
    });
    setMessage(response.ok ? `Consent ${decision.toLowerCase()}.` : "Consent response could not be saved.");
    if (response.ok) await refresh();
  }
  async function revoke(item: InboxItem) {
    const response = await fetch("/api/community/voyage-logs/consent/revoke", {
      method: "POST",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ voyageLogId: item.voyageLogId, scope: item.scope }),
    });
    setMessage(
      response.ok ? "Consent revoked; publication now requires correction." : "Consent revocation could not be saved.",
    );
    if (response.ok) await refresh();
  }
  async function requestAll(participantId: string) {
    if (!voyageLogId) return;
    const response = await fetch("/api/community/voyage-logs/consent", {
      method: "POST",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ voyageLogId, participantId, scopes: voyageLogConsentScopes }),
    });
    setMessage(response.ok ? "Publication-consent request sent." : "Consent request could not be sent.");
    if (response.ok) await refresh();
  }
  return (
    <section
      className="community-workflow__panel community-workflow__consent"
      aria-labelledby="voyage-log-consent-title"
    >
      <h2 id="voyage-log-consent-title">Publication consent</h2>
      <p aria-live="polite">{message}</p>
      {owner ? (
        <section className="community-workflow__consent-dashboard" aria-label="Owner consent dashboard">
          <p>Lifecycle: {owner.lifecycleState}</p>
          {owner.participants.map((participant) => (
            <article key={participant.id}>
              <h3>{participant.displayName}</h3>
              {participant.protected ? (
                <p>Protected participants cannot be requested through this public-consent panel.</p>
              ) : (
                <>
                  <ul>
                    {voyageLogConsentScopes.map((scope) => {
                      const consent = participant.consents.find((item) => item.scope === scope);
                      return (
                        <li key={scope}>
                          {scope}: {consent?.state ?? "NOT_REQUIRED"}
                          {consent?.expiresAt ? ` (expires ${new Date(consent.expiresAt).toLocaleDateString()})` : ""}
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" onClick={() => void requestAll(participant.id)}>
                    Request publication consent
                  </button>
                </>
              )}
            </article>
          ))}
        </section>
      ) : null}
      <section className="community-workflow__consent-inbox" aria-label="Your publication consent requests">
        <h3>Your requests</h3>
        {inbox.length ? (
          <ul>
            {inbox.map((item) => (
              <li key={`${item.voyageLogId}:${item.scope}`}>
                <span>
                  {item.scope}: {item.state}
                </span>
                {item.state === "PENDING" ? (
                  <>
                    <button type="button" onClick={() => void respond(item, "APPROVED")}>
                      Approve
                    </button>
                    <button type="button" onClick={() => void respond(item, "DECLINED")}>
                      Decline
                    </button>
                  </>
                ) : null}
                {item.state === "APPROVED" ? (
                  <button type="button" onClick={() => void revoke(item)}>
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No publication-consent requests are waiting.</p>
        )}
      </section>
    </section>
  );
}
