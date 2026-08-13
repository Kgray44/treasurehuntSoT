"use client";

import { useState } from "react";

type Preview = Readonly<{
  consequences: readonly string[];
  warnings: readonly string[];
  reauthenticationRequired: boolean;
}>;
type Receipt = Readonly<{ correlationId: string; resultSummary: { status?: string; alreadySuspended?: boolean } }>;

export function AccountLifecycleActionPanel({
  targetAccountId,
  expectedUpdatedAt,
  accountStatus,
  csrfToken,
  enabled,
}: {
  targetAccountId: string;
  expectedUpdatedAt: string;
  accountStatus: string;
  csrfToken: string;
  enabled: boolean;
}) {
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => `account_${crypto.randomUUID().replaceAll("-", "")}`);
  const [password, setPassword] = useState("");
  const [assured, setAssured] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const body = () => ({ targetAccountId, expectedUpdatedAt, reason, idempotencyKey });
  async function post(path: string, input: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(input),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      preview?: Preview;
      receipt?: Receipt;
    } | null;
    if (!response.ok) throw new Error(result?.error ?? "The account action could not be completed.");
    return result;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The account action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <p>Permission required for account lifecycle operations.</p>;
  if (accountStatus !== "ACTIVE")
    return <p>This account is {accountStatus.toLowerCase()}. Suspension is available only for an active account.</p>;
  return (
    <section className="chartroom-support" aria-labelledby="account-lifecycle-action-title">
      <h3 id="account-lifecycle-action-title">Suspend account</h3>
      <p>
        Suspension immediately revokes active sessions. Reactivation is intentionally unavailable until Wayfarer
        supplies its separate governed owner command.
      </p>
      {notice ? (
        <p role="status" className="chartroom-notice">
          {notice}
        </p>
      ) : null}
      <label>
        Reason
        <textarea
          value={reason}
          minLength={8}
          maxLength={240}
          required
          onChange={(event) => {
            setReason(event.target.value);
            setIdempotencyKey(`account_${crypto.randomUUID().replaceAll("-", "")}`);
            setPreview(null);
            setReceipt(null);
          }}
          placeholder="Describe why this account must be suspended."
        />
      </label>
      <label>
        Confirm current password for privileged assurance
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !password}
        onClick={() =>
          void run(async () => {
            await post("/api/admin/assurance", { password });
            setPassword("");
            setAssured(true);
            setNotice("Recent privileged assurance is active for this action.");
          })
        }
      >
        Verify identity
      </button>
      <button
        type="button"
        disabled={busy || reason.trim().length < 8}
        onClick={() =>
          void run(async () => {
            const result = await post("/api/admin/commands/account-suspend/preview", body());
            setPreview(result?.preview ?? null);
            setNotice("Review the consequences, then confirm the governed action.");
          })
        }
      >
        Preview suspension
      </button>
      {preview ? (
        <div className="chartroom-projection" aria-live="polite">
          <h4>Before you suspend</h4>
          <p>
            {preview.reauthenticationRequired
              ? "Recent privileged assurance is required."
              : "No additional assurance is required."}
          </p>
          <ul>
            {preview.consequences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {preview.warnings.length ? (
            <ul>
              {preview.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            disabled={busy || !assured}
            onClick={() =>
              void run(async () => {
                const result = await post("/api/admin/commands/account-suspend/execute", body());
                setReceipt(result?.receipt ?? null);
                setNotice("Account suspension completed. Refresh the dossier to view authoritative state.");
              })
            }
          >
            Confirm and suspend account
          </button>
        </div>
      ) : null}
      {receipt ? (
        <p role="status">
          Receipt {receipt.correlationId}.{" "}
          {receipt.resultSummary.alreadySuspended
            ? "The account was already suspended."
            : "The account is now suspended."}
        </p>
      ) : null}
    </section>
  );
}
