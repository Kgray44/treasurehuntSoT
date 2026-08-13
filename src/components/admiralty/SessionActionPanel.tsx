"use client";

import { useMemo, useState } from "react";

type SessionSummary = Readonly<{
  id: string;
  deviceLabel: string | null;
  sessionType: string;
  expiresAt: Date;
  revokedAt: Date | null;
}>;
type Preview = Readonly<{ consequences: readonly string[]; warnings: readonly string[]; reauthenticationRequired: boolean }>;
type Receipt = Readonly<{ correlationId: string; resultSummary: { alreadyRevoked?: boolean; revokedAt?: string } }>;

export function SessionActionPanel({
  targetAccountId,
  csrfToken,
  sessions,
  enabled,
}: {
  targetAccountId: string;
  csrfToken: string;
  sessions: readonly SessionSummary[];
  enabled: boolean;
}) {
  const active = useMemo(() => sessions.filter((session) => !session.revokedAt), [sessions]);
  const [sessionId, setSessionId] = useState(active[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => `session_${crypto.randomUUID().replaceAll("-", "")}`);
  const [password, setPassword] = useState("");
  const [assured, setAssured] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const body = () => ({
    targetAccountId,
    sessionId,
    reason,
    idempotencyKey,
  });
  async function post(path: string, input: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(input),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; preview?: Preview; receipt?: Receipt } | null;
    if (!response.ok) throw new Error(result?.error ?? "The administrative command could not be completed.");
    return result;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The administrative command could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <p>Permission required for session security operations.</p>;
  if (!active.length) return <p>No active sessions are available for revocation.</p>;
  return (
    <section className="chartroom-support" aria-labelledby="session-action-title">
      <h3 id="session-action-title">Session security action</h3>
      <p>Revocation is immediate, cannot expose token material, and records a redacted Wayfarer security event and Admiralty receipt.</p>
      {notice ? <p role="status" className="chartroom-notice">{notice}</p> : null}
      <label>
        Active device
        <select value={sessionId} onChange={(event) => { setSessionId(event.target.value); setIdempotencyKey(`session_${crypto.randomUUID().replaceAll("-", "")}`); setPreview(null); setReceipt(null); }}>
          {active.map((session) => (
            <option key={session.id} value={session.id}>{session.deviceLabel ?? "Device not recorded"} ({session.sessionType})</option>
          ))}
        </select>
      </label>
      <label>
        Reason
        <textarea value={reason} minLength={8} maxLength={240} required onChange={(event) => { setReason(event.target.value); setIdempotencyKey(`session_${crypto.randomUUID().replaceAll("-", "")}`); setPreview(null); }} placeholder="Describe why the session must be revoked." />
      </label>
      <label>
        Confirm current password for privileged assurance
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <button type="button" disabled={busy || !password} onClick={() => void run(async () => {
        await post("/api/admin/assurance", { password });
        setPassword("");
        setAssured(true);
        setNotice("Recent privileged assurance is active for this action.");
      })}>Verify identity</button>
      <button type="button" disabled={busy || reason.trim().length < 8 || !sessionId} onClick={() => void run(async () => {
        const result = await post("/api/admin/commands/session-revoke/preview", body());
        setPreview(result?.preview ?? null);
        setNotice("Review the consequences, then confirm the governed action.");
      })}>Preview revocation</button>
      {preview ? (
        <div className="chartroom-projection" aria-live="polite">
          <h4>Before you revoke</h4>
          <p>{preview.reauthenticationRequired ? "Recent privileged assurance is required." : "No additional assurance is required."}</p>
          <ul>{preview.consequences.map((item) => <li key={item}>{item}</li>)}</ul>
          {preview.warnings.length ? <ul>{preview.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          <button type="button" disabled={busy || !assured} onClick={() => void run(async () => {
            const result = await post("/api/admin/commands/session-revoke/execute", body());
            setReceipt(result?.receipt ?? null);
            setNotice("Session revocation completed. Refresh the dossier to view authoritative state.");
          })}>Confirm and revoke session</button>
        </div>
      ) : null}
      {receipt ? <p role="status">Receipt {receipt.correlationId}. {receipt.resultSummary.alreadyRevoked ? "The session had already been revoked." : "The session is now revoked."}</p> : null}
    </section>
  );
}
