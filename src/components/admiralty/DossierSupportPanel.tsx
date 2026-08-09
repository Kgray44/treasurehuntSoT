"use client";

import { useState } from "react";
import type { SupportAccessScope } from "@/admiralty/schemas";

const labels: Record<SupportAccessScope, string> = {
  ACCOUNT_STATE: "Account state",
  AUTH_EVENTS: "Authentication events",
  CHRONICLE_HISTORY_METADATA: "Chronicle history metadata",
  COMMUNITY_ACTIVITY: "Community activity",
  SESSION_DIAGNOSTICS: "Session diagnostics",
  PROFILE_DIAGNOSTICS: "Profile diagnostics",
};
const scopes = Object.keys(labels) as SupportAccessScope[];

export function DossierSupportPanel({
  targetAccountId,
  csrfToken,
  canRequest,
  canUse,
  activeGrantId,
}: {
  targetAccountId: string;
  csrfToken: string;
  canRequest: boolean;
  canUse: boolean;
  activeGrantId?: string | null;
}) {
  const [purpose, setPurpose] = useState("");
  const [selected, setSelected] = useState<SupportAccessScope[]>(["ACCOUNT_STATE"]);
  const [scope, setScope] = useState<SupportAccessScope>("ACCOUNT_STATE");
  const [grantId, setGrantId] = useState(activeGrantId ?? "");
  const [password, setPassword] = useState("");
  const [assuranceActive, setAssuranceActive] = useState(false);
  const [notice, setNotice] = useState("");
  const [projection, setProjection] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      request?: { id: string };
      projection?: unknown;
    } | null;
    if (!response.ok) throw new Error(result?.error ?? "The support action could not be completed.");
    return result;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The support action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chartroom-support">
      {notice ? (
        <p role="status" className="chartroom-notice">
          {notice}
        </p>
      ) : null}
      {canRequest || canUse ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await post("/api/admin/assurance", { password });
              setAssuranceActive(true);
              setPassword("");
              setNotice("Privileged assurance is active for this session.");
            });
          }}
        >
          <h3>Confirm privileged work</h3>
          <p>
            <strong>{assuranceActive ? "Recently verified" : "Verification required"}</strong>. Support requests and
            approved reads remain bound to this signed-in session.
          </p>
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
          <button type="submit" disabled={busy || !password}>
            Verify for privileged work
          </button>
        </form>
      ) : null}
      {canRequest ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await post("/api/admin/support/requests", {
                targetAccountId,
                purpose,
                requestedScopes: selected,
              });
              setNotice(`Consent request ${result?.request?.id ?? "created"}. The target user must approve it.`);
              setPurpose("");
            });
          }}
        >
          <h3>Request consented access</h3>
          <p>The target is already selected. Consent remains exact, scope-bound, time-bound, and revocable.</p>
          <label>
            Purpose
            <textarea
              required
              minLength={8}
              maxLength={240}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Describe the support reason visible to the account owner."
            />
          </label>
          <fieldset>
            <legend>Requested categories</legend>
            {scopes.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...new Set([...current, item])]
                        : current.filter((candidate) => candidate !== item),
                    )
                  }
                />
                {labels[item]}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={busy || !selected.length}>
            Request owner consent
          </button>
        </form>
      ) : (
        <p>Permission required to request Support Access.</p>
      )}
      {canUse ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await post("/api/admin/support/read", { grantId, targetAccountId, scope });
              setProjection(result?.projection ?? null);
              setNotice("Scoped support projection read and audited.");
            });
          }}
        >
          <h3>Use an approved grant</h3>
          <p>Recent privileged assurance is still required by the Phase 1 control plane.</p>
          <label>
            Grant ID
            <input required value={grantId} onChange={(event) => setGrantId(event.target.value)} />
          </label>
          <label>
            Scoped category
            <select value={scope} onChange={(event) => setScope(event.target.value as SupportAccessScope)}>
              {scopes.map((item) => (
                <option key={item} value={item}>
                  {labels[item]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            Read approved category
          </button>
          {projection ? <pre className="chartroom-projection">{JSON.stringify(projection, null, 2)}</pre> : null}
        </form>
      ) : null}
    </div>
  );
}
