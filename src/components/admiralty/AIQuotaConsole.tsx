"use client";
import { useState } from "react";
import { aiGlobalPolicySchema, aiModelIds, USD_NANO, type AIGlobalPolicy } from "@/parallax/ai-policy";
import type { aiQuotaOverview, aiQuotaUsageHistory } from "@/parallax/ai-quota-projections";
import type { AIQuotaCommandInput } from "@/parallax/ai-quota-commands";
import { parseUSDNano } from "./ai-quota-format";
import styles from "./AIQuotaConsole.module.css";

type Overview = Awaited<ReturnType<typeof aiQuotaOverview>>;
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
const dailyMetrics = {
  requests: {
    label: "Requests per day",
    key: "requests",
    help: "Admitted requests, including pending or unresolved requests.",
  },
  settled: {
    label: "Settled cost per day",
    key: "settledCostNano",
    help: "Recorded cost after provider usage has settled.",
  },
  accounted: {
    label: "Accounted spending per day",
    key: "exposureNano",
    help: "Settled cost plus pending reservations and unresolved usage.",
  },
} as const;
const groups: {
  title: string;
  help: string;
  fields: { key: keyof AIGlobalPolicy; label: string; min: number; max: number; money?: boolean; nullable?: boolean }[];
}[] = [
  {
    title: "Monthly budget",
    help: "These ceilings include admitted reservations and unresolved provider usage.",
    fields: [
      { key: "monthlySpendNano", label: "Global spending cap (USD)", min: 0, max: 1000000, money: true },
      { key: "warningSpendNano", label: "Spending warning (USD)", min: 0, max: 1000000, money: true },
      { key: "monthlyRequests", label: "Global requests per month", min: 0, max: 1000000 },
      { key: "defaultUserRequests", label: "Default user requests per month", min: 0, max: 1000000 },
      {
        key: "defaultUserSpendNano",
        label: "Default user spending cap (USD, blank inherits global)",
        min: 0,
        max: 1000000,
        money: true,
        nullable: true,
      },
      { key: "maximumRequestSpendNano", label: "Maximum request exposure (USD)", min: 0, max: 1000000, money: true },
    ],
  },
  {
    title: "Request safety",
    help: "User overrides remain inside these rate and concurrency boundaries.",
    fields: [
      { key: "userRequestsPerMinute", label: "User requests per minute", min: 1, max: 100 },
      { key: "globalRequestsPerMinute", label: "Global requests per minute", min: 1, max: 1000 },
      { key: "userConcurrency", label: "Concurrent requests per user", min: 1, max: 3 },
      { key: "globalConcurrency", label: "Global concurrent requests", min: 1, max: 20 },
      { key: "maximumInputTokens", label: "Maximum input tokens", min: 1000, max: 32000 },
      { key: "maximumOutputTokens", label: "Maximum output tokens", min: 256, max: 16000 },
      { key: "timeoutMs", label: "Provider timeout (milliseconds)", min: 1000, max: 60000 },
      { key: "retentionDays", label: "Private proposal retention (days)", min: 1, max: 90 },
    ],
  },
];

export function AIQuotaConsole({
  initial,
  csrfToken,
  canManage,
}: {
  initial: Overview;
  csrfToken: string;
  canManage: boolean;
}) {
  const [overview, setOverview] = useState(initial),
    [tab, setTab] = useState("Overview"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [global, setGlobal] = useState<AIGlobalPolicy>(initial.policy);
  const [dailyMetric, setDailyMetric] = useState<keyof typeof dailyMetrics>("requests");
  const [history, setHistory] = useState<History>([]),
    [from, setFrom] = useState(`${initial.period}-01`),
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
  function changeGlobal(key: keyof AIGlobalPolicy, value: unknown) {
    setGlobal((current) => ({ ...current, [key]: value }));
    invalidate();
  }
  async function review(policy: AIGlobalPolicy, target: "GLOBAL") {
    const input: AIQuotaCommandInput = {
      target,
      policy: aiGlobalPolicySchema.parse(policy),
      expectedRevision: overview.revision,
      reason,
      idempotencyKey: crypto.randomUUID(),
    };
    const result = await post("/api/admin/commands/ai-quota-policy/preview", input);
    setPreview(result.preview);
    setPending(input);
    setAssured(false);
    setNotice("Review the exact effective policy, then confirm with recent privileged assurance.");
  }
  const budgetRatio = overview.policy.monthlySpendNano
    ? Math.min(100, (100 * overview.usage.exposureNano) / overview.policy.monthlySpendNano)
    : 100;
  const metric = dailyMetrics[dailyMetric];
  const dailyMaximum = Math.max(0, ...overview.daily.map((day) => day[metric.key]));
  const formatDaily = (value: number) => (dailyMetric === "requests" ? value.toLocaleString() : usd(value));
  const today = overview.daily.at(-1);
  const elapsedDays = Math.max(1, overview.daily.length);
  return (
    <div className={styles.console} data-period={overview.period}>
      <nav className={styles.tabs} aria-label="AI usage views">
        {["Overview", "Global Policy", "Usage History", "Provider Health"].map((name) => (
          <button
            key={name}
            type="button"
            aria-current={tab === name ? "page" : undefined}
            onClick={() => {
              setTab(name);
              invalidate();
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.period}>
        <span>UTC month {overview.period}</span>
        <span>Resets {localDate(overview.resetAt)}</span>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const data = await get("overview");
              setOverview(data);
              setGlobal(data.policy);
              invalidate();
            })
          }
        >
          Refresh usage
        </button>
      </div>
      {tab === "Overview" && (
        <>
          <div className={styles.metrics}>
            <article>
              <span>Accounted spending</span>
              <strong>{usd(overview.usage.exposureNano)}</strong>
              <small>{usd(overview.usage.settledCostNano)} settled; remainder reserved or unresolved</small>
            </article>
            <article>
              <span>Budget remaining</span>
              <strong>{usd(overview.usage.budgetRemainingNano)}</strong>
              <small>Global cap {usd(overview.policy.monthlySpendNano)}</small>
            </article>
            <article>
              <span>Admitted requests</span>
              <strong>{overview.usage.requests.toLocaleString()}</strong>
              <small>Of {overview.policy.monthlyRequests.toLocaleString()} this month</small>
            </article>
            <article>
              <span>Active Creators</span>
              <strong>{overview.usage.activeUsers}</strong>
              <small>{overview.byMode.find((item) => item.mode === "ADVANCED")?.requests ?? 0} advanced requests</small>
            </article>
          </div>
          <section className={styles.card}>
            <header>
              <h2>Monthly budget watch</h2>
              <span>
                {overview.usage.overBudget
                  ? "Budget exceeded — investigate"
                  : overview.usage.warning
                    ? "Spending warning reached"
                    : "Within configured budget"}
              </span>
            </header>
            <progress aria-label="Global AI budget used" value={budgetRatio} max={100} />
            <p>
              Reservations are included immediately. Unknown provider usage stays conservatively accounted until
              reconciliation.
            </p>
          </section>
          <section className={styles.card}>
            <header>
              <h2>Daily AI activity</h2>
              <label className={styles.metricSelector}>
                Chart shows
                <select
                  value={dailyMetric}
                  onChange={(event) => setDailyMetric(event.target.value as keyof typeof dailyMetrics)}
                >
                  {Object.entries(dailyMetrics).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </header>
            <p>Each bar represents the UTC day a request was admitted. {metric.help}</p>
            <dl className={styles.dailySummary}>
              <div>
                <dt>Requests today · UTC</dt>
                <dd>{(today?.requests ?? 0).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Settled cost today · UTC</dt>
                <dd>{usd(today?.settledCostNano ?? 0)}</dd>
              </div>
              <div>
                <dt>Average requests / day</dt>
                <dd>
                  {(overview.usage.requests / elapsedDays).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </dd>
              </div>
              <div>
                <dt>Average settled cost / day</dt>
                <dd>{usd(overview.usage.settledCostNano / elapsedDays)}</dd>
              </div>
            </dl>
            <div className={styles.chartScale} aria-live="polite">
              <span>{metric.label}</span>
              <span>
                Scale: 0–{formatDaily(dailyMaximum)}
                {dailyMetric === "requests" ? " requests" : " USD"}
              </span>
            </div>
            <figure className={styles.chart} aria-label={`${metric.label} by UTC day`}>
              <figcaption className={styles.srOnly}>
                {metric.label} by UTC request day. Exact values follow in the daily activity table.
              </figcaption>
              {overview.daily.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date} UTC: ${day.requests} requests; ${usd(day.settledCostNano)} settled; ${usd(day.exposureNano)} accounted`}
                >
                  <span
                    data-date={day.date}
                    data-value={day[metric.key]}
                    aria-hidden="true"
                    style={{
                      height: `${dailyMaximum ? (100 * day[metric.key]) / dailyMaximum : 0}%`,
                    }}
                  />
                  <small>{day.date.slice(-2)}</small>
                </div>
              ))}
            </figure>
            {dailyMaximum === 0 && (
              <p className={styles.emptyChart}>
                No{" "}
                {dailyMetric === "requests"
                  ? "admitted requests"
                  : dailyMetric === "settled"
                    ? "settled cost"
                    : "accounted spending"}{" "}
                in this month so far.
              </p>
            )}
            <small>
              Daily averages include zero-activity days from the first of the UTC month through today. Requests with
              released reservations are excluded.
            </small>
            <details>
              <summary>Read daily requests and costs as a table</summary>
              <div className={styles.scroll}>
                <table>
                  <caption className={styles.srOnly}>Daily AI requests and costs, grouped by UTC request day</caption>
                  <thead>
                    <tr>
                      <th scope="col">Day · UTC</th>
                      <th scope="col">Requests</th>
                      <th scope="col">Accounted spending</th>
                      <th scope="col">Settled cost</th>
                      <th scope="col">Reserved / unresolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.daily.map((day) => (
                      <tr key={day.date}>
                        <th scope="row">{day.date}</th>
                        <td>{day.requests.toLocaleString()}</td>
                        <td>{usd(day.exposureNano)}</td>
                        <td>{usd(day.settledCostNano)}</td>
                        <td>{usd(Math.max(0, day.exposureNano - day.settledCostNano))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <div className={styles.columns}>
            <section className={styles.card}>
              <h2>Request outcomes</h2>
              <dl>
                {overview.byStatus.map((item) => (
                  <div key={item.status}>
                    <dt>{item.status.replaceAll("_", " ")}</dt>
                    <dd>{item.requests}</dd>
                  </div>
                ))}
              </dl>
              {!overview.byStatus.length && <p>No AI requests this month.</p>}
            </section>
            <section className={styles.card}>
              <h2>Provider status</h2>
              <p>
                {overview.provider.configured
                  ? overview.policy.enabled
                    ? "Configured and enabled"
                    : "Configured; assistance disabled"
                  : "OpenAI credential is not configured"}
              </p>
              <p>{overview.provider.unknownUsageCount} requests awaiting usage reconciliation.</p>
              <button onClick={() => setTab("Provider Health")}>Inspect provider health</button>
            </section>
          </div>
        </>
      )}
      {tab === "Global Policy" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => review(global, "GLOBAL"));
          }}
        >
          <section className={styles.card}>
            <header>
              <h2>Provider & model policy</h2>
              <span>Revision {overview.revision}</span>
            </header>
            <p>
              OpenAI · text-only structured authoring · no external tools. Credentials are configured on the server.
            </p>
            <div className={styles.switches}>
              <label>
                <input
                  type="checkbox"
                  checked={global.enabled}
                  disabled={!canManage}
                  onChange={(event) => changeGlobal("enabled", event.target.checked)}
                />
                Enable live AI assistance
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={global.advancedEnabled}
                  disabled={!canManage}
                  onChange={(event) => changeGlobal("advancedEnabled", event.target.checked)}
                />
                Allow individually authorized advanced access
              </label>
            </div>
            <div className={styles.fields}>
              {(["standardModel", "advancedModel"] as const).map((key) => (
                <label key={key}>
                  {key === "standardModel" ? "Standard model" : "Advanced model"}
                  <select
                    value={global[key]}
                    disabled={!canManage}
                    onChange={(event) => changeGlobal(key, event.target.value)}
                  >
                    {aiModelIds.map((id) => (
                      <option key={id}>{id}</option>
                    ))}
                  </select>
                </label>
              ))}
              {(["standardReasoning", "advancedReasoning"] as const).map((key) => (
                <label key={key}>
                  {key === "standardReasoning" ? "Standard reasoning" : "Advanced reasoning"}
                  <select
                    value={global[key]}
                    disabled={!canManage}
                    onChange={(event) => changeGlobal(key, event.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                  </select>
                </label>
              ))}
            </div>
            <fieldset className={styles.switches}>
              <legend>Allowed models</legend>
              {aiModelIds.map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={global.allowedModels.includes(id)}
                    disabled={!canManage}
                    onChange={(event) =>
                      changeGlobal(
                        "allowedModels",
                        event.target.checked
                          ? [...global.allowedModels, id]
                          : global.allowedModels.filter((model) => model !== id),
                      )
                    }
                  />
                  {id}
                </label>
              ))}
            </fieldset>
          </section>
          {groups.map((group) => (
            <section key={group.title} className={styles.card}>
              <h2>{group.title}</h2>
              <p>{group.help}</p>
              <div className={styles.fields}>
                {group.fields.map((field) => (
                  <label key={field.key}>
                    {field.label}
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.money ? "0.000000001" : 1}
                      disabled={!canManage}
                      value={
                        global[field.key] === null
                          ? ""
                          : field.money
                            ? Number(global[field.key]) / USD_NANO
                            : Number(global[field.key])
                      }
                      onChange={(event) =>
                        changeGlobal(
                          field.key,
                          field.nullable && !event.target.value
                            ? null
                            : field.money
                              ? parseUSDNano(event.target.value)
                              : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
          <section className={styles.card}>
            <label>
              Reason for change
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
                type="submit"
                disabled={
                  !canManage || busy || !aiGlobalPolicySchema.safeParse(global).success || reason.trim().length < 8
                }
              >
                Preview global policy
              </button>
              <button
                type="button"
                disabled={!canManage || busy || reason.trim().length < 8}
                onClick={() => {
                  changeGlobal("enabled", false);
                  void run(() => review({ ...global, enabled: false }, "GLOBAL"));
                }}
              >
                Preview emergency disable
              </button>
            </div>
            <p>Previous values can be restored through a new revision. Spending history remains intact.</p>
          </section>
        </form>
      )}
      {tab === "Usage History" && (
        <section className={styles.card}>
          <h2>Platform usage history</h2>
          <form
            className={styles.search}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const data = await get(
                  "history",
                  new URLSearchParams({ from: `${from}T00:00:00Z`, to: `${to}T00:00:00Z` }),
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
              href={`/api/admin/ai-usage?${new URLSearchParams({ section: "export", from: `${from}T00:00:00Z`, to: `${to}T00:00:00Z` })}`}
              download
            >
              Export safe metadata
            </a>
          </form>
          <p>
            Latest 100 records in this view; export is bounded to 1,000 records. Retained proposals and prompts are
            excluded.
          </p>
          <div className={styles.scroll}>
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
      )}
      {tab === "Provider Health" && (
        <section className={styles.card}>
          <h2>OpenAI provider health</h2>
          <dl>
            <div>
              <dt>Configuration</dt>
              <dd>{overview.provider.configured ? "Credential configured on server" : "Unconfigured"}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                {overview.policy.enabled
                  ? "Enabled by policy; upstream availability requires a successful call"
                  : "Disabled by policy"}
              </dd>
            </div>
            <div>
              <dt>Last successful invocation</dt>
              <dd>{localDate(overview.provider.lastSuccessAt)}</dd>
            </div>
            <div>
              <dt>Last failure category</dt>
              <dd>{overview.provider.lastFailureCode ?? "No recorded failure"}</dd>
            </div>
            <div>
              <dt>Last failure</dt>
              <dd>{localDate(overview.provider.lastFailureAt)}</dd>
            </div>
            <div>
              <dt>Reconciliation</dt>
              <dd>{overview.provider.reconciliation.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Legacy adapter</dt>
              <dd>
                {overview.provider.legacyConfigured
                  ? "Legacy configuration detected; network path retired"
                  : "No legacy credential reference"}
              </dd>
            </div>
          </dl>
          <h3>Versioned standard text pricing</h3>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Input / cached / cache writes / output per million</th>
                  <th>Effective</th>
                </tr>
              </thead>
              <tbody>
                {overview.provider.pricing.map((price) => (
                  <tr key={price.model}>
                    <td>
                      {price.model}
                      <small>{price.revision}</small>
                    </td>
                    <td>
                      {[
                        price.inputNanoPerToken,
                        price.cachedInputNanoPerToken,
                        price.cacheWriteNanoPerToken,
                        price.outputNanoPerToken,
                      ]
                        .map((rate) => usd(rate * 1000000))
                        .join(" / ")}
                    </td>
                    <td>{localDate(price.effectiveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Only the fixed OpenAI HTTPS endpoint is allowed. No tools, image generation, alternate tier or long-context
            pricing is enabled. Successful deterministic fixtures do not establish live-provider qualification.
          </p>
        </section>
      )}
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
                  const data = await get("overview");
                  setOverview(data);
                  setGlobal(data.policy);
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
