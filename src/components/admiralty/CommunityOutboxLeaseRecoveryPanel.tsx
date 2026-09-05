"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Preview = Readonly<{
  currentState: { expiredClaims: number };
  resultingState: { releasedClaims: number; queuedWorkClaimed: number };
  consequences: readonly string[];
  warnings: readonly string[];
  reauthenticationRequired: boolean;
}>;
type Receipt = Readonly<{ correlationId: string; resultSummary: { releasedClaims?: number; idempotent?: boolean } }>;

export function CommunityOutboxLeaseRecoveryPanel({
  csrfToken,
  expiredClaims,
  enabled,
}: {
  csrfToken: string;
  expiredClaims: number;
  enabled: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `community_lease_${crypto.randomUUID().replaceAll("-", "")}`,
  );
  const [password, setPassword] = useState("");
  const [assured, setAssured] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const body = () => ({ reason, idempotencyKey });
  function resetCommand() {
    setIdempotencyKey(`community_lease_${crypto.randomUUID().replaceAll("-", "")}`);
    setPreview(null);
    setReceipt(null);
    setAssured(false);
  }
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
    if (!response.ok) throw new Error(result?.error ?? "The Community recovery command could not be completed.");
    return result;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The Community recovery command could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <p>Jobs operation authority is required for Community lease recovery.</p>;
  return (
    <section className="chartroom-support" aria-labelledby="community-outbox-recovery-title">
      <div>
        <p className="chartroom-eyebrow">Harborlight owner command</p>
        <h3 id="community-outbox-recovery-title">Release expired Community leases</h3>
        <p>
          {expiredClaims
            ? `${expiredClaims} expired lease${expiredClaims === 1 ? " is" : "s are"} awaiting recovery.`
            : "No expired leases are currently reported."}
        </p>
        <p>
          This command can only release leases whose owner already expired. It cannot inspect, retry, cancel, or claim
          jobs.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const result = await post("/api/admin/commands/community-outbox-release-expired/preview", body());
            setPreview(result?.preview ?? null);
            setNotice("Review the bounded recovery consequence before confirming.");
          });
        }}
      >
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
              resetCommand();
            }}
            placeholder="Record why expired Community worker leases need recovery."
          />
        </label>
        <button type="submit" disabled={busy || reason.trim().length < 8}>
          Preview lease recovery
        </button>
        {preview ? (
          <div className="chartroom-projection" aria-live="polite">
            <h4>Before you release leases</h4>
            <p>{preview.currentState.expiredClaims} lease(s) are currently eligible for safe release.</p>
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
                  setNotice("Recent privileged assurance is active for this recovery command.");
                })
              }
            >
              Verify identity
            </button>
            <button
              type="button"
              disabled={busy || !assured}
              onClick={() =>
                void run(async () => {
                  const result = await post("/api/admin/commands/community-outbox-release-expired/execute", body());
                  setReceipt(result?.receipt ?? null);
                  setNotice("Expired Community leases were safely released. Refreshing owner state.");
                  router.refresh();
                })
              }
            >
              Confirm and release expired leases
            </button>
          </div>
        ) : null}
        {receipt ? (
          <p role="status" className="chartroom-notice">
            Receipt {receipt.correlationId}. {receipt.resultSummary.releasedClaims ?? 0} expired lease(s) released.
          </p>
        ) : null}
      </form>
    </section>
  );
}
