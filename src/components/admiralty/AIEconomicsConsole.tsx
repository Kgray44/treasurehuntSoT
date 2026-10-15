"use client";
import Link from "next/link";
import { useState } from "react";
import type { aiEconomicsOverview, aiEconomicsHistory, aiEconomicsOperation } from "@/parallax/ai-economics";
import styles from "./AIEconomicsConsole.module.css";

type Overview = Awaited<ReturnType<typeof aiEconomicsOverview>>;
type History = Awaited<ReturnType<typeof aiEconomicsHistory>>;
type Operation = NonNullable<Awaited<ReturnType<typeof aiEconomicsOperation>>>;
export function economicsUSD(value: string | bigint | number | null) {
  if (value === null) return "Unavailable";
  const amount = BigInt(value),
    negative = amount < BigInt(0),
    absolute = negative ? -amount : amount;
  const fraction = (absolute % BigInt(1e9)).toString().padStart(9, "0").replace(/0+$/, "");
  return `${negative ? "−" : ""}$${(absolute / BigInt(1e9)).toLocaleString("en-US")}.${fraction.padEnd(2, "0")}`;
}
const percent = (value: number | null) => (value === null ? "Unavailable" : `${(value * 100).toFixed(1)}%`);
const label = (value: string) => value.replaceAll("_", " ").toLowerCase();
const when = (value: string | Date | null) => (value ? new Date(String(value)).toLocaleString() : "Not recorded");

export function AIEconomicsConsole({ initial }: { initial: Overview }) {
  const [data, setData] = useState(initial),
    [view, setView] = useState("Overview");
  const [from, setFrom] = useState(initial.from.slice(0, 10)),
    [to, setTo] = useState(new Date(Date.parse(initial.to) - 1).toISOString().slice(0, 10));
  const [capability, setCapability] = useState(""),
    [person, setPerson] = useState(""),
    [model, setModel] = useState("");
  const [outcome, setOutcome] = useState(""),
    [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [history, setHistory] = useState<History>({ records: [], nextCursor: null });
  const [operation, setOperation] = useState<Operation | null>(null);
  function parameters(section: string) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const params = new URLSearchParams({ section, from: `${from}T00:00:00.000Z`, to: end.toISOString() });
    for (const [key, value] of Object.entries({ capabilityId: capability, accountId: person, model, outcome, search }))
      if (value) params.set(key, value);
    return params;
  }
  async function read(section: string, extras: Record<string, string> = {}) {
    const params = parameters(section);
    for (const [key, value] of Object.entries(extras)) params.set(key, value);
    const response = await fetch(`/api/admin/ai-economics?${params}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "AI economics is unavailable. Retry this view.");
    return body;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This view could not load.");
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const overview = await read("overview");
    setData(overview);
    setOperation(null);
    if (view === "Operation History") setHistory(await read("history"));
  }
  function recent(days: number) {
    const end = new Date(),
      start = new Date(end.getTime() - (days - 1) * 86400000);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }
  const useful = data.capabilities.reduce((sum, item) => sum + item.usefulResults, 0);
  const maxCost = Math.max(1, ...data.capabilities.map((item) => Number(item.knownCostNano)));
  const trendMax = Math.max(1, ...data.daily.map((day) => Number(day.knownCostNano)));
  const trend = data.daily
    .map(
      (day, index) =>
        `${data.daily.length > 1 ? (index / (data.daily.length - 1)) * 600 : 300},${120 - (Number(day.knownCostNano) / trendMax) * 100}`,
    )
    .join(" ");
  return (
    <section className={styles.workspace} aria-label="AI economics workspace" aria-busy={busy}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>ADMIRALTY · AI MANAGEMENT</p>
          <h2>Cost. Capability. Useful outcomes.</h2>
          <p>Provider completion, applied edits and accepted rooms have separate receipts.</p>
        </div>
        <span className={styles.coverage}>
          {data.totals.historicalIncompleteOperations
            ? "Incomplete historical coverage"
            : "Recorded operation evidence"}
        </span>
      </header>
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          void run(refresh);
        }}
      >
        <div className={styles.quick}>
          <button type="button" onClick={() => recent(7)}>
            Last 7 days
          </button>
          <button type="button" onClick={() => recent(30)}>
            Last 30 days
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setFrom(`${now.toISOString().slice(0, 7)}-01`);
              setTo(now.toISOString().slice(0, 10));
            }}
          >
            This month
          </button>
        </div>
        <label>
          From date (UTC)
          <input type="date" required value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Through date (UTC)
          <input type="date" required value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>
          Capability
          <select value={capability} onChange={(event) => setCapability(event.target.value)}>
            <option value="">All capabilities</option>
            {initial.capabilities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            <option value="">All models</option>
            {[...new Set(initial.models.map((item) => item.model))].map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} className={styles.primary}>
          {busy ? "Loading economics…" : "Apply economics filters"}
        </button>
      </form>
      {error && (
        <div className={styles.error} role="alert">
          {error}
          <p>
            Showing the last successfully loaded data: {data.from.slice(0, 10)} – {data.to.slice(0, 10)} (end exclusive,
            UTC). Requested filter changes have not been applied.
          </p>
          <button onClick={() => void run(refresh)}>Retry economics</button>
        </div>
      )}
      <p className={styles.period}>
        Showing operations initiated {data.from.slice(0, 10)} – {data.to.slice(0, 10)} (end exclusive, UTC).
        {data.comparison.costChangeRatio === null
          ? " No comparable previous-period spending."
          : ` Observed cost ${data.comparison.costChangeRatio >= 0 ? "+" : ""}${(data.comparison.costChangeRatio * 100).toFixed(1)}% against the preceding equal period.`}
      </p>
      <nav className={styles.tabs} aria-label="AI economics views">
        {["Overview", "Quality & Outcomes", "People & Allowances", "Capabilities", "Operation History"].map((name) => (
          <button
            key={name}
            disabled={busy}
            aria-current={view === name ? "page" : undefined}
            onClick={() => {
              setView(name);
              setOperation(null);
              if (name === "Operation History") void run(async () => setHistory(await read("history")));
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {!data.totals.operations && (
        <div className={styles.empty}>
          <h3>No AI operations in this period</h3>
          <p>
            Choose another period or capability. Usage will appear after real operations are admitted; no example
            spending is added.
          </p>
        </div>
      )}
      {view === "Overview" && (
        <>
          <div className={styles.metrics}>
            <article>
              <span>Observed AI cost</span>
              <strong>{economicsUSD(data.totals.knownCostNano)}</strong>
              <small>
                Provider confirmed: {economicsUSD(data.totals.confirmedCostNano)}
                <br />
                {economicsUSD(data.totals.calculatedCostNano)} calculated
                <br />
                {economicsUSD(data.totals.estimatedCostNano)} estimated
              </small>
            </article>
            <article>
              <span>Useful recorded results</span>
              <strong>{useful}</strong>
              <small>
                Distinct accepted rooms + currently applied edits
                <br />
                {data.totals.operations} logical operations · {data.totals.providerAttempts} recorded provider attempts
              </small>
            </article>
            <article>
              <span>Failed or interrupted</span>
              <strong>{data.totals.failedOperations}</strong>
              <small>
                {economicsUSD(data.totals.failureCostNano)} observed failure cost
                <br />
                {data.totals.retriedOperations} operations used provider retries
              </small>
            </article>
            <article>
              <span>Unresolved exposure</span>
              <strong>{economicsUSD(data.totals.unresolvedExposureNano)}</strong>
              <small>
                {data.totals.unresolvedOperations} pending or unresolved operations
                <br />
                Exposure is reserved risk, not confirmed spending
              </small>
            </article>
          </div>
          <div className={styles.columns}>
            <section className={styles.card}>
              <h3>Where resources go</h3>
              <p>Observed cost by capability</p>
              <figure aria-label="Observed cost by AI capability">
                <div className={styles.bars}>
                  {data.capabilities.map((item) => (
                    <div key={item.id}>
                      <span>{item.name}</span>
                      <strong>{economicsUSD(item.knownCostNano)}</strong>
                      <div className={styles.track}>
                        <span style={{ width: `${(Number(item.knownCostNano) / maxCost) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <figcaption>Amounts retain fractions of a cent. Unknown costs remain unresolved.</figcaption>
              </figure>
            </section>
            <section className={styles.card}>
              <h3>Observed cost over time</h3>
              <figure aria-label="Daily observed AI cost">
                <svg viewBox="0 0 620 140" role="img" aria-label="UTC daily observed cost trend">
                  <path d="M0 120H620" className={styles.axis} />
                  {data.daily.length > 0 && <polyline points={trend} fill="none" className={styles.line} />}
                  {data.daily.length === 1 && (
                    <circle
                      cx="300"
                      cy={120 - (Number(data.daily[0].knownCostNano) / trendMax) * 100}
                      r="5"
                      fill="var(--accent-primary)"
                    />
                  )}
                </svg>
                <figcaption>
                  {data.daily.length} recorded UTC days · {economicsUSD(data.totals.projectedThirtyDayCostNano)} at a
                  30-day observed run rate
                </figcaption>
              </figure>
              <details>
                <summary>Daily amounts and forecast basis</summary>
                <p>{data.definitions.forecast}</p>
                <table>
                  <thead>
                    <tr>
                      <th>UTC day</th>
                      <th>Operations</th>
                      <th>Observed cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((day) => (
                      <tr key={day.date}>
                        <td>{day.date}</td>
                        <td>{day.operations}</td>
                        <td>{economicsUSD(day.knownCostNano)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>
          </div>
          <section className={styles.card}>
            <h3>Cost and evidence coverage</h3>
            <div className={styles.facts}>
              <p>
                Mean settled operation<strong>{economicsUSD(data.totals.meanCostNano)}</strong>
              </p>
              <p>
                Median settled operation<strong>{economicsUSD(data.totals.medianCostNano)}</strong>
              </p>
              <p>
                Fully settled sample<strong>{data.totals.knownCostOperations} operations</strong>
              </p>
              <p>
                Incomplete historical evidence<strong>{data.totals.historicalIncompleteOperations} operations</strong>
              </p>
            </div>
            <p>{data.definitions.costs}</p>
            <details>
              <summary>Metric definitions</summary>
              <p>{data.definitions.cohort}</p>
              <p>{data.definitions.averages}</p>
            </details>
          </section>
          <section className={styles.card}>
            <h3>Model & provider comparison</h3>
            <p>
              Compare models within the same capability. Useful-operation rates require recorded outcomes; samples below
              10 remain limited.
            </p>
            <div className={styles.table} tabIndex={0} role="region" aria-label="Model cost comparison">
              <table>
                <thead>
                  <tr>
                    <th>Capability / provider / model</th>
                    <th>Operations</th>
                    <th>Observed cost</th>
                    <th>Useful operations</th>
                    <th>Cost per useful operation</th>
                    <th>Accounted exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((item) => (
                    <tr key={`${item.capabilityId}:${item.provider}:${item.model}`}>
                      <td>
                        {data.capabilities.find((capability) => capability.id === item.capabilityId)?.name ??
                          item.capabilityId}
                        <br />
                        {item.provider}
                        <br />
                        <strong>{item.model}</strong>
                        {item.sample === "INSUFFICIENT_SAMPLE" && <small>Small sample</small>}
                      </td>
                      <td>{item.operations}</td>
                      <td>{economicsUSD(item.knownCostNano)}</td>
                      <td>
                        {item.usefulOperations} · {percent(item.usefulOperationRate)}
                      </td>
                      <td>{economicsUSD(item.costPerUsefulOperationNano)}</td>
                      <td>{economicsUSD(item.exposureNano)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {view === "Quality & Outcomes" && (
        <section className={styles.card}>
          <h3>Does the spending produce useful results?</h3>
          <p>{data.definitions.cohort}</p>
          <p>
            {data.totals.regeneratedOperations} linked follow-up or regeneration operations ·{" "}
            {data.totals.retriedOperations} logical operations with multiple provider attempts. Each provider attempt's
            cost is retained.
          </p>
          <div className={styles.quality}>
            {data.capabilities.map((item) => (
              <article key={item.id}>
                <h4>{item.name}</h4>
                <strong>{percent(item.successRate)}</strong>
                <p>
                  {item.successfulOperations} successful operations / {item.requests - item.unknownOutcomes} with
                  recorded outcomes
                </p>
                <dl>
                  <div>
                    <dt>{item.successLabel}</dt>
                    <dd>{item.usefulResults}</dd>
                  </div>
                  <div>
                    <dt>Operations per useful result</dt>
                    <dd>{item.attemptsPerUsefulResult?.toFixed(2) ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Observed cost per useful result</dt>
                    <dd>{economicsUSD(item.costPerUsefulResultNano)}</dd>
                  </div>
                  <div>
                    <dt>Mean cost-settled operation</dt>
                    <dd>{economicsUSD(item.meanCostNano)}</dd>
                  </div>
                  <div>
                    <dt>Failure-related cost</dt>
                    <dd>{economicsUSD(item.failureCostNano)}</dd>
                  </div>
                </dl>
                <p>
                  {item.generated} generated · {item.previewed} previewed · {item.rejected} rejected · {item.applied}{" "}
                  applied · {item.undone} undone · {item.acceptedThenEdited} accepted then edited
                </p>
                <p>
                  {item.sample === "INSUFFICIENT_SAMPLE"
                    ? "Small sample: fewer than 10 operations. Avoid firm comparisons."
                    : "Observed sample; patterns alone do not establish a cause."}
                </p>
                <details>
                  <summary>Outcome definition and coverage</summary>
                  <p>{item.definition}</p>
                  <p>Cost coverage {percent(item.costCoverage)}; observed costs exclude unresolved amounts.</p>
                  <p>
                    {item.unknownOutcomes} outcomes unavailable. Recorded coverage {percent(item.outcomeCoverage)}.
                  </p>
                </details>
              </article>
            ))}
          </div>
          <h3>Investigation signals</h3>
          {data.people
            .filter((item) => item.investigation)
            .map((item) => (
              <article key={item.accountId} className={styles.signal}>
                <h4>{item.displayName}</h4>
                <p>
                  {item.reconstructions} reconstructions · {item.accepted} accepted operations ·{" "}
                  {percent(item.acceptanceRate)} recorded acceptance
                </p>
                <p>{item.investigation}</p>
                <button
                  onClick={() => {
                    setPerson(item.accountId);
                    setView("People & Allowances");
                  }}
                >
                  Inspect {item.displayName}
                </button>
              </article>
            ))}
          {!data.people.some((item) => item.investigation) && (
            <p>
              No low-acceptance signal in the available top-consumer sample. This does not establish product quality.
            </p>
          )}
        </section>
      )}
      {view === "People & Allowances" && (
        <section className={styles.card}>
          <h3>People, consumption & effective access</h3>
          <p>
            Top 25 people by accounted exposure. Open the canonical People dossier to inspect inherited rights,
            capability allowances, model access and audited overrides.
          </p>
          <label>
            Find a person in this consumer sample
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className={styles.table} tabIndex={0} role="region" aria-label="People AI consumption">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Operations</th>
                  <th>Observed cost</th>
                  <th>Reconstruction acceptance</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {data.people
                  .filter((item) =>
                    `${item.displayName} ${item.accountId}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((item) => (
                    <tr key={item.accountId}>
                      <td>
                        <strong>{item.displayName}</strong>
                        {item.investigation && <small>Quality investigation signal</small>}
                      </td>
                      <td>{item.operations}</td>
                      <td>{economicsUSD(item.knownCostNano)}</td>
                      <td>
                        {item.accepted} / {item.reconstructions} · {percent(item.acceptanceRate)}
                      </td>
                      <td>
                        <Link href={`/admin/people/${encodeURIComponent(item.accountId)}`}>
                          Manage {item.displayName} allowances
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {view === "Capabilities" && (
        <section className={styles.card}>
          <h3>Capability registry</h3>
          <p>Configuration version {data.registryVersion}. Capability and model identity remain separate.</p>
          <div className={styles.quality}>
            {data.capabilities.map((item) => (
              <article key={item.id}>
                <h4>{item.name}</h4>
                <p>{item.description}</p>
                <dl>
                  <div>
                    <dt>Owner</dt>
                    <dd>{item.owner}</dd>
                  </div>
                  <div>
                    <dt>Access</dt>
                    <dd>{item.access}</dd>
                  </div>
                  <div>
                    <dt>Useful outcome</dt>
                    <dd>{item.success ?? "Not classified"}</dd>
                  </div>
                  <div>
                    <dt>Current profile / provider</dt>
                    <dd>
                      {item.configuration.model ?? "No current execution profile"} · {item.configuration.provider}
                    </dd>
                  </div>
                  <div>
                    <dt>Permitted profiles</dt>
                    <dd>{item.configuration.permittedModels.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Current capability default</dt>
                    <dd>
                      {item.configuration.enabled ? "Enabled by policy" : "Disabled by policy"} ·{" "}
                      {item.configuration.defaultRequests} monthly operations
                    </dd>
                  </div>
                  <div>
                    <dt>Current provider configuration</dt>
                    <dd>
                      {item.configuration.providerConfigured
                        ? "Configured; model availability is verified at execution"
                        : "Provider unconfigured"}
                    </dd>
                  </div>
                  <div>
                    <dt>Configuration revision</dt>
                    <dd>{item.configuration.revision}; historical receipts retain their own snapshots</dd>
                  </div>
                </dl>
                <p>{item.outcomes.join(" · ") || "Historical outcome unavailable"}</p>
              </article>
            ))}
          </div>
          <p>
            Configure permitted profiles and allowance defaults through Policies, allowances & model configuration
            below.
          </p>
        </section>
      )}
      {view === "Operation History" && (
        <section className={styles.card}>
          <h3>Trace an operation</h3>
          <form
            className={styles.filters}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => setHistory(await read("history")));
            }}
          >
            <label>
              Person account ID
              <input value={person} onChange={(event) => setPerson(event.target.value)} />
            </label>
            <label>
              Operation outcome
              <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                <option value="">All outcomes</option>
                {Object.keys(initial.outcomes).map((name) => (
                  <option key={name} value={name}>
                    {label(name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search operation or request ID
              <input value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <button disabled={busy}>Search operation history</button>
          </form>
          <div className={styles.table} role="region" aria-label="AI operation records" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Started / capability</th>
                  <th>Person / model</th>
                  <th>Outcome</th>
                  <th>Cost / basis</th>
                  <th>Attempts</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.records.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {when(row.createdAt)}
                      <br />
                      {initial.capabilities.find((item) => item.id === row.capabilityId)?.name ?? row.capabilityId}
                    </td>
                    <td>
                      {row.accountId}
                      <br />
                      {row.model}
                    </td>
                    <td>{label(row.outcome)}</td>
                    <td>
                      {economicsUSD(row.settledCostNano)}
                      <br />
                      {label(row.costBasis)}
                    </td>
                    <td>{row._count.attempts}</td>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => setOperation((await read("operation", { id: row.id })).operation))
                        }
                      >
                        Inspect {row.requestId}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.records.length && <p>No operations match these filters.</p>}
          {history.nextCursor && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await read("history", { cursor: history.nextCursor! });
                  setHistory({ records: [...history.records, ...next.records], nextCursor: next.nextCursor });
                })
              }
            >
              Load more operations
            </button>
          )}
          {operation && (
            <section className={styles.inspector} aria-label="AI operation inspector" tabIndex={-1}>
              <header>
                <h3>{operation.requestId}</h3>
                <button onClick={() => setOperation(null)}>Close operation inspector</button>
              </header>
              <dl>
                {Object.entries({
                  Capability: operation.capabilityId,
                  Model: `${operation.provider} / ${operation.model}`,
                  Outcome: label(operation.outcome),
                  Accounting: label(operation.status),
                  "Cost basis": label(operation.costBasis),
                  "Observed cost": economicsUSD(operation.settledCostNano),
                  "Reserved exposure": economicsUSD(operation.exposureNano),
                  "Pricing revision": operation.pricingRevision,
                  "Policy revision": operation.policyRevision,
                  "Person policy revision": operation.userPolicyRevision ?? "Unavailable historically",
                  "Previous logical operation": operation.logicalParentId ?? "None recorded",
                  "Owner acceptance": operation.acceptedAt
                    ? when(operation.acceptedAt)
                    : "No authoritative room acceptance recorded",
                  "Canonical Apply": when(operation.appliedAt),
                  "Failure classification": operation.failureCode ?? "None recorded",
                  "Application version": operation.applicationVersion ?? "Unavailable historically",
                }).map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary>Applied policy and owner outcome receipt</summary>
                <p>Policy snapshot</p>
                <pre>{operation.policySnapshot ?? "Historical effective policy snapshot unavailable."}</pre>
                <p>Outcome receipt</p>
                <pre>{operation.outcomeEvidence ?? "No authoritative outcome receipt recorded."}</pre>
              </details>
              <h4>Provider attempts</h4>
              {operation.attempts.length ? (
                operation.attempts.map((attempt) => (
                  <article key={attempt.id}>
                    <strong>
                      Attempt {attempt.sequence} · {attempt.model}
                    </strong>
                    <p>
                      {label(attempt.status)} · {economicsUSD(attempt.costNano)} · {label(attempt.costBasis)}
                    </p>
                    <p>
                      Price {attempt.pricingRevision} · {when(attempt.startedAt)} ·{" "}
                      {attempt.failureCode ?? "No failure classification"}
                    </p>
                    <details>
                      <summary>Reported usage dimensions</summary>
                      <pre>{attempt.usage ?? "Usage not reported; cost remains unresolved."}</pre>
                    </details>
                  </article>
                ))
              ) : (
                <p>Provider-attempt history unavailable for this legacy record.</p>
              )}
              <p>Private photographs, prompts and generated scene content are excluded from this inspector.</p>
            </section>
          )}
        </section>
      )}
    </section>
  );
}
