"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Policy = Readonly<{
  dispatchEnabled: boolean;
  batchSize: number;
  pollIntervalMs: number;
  revision: number;
  source: "DEFAULT" | "GOVERNED_POLICY";
}>;
type Preview = Readonly<{
  currentState: Policy;
  resultingState: Policy;
  consequences: readonly string[];
  warnings: readonly string[];
  reauthenticationRequired: boolean;
  rollbackAvailable: boolean;
}>;
type Receipt = Readonly<{
  correlationId: string;
  resultSummary: { policy?: Policy; idempotent?: boolean; rollbackAvailable?: boolean };
}>;

export function CommunityOutboxRuntimePolicyPanel({
  csrfToken,
  policy,
  enabled,
}: {
  csrfToken: string;
  policy: Policy;
  enabled: boolean;
}) {
  const router = useRouter();
  const [dispatchEnabled, setDispatchEnabled] = useState(policy.dispatchEnabled);
  const [batchSize, setBatchSize] = useState(policy.batchSize);
  const [pollIntervalMs, setPollIntervalMs] = useState(policy.pollIntervalMs);
  const [expectedRevision, setExpectedRevision] = useState(policy.revision);
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `community_policy_${crypto.randomUUID().replaceAll("-", "")}`,
  );
  const [password, setPassword] = useState("");
  const [assured, setAssured] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function resetCommand() {
    setIdempotencyKey(`community_policy_${crypto.randomUUID().replaceAll("-", "")}`);
    setPreview(null);
    setReceipt(null);
    setAssured(false);
  }
  const body = () => ({ expectedRevision, dispatchEnabled, batchSize, pollIntervalMs, reason, idempotencyKey });
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
    if (!response.ok) throw new Error(result?.error ?? "The governed configuration change could not be completed.");
    return result;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The governed configuration change could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <p>Configuration operation authority is required to manage this Harborlight-owned policy.</p>;
  const valid =
    reason.trim().length >= 8 &&
    batchSize >= 1 &&
    batchSize <= 25 &&
    pollIntervalMs >= 1_000 &&
    pollIntervalMs <= 60_000;
  return (
    <section className="chartroom-support" aria-labelledby="community-outbox-policy-title">
      <div>
        <p className="chartroom-eyebrow">Harborlight-owned governed policy</p>
        <h3 id="community-outbox-policy-title">Community outbox runtime</h3>
        <p>
          This policy is enforced by the Community worker. It never edits deployment variables, credentials, provider
          references, or job payloads.
        </p>
        <dl className="chartroom-details">
          <div>
            <dt>Effective state</dt>
            <dd>{policy.dispatchEnabled ? "Accepting new work" : "Paused"}</dd>
          </div>
          <div>
            <dt>Worker batch</dt>
            <dd>{policy.batchSize} jobs</dd>
          </div>
          <div>
            <dt>Idle poll</dt>
            <dd>{Math.round(policy.pollIntervalMs / 1_000)} seconds</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{policy.revision || "Default policy"}</dd>
          </div>
        </dl>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const result = await post("/api/admin/commands/community-outbox-runtime-policy/preview", body());
            setPreview(result?.preview ?? null);
            setNotice("Review the owner-provided policy diff, then complete privileged confirmation.");
          });
        }}
      >
        {notice ? (
          <p role="status" className="chartroom-notice">
            {notice}
          </p>
        ) : null}
        <label>
          <input
            type="checkbox"
            checked={dispatchEnabled}
            onChange={(event) => {
              setDispatchEnabled(event.target.checked);
              resetCommand();
            }}
          />
          Accept new Community outbox work
        </label>
        <label>
          Jobs per worker batch
          <input
            type="number"
            min={1}
            max={25}
            value={batchSize}
            onChange={(event) => {
              setBatchSize(Number(event.target.value));
              resetCommand();
            }}
          />
        </label>
        <label>
          Idle worker poll interval (milliseconds)
          <input
            type="number"
            min={1_000}
            max={60_000}
            step={1_000}
            value={pollIntervalMs}
            onChange={(event) => {
              setPollIntervalMs(Number(event.target.value));
              resetCommand();
            }}
          />
        </label>
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
            placeholder="Record why this bounded Harborlight policy needs to change."
          />
        </label>
        <button type="submit" disabled={busy || !valid}>
          Preview policy change
        </button>
        {preview ? (
          <div className="chartroom-projection" aria-live="polite">
            <h4>Before you apply this policy</h4>
            <p>
              Current: {preview.currentState.dispatchEnabled ? "accepting work" : "paused"},{" "}
              {preview.currentState.batchSize} jobs per batch, polling every{" "}
              {Math.round(preview.currentState.pollIntervalMs / 1_000)} seconds.
            </p>
            <p>
              Proposed: {preview.resultingState.dispatchEnabled ? "accepting work" : "paused"},{" "}
              {preview.resultingState.batchSize} jobs per batch, polling every{" "}
              {Math.round(preview.resultingState.pollIntervalMs / 1_000)} seconds.
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
                  setNotice("Recent privileged assurance is active for this policy change.");
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
                  const result = await post("/api/admin/commands/community-outbox-runtime-policy/execute", body());
                  const nextReceipt = result?.receipt ?? null;
                  setReceipt(nextReceipt);
                  setExpectedRevision(nextReceipt?.resultSummary.policy?.revision ?? expectedRevision + 1);
                  setNotice("Community outbox runtime policy changed. The worker will enforce it on its next pass.");
                  router.refresh();
                })
              }
            >
              Confirm and apply policy
            </button>
          </div>
        ) : null}
        {receipt ? (
          <div role="status" className="chartroom-notice">
            <p>Receipt {receipt.correlationId}. The owner policy postcondition was recorded.</p>
            {receipt.resultSummary.rollbackAvailable && preview ? (
              <button
                type="button"
                onClick={() => {
                  setDispatchEnabled(preview.currentState.dispatchEnabled);
                  setBatchSize(preview.currentState.batchSize);
                  setPollIntervalMs(preview.currentState.pollIntervalMs);
                  resetCommand();
                  setNotice("The prior policy is staged as a governed revert. Preview it before applying.");
                }}
              >
                Stage governed revert
              </button>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}
