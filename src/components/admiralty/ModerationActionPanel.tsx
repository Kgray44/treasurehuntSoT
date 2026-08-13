"use client";

import { useMemo, useState } from "react";

type Subject = Readonly<{ subjectType: string; subjectId: string }>;
type ModerationCase = Readonly<{
  id: string;
  caseKey: string;
  status: string;
  revision: number;
  subjects: readonly Subject[];
}>;
type Preview = Readonly<{
  consequences: readonly string[];
  warnings: readonly string[];
  reauthenticationRequired: boolean;
}>;
type Receipt = Readonly<{ correlationId: string; resultSummary: { actionId?: string; state?: string } }>;

const reasonCodes = [
  "SPAM",
  "HARASSMENT",
  "PRIVACY_EXPOSURE",
  "CHILD_SAFETY",
  "MALWARE",
  "MISLEADING_LISTING",
  "PROHIBITED_CONTENT",
  "OTHER",
];
const actionForSubject: Record<string, Readonly<{ value: string; label: string }>> = {
  LISTING: { value: "QUARANTINE_LISTING", label: "Quarantine listing" },
  RELEASE: { value: "QUARANTINE_RELEASE", label: "Quarantine release" },
  PROFILE: { value: "SUSPEND_PROFILE", label: "Suspend creator profile" },
  CREATOR: { value: "SUSPEND_PROFILE", label: "Suspend creator profile" },
};

export function ModerationActionPanel({
  cases,
  csrfToken,
  enabled,
}: {
  cases: readonly ModerationCase[];
  csrfToken: string;
  enabled: boolean;
}) {
  const actionable = useMemo(
    () =>
      cases.flatMap((moderationCase) =>
        moderationCase.subjects
          .filter((subject) => actionForSubject[subject.subjectType])
          .map((subject) => ({ moderationCase, subject })),
      ),
    [cases],
  );
  const [selection, setSelection] = useState("");
  const selected = actionable.find(
    ({ moderationCase, subject }) => `${moderationCase.id}:${subject.subjectType}:${subject.subjectId}` === selection,
  );
  const [reasonCode, setReasonCode] = useState("OTHER");
  const [reason, setReason] = useState("");
  const [secondReviewerId, setSecondReviewerId] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => `moderation_${crypto.randomUUID().replaceAll("-", "")}`);
  const [password, setPassword] = useState("");
  const [assured, setAssured] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const body = () =>
    selected
      ? {
          caseId: selected.moderationCase.id,
          subjectType: selected.subject.subjectType,
          subjectId: selected.subject.subjectId,
          actionType: actionForSubject[selected.subject.subjectType].value,
          expectedRevision: selected.moderationCase.revision,
          reasonCode,
          reason,
          secondReviewerId,
          idempotencyKey,
        }
      : null;
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
    if (!response.ok) throw new Error(result?.error ?? "The moderation command could not be completed.");
    return result;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The moderation command could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  function refreshCommand() {
    setIdempotencyKey(`moderation_${crypto.randomUUID().replaceAll("-", "")}`);
    setPreview(null);
    setReceipt(null);
  }

  if (!enabled) return <p>Permission required for Community moderation operations.</p>;
  if (!actionable.length) return <p>No supported, case-attached moderation target is available for action.</p>;
  const command = body();
  return (
    <section className="chartroom-support" aria-labelledby="moderation-action-title">
      <h3 id="moderation-action-title">Apply Community moderation action</h3>
      <p>
        Only a case-attached listing, release, or profile may be selected. Every exposed action requires a distinct
        second reviewer, recent assurance, owner preview, and explicit confirmation.
      </p>
      {notice ? (
        <p role="status" className="chartroom-notice">
          {notice}
        </p>
      ) : null}
      <label>
        Case and target
        <select
          value={selection}
          onChange={(event) => {
            setSelection(event.target.value);
            refreshCommand();
          }}
        >
          <option value="">Select a case-attached target</option>
          {actionable.map(({ moderationCase, subject }) => (
            <option
              key={`${moderationCase.id}:${subject.subjectType}:${subject.subjectId}`}
              value={`${moderationCase.id}:${subject.subjectType}:${subject.subjectId}`}
            >
              {moderationCase.caseKey} · {actionForSubject[subject.subjectType].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Reason code
        <select
          value={reasonCode}
          onChange={(event) => {
            setReasonCode(event.target.value);
            refreshCommand();
          }}
        >
          {reasonCodes.map((code) => (
            <option key={code} value={code}>
              {code.replaceAll("_", " ")}
            </option>
          ))}
        </select>
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
            refreshCommand();
          }}
          placeholder="Record the governed moderation rationale without private report prose."
        />
      </label>
      <label>
        Second reviewer account ID
        <input
          value={secondReviewerId}
          minLength={1}
          maxLength={128}
          onChange={(event) => {
            setSecondReviewerId(event.target.value);
            refreshCommand();
          }}
          placeholder="A distinct reviewer required by the owner policy"
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
        disabled={busy || !command || reason.trim().length < 8 || !secondReviewerId.trim()}
        onClick={() =>
          void run(async () => {
            const result = await post("/api/admin/commands/moderation/preview", command!);
            setPreview(result?.preview ?? null);
            setNotice("Review the owner-provided consequences before confirming.");
          })
        }
      >
        Preview moderation action
      </button>
      {preview ? (
        <div className="chartroom-projection" aria-live="polite">
          <h4>Before you apply this action</h4>
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
                const result = await post("/api/admin/commands/moderation/execute", command!);
                setReceipt(result?.receipt ?? null);
                setNotice("Moderation action completed. Refresh this listing to view authoritative state.");
              })
            }
          >
            Confirm moderation action
          </button>
        </div>
      ) : null}
      {receipt ? (
        <p role="status">
          Receipt {receipt.correlationId}. {receipt.resultSummary.state ?? "Action applied"}.
        </p>
      ) : null}
    </section>
  );
}
