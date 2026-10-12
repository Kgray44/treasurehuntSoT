"use client";
import { useState } from "react";
import { aiUserPolicySchema, USD_NANO, type AIUserPolicy } from "@/parallax/ai-policy";
import type { aiQuotaUserDetail, aiQuotaUsageHistory } from "@/parallax/ai-quota-projections";
import type { AIQuotaCommandInput } from "@/parallax/ai-quota-commands";
import { parseUSDNano } from "./ai-quota-format";
import styles from "./AIQuotaConsole.module.css";
type User = NonNullable<Awaited<ReturnType<typeof aiQuotaUserDetail>>>;
type History = Awaited<ReturnType<typeof aiQuotaUsageHistory>>;
type Preview = {
  previewId: string;
  currentState: { policy: unknown; revision: number; effective: unknown };
  resultingState: { policy: unknown; revision: number; effective: unknown };
  consequences: string[];
  warnings: string[];
};
const usd = (nano: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(
    nano / USD_NANO,
  );
const localDate = (value: string | null) => (value ? new Date(value).toLocaleString() : "No activity recorded");
const emptyOverride: AIUserPolicy = {
  monthlyRequests: null,
  monthlySpendNano: null,
  advancedEnabled: null,
  requestsPerMinute: null,
  suspended: false,
  expiresAt: null,
};

export function AIQuotaUserPanel({
  initial,
  csrfToken,
  canManage,
}: {
  initial: User;
  csrfToken: string;
  canManage: boolean;
}) {
  const [selected, setSelected] = useState(initial),
    [override, setOverride] = useState<AIUserPolicy>(initial.policy ?? emptyOverride);
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<History>([]),
    [from, setFrom] = useState(new Date(Date.parse(initial.resetAt) - 86400000).toISOString().slice(0, 7) + "-01"),
    [to, setTo] = useState(initial.resetAt.slice(0, 10));
  const [reason, setReason] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [pending, setPending] = useState<AIQuotaCommandInput | null>(null),
    [password, setPassword] = useState(""),
    [assured, setAssured] = useState(false);
  async function get(section: string, params = new URLSearchParams()) {
    params.set("section", section);
    const response = await fetch(`/api/admin/ai-usage?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "This AI usage view is unavailable.");
    return data;
  }
  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The policy change could not be completed.");
    return result;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The operation could not finish.");
    } finally {
      setBusy(false);
    }
  }
  function invalidate() {
    setPreview(null);
    setPending(null);
    setAssured(false);
  }
  async function review(policy: AIUserPolicy | null) {
    const input: AIQuotaCommandInput = {
      target: "USER",
      accountId: selected.accountId,
      policy: aiUserPolicySchema.nullable().parse(policy),
      expectedRevision: selected.revision,
      reason,
      idempotencyKey: crypto.randomUUID(),
    };
    const result = await post("/api/admin/commands/ai-quota-policy/preview", input);
    setPreview(result.preview);
    setPending(input);
    setAssured(false);
    setNotice("Review the exact effective policy, then confirm with recent privileged assurance.");
  }
  return (
    <div className={styles.console}>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const data = await get("user", new URLSearchParams({ accountId: selected.accountId }));
            if (!data.user) throw new Error("Account usage is unavailable.");
            setSelected(data.user);
            setOverride(data.user.policy ?? emptyOverride);
            invalidate();
          })
        }
      >
        Refresh account usage
      </button>
      <div className={styles.metrics}>
        <article>
          <span>Requests used / allowance</span>
          <strong>
            {selected.used} / {selected.effective.monthlyRequests}
          </strong>
          <small>{selected.remaining} remaining</small>
        </article>
        <article>
          <span>Accounted spending</span>
          <strong>{usd(selected.exposureNano)}</strong>
          <small>{usd(selected.settledCostNano)} settled</small>
        </article>
      </div>
      <section className={styles.card} aria-label={`${selected.displayName} AI policy`}>
        <header>
          <h2>{selected.displayName}</h2>
        </header>
        <p>
          {selected.effective.source === "OVERRIDE" ? "Individual override" : "Inherited platform default"} ·{" "}
          {selected.percentageUsed.toFixed(1)}% used · resets {localDate(selected.resetAt)}
        </p>
        <progress aria-label="User requests used" max={100} value={selected.percentageUsed} />
        <p>
          Global ceilings: {selected.globalCeiling.requests.toLocaleString()} requests and{" "}
          {usd(selected.globalCeiling.spendNano)}. Last activity: {localDate(selected.lastActivity)}.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => review(override));
          }}
        >
          <div className={styles.fields}>
            <label>
              Monthly request allowance (blank inherits)
              <input
                type="number"
                min={0}
                max={1000000}
                value={override.monthlyRequests ?? ""}
                disabled={!canManage}
                onChange={(event) => {
                  setOverride({ ...override, monthlyRequests: event.target.value ? Number(event.target.value) : null });
                  invalidate();
                }}
              />
            </label>
            <label>
              Personal spending allowance (USD, blank inherits)
              <input
                type="number"
                min={0}
                step="0.000000001"
                value={override.monthlySpendNano === null ? "" : override.monthlySpendNano / USD_NANO}
                disabled={!canManage}
                onChange={(event) => {
                  setOverride({
                    ...override,
                    monthlySpendNano: event.target.value ? parseUSDNano(event.target.value) : null,
                  });
                  invalidate();
                }}
              />
            </label>
            <label>
              Requests per minute (blank inherits)
              <input
                type="number"
                min={1}
                max={100}
                value={override.requestsPerMinute ?? ""}
                disabled={!canManage}
                onChange={(event) => {
                  setOverride({
                    ...override,
                    requestsPerMinute: event.target.value ? Number(event.target.value) : null,
                  });
                  invalidate();
                }}
              />
            </label>
            <label>
              Advanced eligibility
              <select
                value={override.advancedEnabled === null ? "inherit" : String(override.advancedEnabled)}
                disabled={!canManage}
                onChange={(event) => {
                  setOverride({
                    ...override,
                    advancedEnabled: event.target.value === "inherit" ? null : event.target.value === "true",
                  });
                  invalidate();
                }}
              >
                <option value="inherit">Inherit standard access</option>
                <option value="true">Permit when globally allowed</option>
                <option value="false">Standard only</option>
              </select>
            </label>
            <label>
              Exception expiry (local time, blank is ongoing)
              <input
                type="datetime-local"
                disabled={!canManage}
                value={
                  override.expiresAt
                    ? new Date(
                        Date.parse(override.expiresAt) - new Date(override.expiresAt).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(event) => {
                  setOverride({
                    ...override,
                    expiresAt: event.target.value ? new Date(event.target.value).toISOString() : null,
                  });
                  invalidate();
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={override.suspended}
                disabled={!canManage}
                onChange={(event) => {
                  setOverride({ ...override, suspended: event.target.checked });
                  invalidate();
                }}
              />
              Suspend AI access
            </label>
          </div>
          <label>
            Reason for user policy change
            <textarea
              maxLength={240}
              minLength={8}
              required
              value={reason}
              disabled={!canManage}
              onChange={(event) => {
                setReason(event.target.value);
                invalidate();
              }}
            />
          </label>
          <div className={styles.actions}>
            <button
              disabled={
                !canManage || busy || reason.trim().length < 8 || !aiUserPolicySchema.safeParse(override).success
              }
            >
              Preview user policy
            </button>
            <button
              type="button"
              disabled={!canManage || busy || reason.trim().length < 8}
              onClick={() => void run(() => review(null))}
            >
              Preview restore inherited policy
            </button>
            <button
              type="button"
              onClick={() => {
                void run(async () => {
                  const data = await get("history", new URLSearchParams({ accountId: selected.accountId }));
                  setHistory(data.records);
                });
              }}
            >
              View user history
            </button>
          </div>
        </form>
      </section>
      <section className={styles.card}>
        <h2>{`${selected.displayName} usage history`}</h2>
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const data = await get(
                "history",
                new URLSearchParams({
                  from: `${from}T00:00:00Z`,
                  to: `${to}T00:00:00Z`,
                  accountId: selected.accountId,
                }),
              );
              setHistory(data.records);
            });
          }}
        >
          <label>
            From (UTC)
            <input type="date" value={from} required onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Until, exclusive (UTC)
            <input type="date" value={to} required onChange={(event) => setTo(event.target.value)} />
          </label>
          <button disabled={busy}>Load history</button>
          <a
            href={`/api/admin/ai-usage?${new URLSearchParams({ section: "export", from: `${from}T00:00:00Z`, to: `${to}T00:00:00Z`, accountId: selected.accountId })}`}
            download
          >
            Export safe metadata
          </a>
        </form>
        <p>
          Latest 100 records in this view; export is bounded to 1,000 records. Retained proposals and prompts are
          excluded.
        </p>
        <div className={styles.scroll} tabIndex={0} role="region" aria-label="Account AI request history">
          <table>
            <thead>
              <tr>
                <th>Time / request</th>
                <th>Model / operation</th>
                <th>State</th>
                <th>Tokens in / cached / out</th>
                <th>Reserved / accounted / settled</th>
                <th>Finding</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id}>
                  <td>
                    {localDate(record.createdAt)}
                    <small>{record.requestId}</small>
                  </td>
                  <td>
                    {record.model}
                    <small>{record.operationCategory}</small>
                  </td>
                  <td>{record.status}</td>
                  <td>
                    {record.inputTokens ?? "—"} / {record.cachedInputTokens ?? "—"} / {record.outputTokens ?? "—"}
                  </td>
                  <td>
                    {usd(record.reservationNano)} / {usd(record.exposureNano)} /{" "}
                    {record.settledCostNano === null ? "Unsettled" : usd(record.settledCostNano)}
                  </td>
                  <td>
                    {record.failureCode ?? "—"}
                    <small>{record.pricingRevision}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!history.length && <p>No usage records loaded for this range.</p>}
      </section>
      {preview && pending && (
        <section className={styles.review} aria-label="Review AI quota policy change">
          <h2>Review before applying</h2>
          <p>
            Revision {preview.currentState.revision} → {preview.resultingState.revision}. This change preserves every
            usage record.
          </p>
          <div className={styles.columns}>
            <div>
              <h3>Current effective policy</h3>
              <pre>{JSON.stringify(preview.currentState.effective ?? preview.currentState.policy, null, 2)}</pre>
            </div>
            <div>
              <h3>Proposed effective policy</h3>
              <pre>{JSON.stringify(preview.resultingState.effective ?? preview.resultingState.policy, null, 2)}</pre>
            </div>
          </div>
          <ul>
            {[...preview.consequences, ...preview.warnings].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <label>
              Current password for privileged assurance
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button
              disabled={busy || !password}
              onClick={() =>
                void run(async () => {
                  await post("/api/admin/assurance", { password });
                  setPassword("");
                  setAssured(true);
                  setNotice("Recent privileged assurance verified. Confirm the reviewed change.");
                })
              }
            >
              Verify current password
            </button>
            <button
              disabled={busy || !assured}
              onClick={() =>
                void run(async () => {
                  const result = await post("/api/admin/commands/ai-quota-policy/execute", {
                    input: pending,
                    previewId: preview.previewId,
                    confirmed: true,
                  });
                  const data = await get("user", new URLSearchParams({ accountId: selected.accountId }));
                  if (!data.user) throw new Error("Account usage is unavailable.");
                  setSelected(data.user);
                  setOverride(data.user.policy ?? emptyOverride);
                  invalidate();
                  setReason("");
                  setNotice(
                    `Policy applied at revision ${result.receipt.revision}. Audit receipt ${result.receipt.id}.`,
                  );
                })
              }
            >
              Confirm & apply policy
            </button>
            <button disabled={busy} onClick={invalidate}>
              Cancel change
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
