"use client";

import { useEffect, useState } from "react";
import type { getReachAdminOverview } from "@/reach/admin-service";
import type {
  previewReachRuntimePolicy,
  executeReachRuntimePolicy,
  ReachRuntimePolicyCommandInput,
} from "@/reach/admin-commands";
import { reachRuntimePolicySchema, type ReachRuntimePolicy } from "@/reach/runtime-policy";
import {
  projectReachHistogram,
  reachTimingUpperBoundsMs,
  reachRateUpperBoundsHz,
  reachErrorUpperBounds,
  reachConfidenceUpperBounds,
  reachCorrelationUpperBounds,
  reachUncertaintyUpperBoundsPx,
} from "@/reach/telemetry";
import { EvidenceStrip, Panel, Metric, EmptyState, StatusBadge } from "./AdminPrimitives";
import styles from "./ReachAdminConsole.module.css";

export type ReachAdminOverview = Awaited<ReturnType<typeof getReachAdminOverview>>;
type Preview = Awaited<ReturnType<typeof previewReachRuntimePolicy>>;
type Receipt = Awaited<ReturnType<typeof executeReachRuntimePolicy>>;
type Histogram = ReturnType<typeof projectReachHistogram>;
const date = (value: string) => new Date(value).toLocaleString();
const count = (value: number | null | undefined) => (value == null ? "Not collected" : value.toLocaleString());
const percent = (value: number | null) => (value === null ? "Not measured" : `${(value * 100).toFixed(1)}%`);
const duration = (ms: number) => `${(ms / 60000).toFixed(1)} min`;
const fields = [
  { key: "featureEnabled", label: "Enable Reach for all clients", kind: "boolean" },
  { key: "normalMaximumHz", label: "Normal tracking ceiling (Hz)", kind: "number", min: 5, max: 30 },
  { key: "calibrationMaximumHz", label: "Calibration collection ceiling (Hz)", kind: "number", min: 5, max: 60 },
  { key: "unfocusedMaximumHz", label: "Visible unfocused ceiling (Hz)", kind: "number", min: 1, max: 8 },
  { key: "modelMaximumHz", label: "Hand model inference ceiling (Hz)", kind: "number", min: 5, max: 60 },
  { key: "telemetryEnabled", label: "Enable automatic aggregate reports", kind: "boolean" },
  { key: "telemetryRetentionDays", label: "Maximum report retention (days)", kind: "number", min: 7, max: 90 },
  { key: "localRecorderEnabled", label: "Allow the gated local pose recorder", kind: "boolean" },
] as const;
const timingLabels: Record<string, string> = {
  modelPacketAgeMs: "Capture to model packet",
  modelResultMs: "Capture to worker model result",
  preprocessingMs: "Bitmap/image preparation",
  imageAnalysisMs: "Pure image analysis (not instrumented)",
  captureToImageMs: "Capture to image result",
  frameIntervalMs: "Capture interval",
  pauseMs: "Collection pause duration",
  recoveryMs: "Recovery duration",
  timerLatenessMs: "Timer lateness",
};
function binLabel(bin: Histogram["p95"], unit: string, scale = 1) {
  if (!bin) return "Not measured";
  const fmt = (value: number) => Number((value * scale).toFixed(3)).toLocaleString();
  if (bin.upperInclusive === null) return `>${fmt(bin.lowerExclusive!)} ${unit}`;
  return bin.lowerExclusive === null
    ? `≤${fmt(bin.upperInclusive)} ${unit}`
    : `>${fmt(bin.lowerExclusive)}–≤${fmt(bin.upperInclusive)} ${unit}`;
}
function Distribution({
  title,
  histogram,
  bounds,
  unit,
  scale = 1,
}: {
  title: string;
  histogram: Histogram | undefined;
  bounds: readonly number[];
  unit: string;
  scale?: number;
}) {
  if (!histogram)
    return <EmptyState title={`${title} unavailable`} detail="This reporting window has no complete aggregate." />;
  const maximum = Math.max(0, ...histogram.bins);
  return (
    <figure className={styles.distribution} aria-label={title}>
      <figcaption>
        <strong>{title}</strong>
        <small>
          {count(histogram.observed)} observed · {count(histogram.missing)} missing
        </small>
      </figcaption>
      <dl className={styles.quantiles}>
        {(["p50", "p95", "p99"] as const).map((key) => (
          <div key={key}>
            <dt>{key.toUpperCase()} bin</dt>
            <dd>{binLabel(histogram[key], unit, scale)}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>Distribution and denominators</summary>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Range</th>
                <th scope="col">Observations</th>
                <th scope="col">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {histogram.bins.map((value, index) => (
                <tr key={index}>
                  <th scope="row">
                    {binLabel(
                      {
                        lowerExclusive: index ? bounds[index - 1] : null,
                        upperInclusive: index === bounds.length ? null : bounds[index],
                        overflow: index === bounds.length,
                      },
                      unit,
                      scale,
                    )}
                  </th>
                  <td>{count(value)}</td>
                  <td>
                    <span className={styles.bar} style={{ width: maximum ? `${(100 * value) / maximum}%` : "0%" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
function PolicyDiff({ before, after }: { before: ReachRuntimePolicy; after: ReachRuntimePolicy }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption>Current and proposed Reach policy</caption>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">Current</th>
            <th scope="col">Proposed</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.key}>
              <th scope="row">{field.label}</th>
              <td>{String(before[field.key])}</td>
              <td>{String(after[field.key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ReachAdminConsole({
  initial,
  csrfToken,
  canManage,
}: {
  initial: ReachAdminOverview;
  csrfToken: string;
  canManage: boolean;
}) {
  const [overview, setOverview] = useState(initial),
    [tab, setTab] = useState("Overview"),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ReachRuntimePolicy | null>(initial.data?.envelope.policy ?? null);
  const [notice, setNotice] = useState(""),
    [failed, setFailed] = useState(false),
    [reason, setReason] = useState("");
  const [password, setPassword] = useState(""),
    [assuredUntil, setAssuredUntil] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null),
    [pending, setPending] = useState<ReachRuntimePolicyCommandInput | null>(null);
  const [confirmed, setConfirmed] = useState(false),
    [receipt, setReceipt] = useState<Receipt | null>(null);
  const [timing, setTiming] = useState("captureToImageMs");
  const data = overview.data,
    coverage = data?.reporting.coverage,
    completeCoverage = !!coverage && !coverage.truncated && coverage.returnedReports === coverage.totalReports,
    summary = data?.reporting.state === "AVAILABLE" && completeCoverage ? data.reporting.summary : null;
  const assured = assuredUntil !== null;
  useEffect(() => {
    if (!assuredUntil) return;
    const timeout = window.setTimeout(
      () => {
        setAssuredUntil(null);
        setPreview(null);
        setPending(null);
        setConfirmed(false);
      },
      Math.max(0, Date.parse(assuredUntil) - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [assuredUntil]);
  const validPolicy = draft ? reachRuntimePolicySchema.safeParse(draft).success : false;
  const validReason =
    reason.trim().length >= 8 &&
    reason.trim().length <= 240 &&
    !/password|token|secret|credential|cookie|private key|csrf/iu.test(reason);
  const invalidatePreview = () => {
    setPreview(null);
    setPending(null);
    setConfirmed(false);
  };
  async function request(url: string, body?: unknown) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
            body: JSON.stringify(body),
          }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result)
      throw new Error(result?.error ?? "Reach administration is unavailable. Try refreshing.");
    return result;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      await action();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The action could not finish.");
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const next = (await request("/api/admin/reach")) as ReachAdminOverview;
    if (!next.evidence || !next.state) throw new Error("The Reach overview response is invalid.");
    setOverview(next);
    setDraft(next.data?.envelope.policy ?? null);
    invalidatePreview();
  }
  function stage(policy: ReachRuntimePolicy) {
    setDraft({ ...policy });
    setReason("");
    invalidatePreview();
    setTab("Runtime policy");
    setNotice("Previous settings are staged. Add a reason and preview a new revision before applying.");
  }
  return (
    <div className={styles.console} data-reach-admin="canonical">
      <div className={styles.toolbar}>
        <StatusBadge state={overview.state} />
        <span>Observed {date(overview.evidence.observedAt)}</span>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await refresh();
              setNotice("Reach overview refreshed.");
            })
          }
        >
          Refresh Reach overview
        </button>
      </div>
      <nav className={styles.tabs} aria-label="Reach administration views">
        {["Overview", "Performance", "Calibration", "Runtime policy", "Privacy & history"].map((name) => (
          <button key={name} onClick={() => setTab(name)} aria-current={tab === name ? "page" : undefined}>
            {name}
          </button>
        ))}
      </nav>
      {notice && (
        <p className={styles.notice} role={failed ? "alert" : "status"}>
          {notice}
        </p>
      )}
      {!data ? (
        <EmptyState
          title="Reach administrative data unavailable"
          detail="No policy values or measurement totals are being assumed. Refresh when the administrative store is available."
        />
      ) : (
        <>
          {tab === "Overview" && (
            <>
              <div className={styles.metrics}>
                <Metric
                  label="Retained aggregate reports"
                  value={count(coverage!.totalReports)}
                  detail="Reporting windows, not sessions or people"
                />
                <Metric
                  label="Distinct people"
                  value="Not collected"
                  detail="Reports contain no account or device identifiers"
                />
                <Metric
                  label="Distinct sessions"
                  value="Not collected"
                  detail="Repeated report windows are not unique sessions"
                />
                <Metric
                  label="Runtime policy"
                  value={`Revision ${data.envelope.revision}`}
                  detail={
                    data.envelope.policy.featureEnabled
                      ? "Reach enabled; camera consent remains required"
                      : "Reach disabled for all clients"
                  }
                />
              </div>
              <Panel title="Report coverage" kicker={data.reporting.state}>
                <p>
                  {date(coverage!.from)} through {date(coverage!.to)}. The store counted {count(coverage!.totalReports)}{" "}
                  matching reports; {count(coverage!.returnedReports)} were aggregated across{" "}
                  {count(coverage!.pagesRead)} pages of at most {count(coverage!.pageSize)} reports in one consistent
                  snapshot.
                </p>
                <p>
                  Distinct people and sessions are not collected. Report counts must not be presented as user counts or
                  universal product coverage.
                </p>
                {!completeCoverage ? (
                  <p role="alert">
                    Report coverage is incomplete. Performance and calibration summaries are unavailable until the
                    complete retained reporting window can be aggregated.
                  </p>
                ) : data.reporting.state === "NO_REPORTS" ? (
                  <EmptyState
                    title="No aggregate reports in this window"
                    detail="Empty reporting does not establish zero errors, no activity or successful calibration."
                  />
                ) : (
                  <p>
                    {summary?.acceptedReports.toLocaleString()} reports were valid;{" "}
                    {summary?.invalidReports.toLocaleString()} were excluded. These are client-reported measurements,
                    not independently verified physical performance.
                  </p>
                )}
                {summary && !summary.policyRevisionCoverage.complete && (
                  <p>
                    Per-revision detail retains at most {count(summary.policyRevisionCoverage.bucketLimit)} revision
                    buckets; {count(summary.policyRevisionCoverage.untrackedRevisionReports)} reports fall outside those
                    buckets. Overall numeric totals and distributions still include every valid report.
                  </p>
                )}
                <p>
                  Aggregate collection is {data.reporting.collectionEnabled ? "enabled automatically" : "disabled"}.
                  Current retention is at most {data.envelope.policy.telemetryRetentionDays} days.
                </p>
              </Panel>
              {summary && (
                <Panel title="Detection and activity">
                  <div className={styles.metrics}>
                    <Metric
                      label="Model packets"
                      value={count(summary.totals.model.packets)}
                      detail="Includes accepted, late and invalid reported packets"
                    />
                    <Metric
                      label="Accepted packets"
                      value={percent(summary.fractions.acceptedModelPackets.fraction)}
                      detail={`${count(summary.fractions.acceptedModelPackets.numerator)} / ${count(summary.fractions.acceptedModelPackets.denominator)} packets`}
                    />
                    <Metric
                      label="Late packets"
                      value={percent(summary.fractions.lateModelPackets.fraction)}
                      detail={`${count(summary.fractions.lateModelPackets.numerator)} / ${count(summary.fractions.lateModelPackets.denominator)} packets`}
                    />
                    <Metric
                      label="Reported active time"
                      value={duration(summary.totals.activity.activeMs)}
                      detail={`${duration(summary.totals.activity.droppedActivityMs)} dropped activity time`}
                    />
                  </div>
                  <p>{summary.denominators}</p>
                  <div className={styles.columns}>
                    {(
                      [
                        ["Model observations", summary.totals.model],
                        ["Activity milliseconds", summary.totals.activity],
                        ["Readiness observations", summary.totals.readiness],
                        ["Image state observations", summary.totals.image],
                        ["Lifecycle events", summary.totals.events],
                      ] as const
                    ).map(([title, values]) => (
                      <div key={title}>
                        <h3>{title}</h3>
                        <dl className={styles.details}>
                          {Object.entries(values).map(([key, value]) => (
                            <div key={key}>
                              <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                              <dd>{count(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                  <p>
                    Dropped events: {count(summary.totals.droppedEvents)}. Model-path experiments and physical
                    qualification are not included.
                  </p>
                </Panel>
              )}
            </>
          )}
          {tab === "Performance" && (
            <Panel title="Performance distributions" kicker="Pooled fixed bins; no average of percentiles">
              {!summary ? (
                <EmptyState
                  title="Performance summary unavailable"
                  detail={
                    completeCoverage ? "No measurements were returned." : "Complete report coverage is unavailable."
                  }
                />
              ) : (
                <>
                  <label className={styles.select}>
                    Timing measure
                    <select value={timing} onChange={(event) => setTiming(event.target.value)}>
                      {Object.entries(timingLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Distribution
                    title={timingLabels[timing]}
                    histogram={summary.timings[timing]}
                    bounds={reachTimingUpperBoundsMs}
                    unit="ms"
                  />
                  <div className={styles.columns}>
                    <Distribution
                      title="Normal achieved rate"
                      histogram={summary.rates.normalAchievedHz}
                      bounds={reachRateUpperBoundsHz}
                      unit="Hz"
                    />
                    <Distribution
                      title="Calibration achieved rate"
                      histogram={summary.rates.calibrationAchievedHz}
                      bounds={reachRateUpperBoundsHz}
                      unit="Hz"
                    />
                    <Distribution
                      title="Normal time under each configured ceiling"
                      histogram={summary.rates.normalCapTimeMs}
                      bounds={reachRateUpperBoundsHz}
                      unit="Hz"
                    />
                    <Distribution
                      title="Calibration time under each configured ceiling"
                      histogram={summary.rates.calibrationCapTimeMs}
                      bounds={reachRateUpperBoundsHz}
                      unit="Hz"
                    />
                  </div>
                  <div className={styles.columns}>
                    <Distribution
                      title="Image match correlation"
                      histogram={summary.imageQuality.correlation}
                      bounds={reachCorrelationUpperBounds}
                      unit="correlation"
                    />
                    <Distribution
                      title="Image match separation"
                      histogram={summary.imageQuality.separation}
                      bounds={reachErrorUpperBounds}
                      unit="separation"
                    />
                    <Distribution
                      title="Image uncertainty radius"
                      histogram={summary.imageQuality.uncertaintyPx}
                      bounds={reachUncertaintyUpperBoundsPx}
                      unit="pixels"
                    />
                    <Distribution
                      title="Model handedness classification score"
                      histogram={summary.confidence.handedness}
                      bounds={reachConfidenceUpperBounds}
                      unit="score"
                    />
                  </div>
                  <p>
                    {summary.confidence.handedness.interpretation} Reported average:{" "}
                    {percent(summary.confidence.handedness.average)}. Numeric posture score: unavailable.
                  </p>
                  <p>
                    Achieved rates count reported measurements; configured-ceiling distributions are weighted by
                    milliseconds. Ceilings are not promised frame rates. Capture timing excludes sensor exposure and
                    display scanout.
                  </p>
                  <p>
                    Capture-to-worker timing includes acquisition, transport and scheduler waits; it is not pure model
                    compute time. Bitmap/image preparation is measured together. Pure image-analysis time is not
                    separately instrumented. The pacer’s main-thread work budget does not measure whole-system CPU use.
                  </p>
                </>
              )}
            </Panel>
          )}
          {tab === "Calibration" && (
            <Panel title="Calibration and independent checks" kicker="Absolute and relative stay separate">
              <p>
                The raw held-out 95th-percentile error limit remains 3% of the pointing-area diagonal. Relative checks
                measure cursor control; monocular landmarks do not establish metric depth or physical pointing accuracy.
              </p>
              {!summary ? (
                <EmptyState
                  title="Calibration summary unavailable"
                  detail="No complete report aggregate is available for this window."
                />
              ) : (
                <div className={styles.columns}>
                  {(["ABSOLUTE", "RELATIVE"] as const).map((mode) => {
                    const calibration = summary.calibration[mode];
                    return (
                      <section
                        key={mode}
                        aria-label={`${mode === "ABSOLUTE" ? "Absolute" : "Relative"} calibration outcomes`}
                      >
                        <h3>{mode === "ABSOLUTE" ? "Absolute pointing" : "Relative movement"}</h3>
                        <dl className={styles.details}>
                          {Object.entries(calibration.outcomes).map(([key, value]) => (
                            <div key={key}>
                              <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                              <dd>{count(value)}</dd>
                            </div>
                          ))}
                        </dl>
                        <Distribution
                          title={`${mode} pooled raw held-out errors`}
                          histogram={calibration.pooledRawValidationErrors}
                          bounds={reachErrorUpperBounds}
                          unit="% diagonal"
                          scale={100}
                        />
                        <Distribution
                          title={`${mode} per-check raw P95 distribution`}
                          histogram={calibration.perCheckRawP95Distribution}
                          bounds={reachErrorUpperBounds}
                          unit="% diagonal"
                          scale={100}
                        />
                        <Distribution
                          title={`${mode} held-out jitter`}
                          histogram={calibration.pooledValidationJitter}
                          bounds={reachErrorUpperBounds}
                          unit="% diagonal"
                          scale={100}
                        />
                        <Distribution
                          title={`${mode} per-check jitter P95 distribution`}
                          histogram={calibration.perCheckJitterP95Distribution}
                          bounds={reachErrorUpperBounds}
                          unit="% diagonal"
                          scale={100}
                        />
                        <Distribution
                          title={`${mode} per-check median distribution`}
                          histogram={calibration.perCheckMedianDistribution}
                          bounds={reachErrorUpperBounds}
                          unit="% diagonal"
                          scale={100}
                        />
                        <Distribution
                          title={`${mode} training residuals`}
                          histogram={calibration.pooledTrainingResiduals}
                          bounds={reachErrorUpperBounds}
                          unit="% diagonal"
                          scale={100}
                        />
                      </section>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
          {tab === "Runtime policy" && (
            <>
              <Panel title="Mandatory runtime policy" kicker={`Current revision ${data.envelope.revision}`}>
                <p>
                  Defaults are 15 Hz normal, 60 Hz active calibration, 8 Hz visible unfocused and 60 Hz hand model
                  inference. Administrative ceilings apply to every client; workload may reduce them. The effective
                  capture/inference ceiling is the lower of the phase ceiling and the hand-model ceiling. Paused
                  calibration uses the normal ceiling. Changes are fetched every 15 seconds; clients stop using policy
                  after 30 seconds without a valid refresh.
                </p>
                <p>
                  Camera permission and Stop remain under the user’s control. Numeric aggregate reporting is automatic
                  while the global reporting switch is enabled; it does not upload camera content. Enabling the local
                  recorder still requires the local environment flag, loopback host and a deliberate recording action.
                </p>
                {!canManage ? (
                  <p>Observe only. CONFIG_OPERATE authority is required to preview or change policy.</p>
                ) : (
                  draft && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!assured || !validReason || !validPolicy) return;
                        void run(async () => {
                          const input: ReachRuntimePolicyCommandInput = {
                            expectedRevision: data.envelope.revision,
                            policy: reachRuntimePolicySchema.parse(draft),
                            reason: reason.trim(),
                            idempotencyKey: `reach_policy_${crypto.randomUUID().replaceAll("-", "")}`,
                          };
                          const result = await request("/api/admin/commands/reach-runtime-policy/preview", input);
                          setPending(input);
                          setPreview(result.preview);
                          setConfirmed(false);
                          setNotice("Review the exact proposed policy and consequences before confirming.");
                        });
                      }}
                    >
                      <fieldset disabled={busy}>
                        <legend>Proposed settings</legend>
                        <div className={styles.fields}>
                          {fields.map((field) => (
                            <label key={field.key}>
                              {field.kind === "boolean" ? (
                                <>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(draft[field.key])}
                                    onChange={(event) => {
                                      setDraft({ ...draft, [field.key]: event.target.checked });
                                      invalidatePreview();
                                    }}
                                  />
                                  {field.label}
                                </>
                              ) : (
                                <>
                                  {field.label}
                                  <input
                                    type="number"
                                    min={field.min}
                                    max={field.max}
                                    step={1}
                                    value={Number(draft[field.key])}
                                    onChange={(event) => {
                                      setDraft({ ...draft, [field.key]: Number(event.target.value) });
                                      invalidatePreview();
                                    }}
                                  />
                                </>
                              )}
                            </label>
                          ))}
                        </div>
                        <p>
                          Calibration must be at least the normal ceiling. Unfocused tracking cannot exceed normal.
                          Retention reductions can delete older reports when the new policy is applied.
                        </p>
                        <label>
                          Reason for policy change
                          <textarea
                            minLength={8}
                            maxLength={240}
                            value={reason}
                            onChange={(event) => {
                              setReason(event.target.value);
                              invalidatePreview();
                            }}
                          />
                        </label>
                        <small>8–240 characters. Do not include passwords, tokens or other sensitive values.</small>
                        {!validPolicy && (
                          <p role="alert">The proposed ceilings or retention fall outside the allowed policy ranges.</p>
                        )}
                      </fieldset>
                      <fieldset disabled={busy}>
                        <legend>Privileged assurance</legend>
                        <label>
                          Current password
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={!password}
                          onClick={() =>
                            void run(async () => {
                              const supplied = password;
                              setPassword("");
                              const result = await request("/api/admin/assurance", { password: supplied });
                              const expiresAt = result.assurance?.expiresAt;
                              if (typeof expiresAt !== "string" || !(Date.parse(expiresAt) > Date.now()))
                                throw new Error("Privileged assurance was not confirmed.");
                              setAssuredUntil(expiresAt);
                              setNotice("Recent privileged assurance is active. Preview the proposed policy.");
                            })
                          }
                        >
                          Verify identity
                        </button>
                        {assured && (
                          <p>Assurance expires {date(assuredUntil!)}. The server rechecks it for each command.</p>
                        )}
                      </fieldset>
                      <button type="submit" disabled={busy || !assured || !validPolicy || !validReason}>
                        Preview Reach policy
                      </button>
                    </form>
                  )
                )}
              </Panel>
              {preview && pending && (
                <Panel
                  title="Review Reach policy change"
                  kicker={`Revision ${preview.currentState.revision} → ${preview.resultingState.revision}`}
                >
                  <PolicyDiff before={preview.currentState.policy} after={preview.resultingState.policy} />
                  <ul>
                    {preview.consequences.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <ul>
                    {preview.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    Reason: {pending.reason}. Preview expires {date(preview.expiresAt)}.
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    I reviewed the policy and its effect on all Reach clients.
                  </label>
                  <button
                    disabled={busy || !confirmed || !assured}
                    onClick={() =>
                      void run(async () => {
                        const result = await request("/api/admin/commands/reach-runtime-policy/execute", {
                          input: pending,
                          previewId: preview.previewId,
                          confirmed: true,
                        });
                        const saved = result.receipt as Receipt;
                        if (!saved?.envelope || !saved.correlationId)
                          throw new Error("The change receipt is unavailable. Refresh before retrying.");
                        setReceipt(saved);
                        setOverview({ ...overview, data: { ...data, envelope: saved.envelope } });
                        setDraft(saved.envelope.policy);
                        invalidatePreview();
                        setNotice(`Reach policy revision ${saved.envelope.revision} was recorded.`);
                        try {
                          await refresh();
                        } catch {
                          setNotice(
                            `Reach policy revision ${saved.envelope.revision} was recorded; the reporting refresh is unavailable.`,
                          );
                        }
                      })
                    }
                  >
                    Confirm and apply Reach policy
                  </button>
                </Panel>
              )}
              {receipt && (
                <p role="status" className={styles.notice}>
                  Policy revision {receipt.envelope.revision} recorded. Receipt {receipt.correlationId}
                  {receipt.idempotent ? " · idempotent replay" : ""}. A revert requires a new reason, preview and
                  confirmation.
                </p>
              )}
              <Panel title="Immutable safeguards">
                <ul>
                  <li>150 ms observation freshness and source/context binding.</li>
                  <li>Independent raw 3% held-out validation, at least 15 samples and 600 ms per target.</li>
                  <li>One inference in flight, no queued frames and a 30% measured main-thread duty limit.</li>
                  <li>Camera consent, hidden-page camera shutdown and source-bound calibration.</li>
                  <li>No policy control can change model weights, posture geometry or accuracy gates.</li>
                </ul>
              </Panel>
            </>
          )}
          {tab === "Privacy & history" && (
            <>
              <Panel title="Privacy and measurement limits">
                <p>
                  Automatic reports contain bounded aggregate counters and fixed-bin distributions from live Reach
                  activity while global reporting is enabled. They exclude video, images, audio, landmarks, coordinates,
                  camera/track/session identifiers, coefficients and raw event sequences. Reports contain no account,
                  camera, track or session identifiers. Distinct people and sessions cannot be counted from these
                  reports.
                </p>
                <p>
                  All retained matching reports are streamed into complete numeric summaries without sampling. If
                  complete aggregation fails, reporting is unavailable rather than partial. Client reports can be
                  incomplete or inaccurate. Missing measurements, dropped activity and failed checks remain explicit. No
                  physical qualification or 99% reliability claim follows from these reports.
                </p>
                <p>
                  The standard laboratory does not record video. The separate gated local recorder requires explicit
                  Start and manual downloads; its video includes the visible background. Recording stays local and is
                  never part of aggregate reporting.
                </p>
                <p>
                  Retention is at most {data.envelope.policy.telemetryRetentionDays} days. Turning off collection blocks
                  new submissions; existing reports expire under retention. Lower retention can purge older records.
                </p>
              </Panel>
              <Panel title="Policy history" kicker="Revisioned Reach receipts and canonical Admiralty audit">
                {!data.history.length ? (
                  <EmptyState
                    title="No governed Reach changes recorded"
                    detail="The current revision may still be the default policy."
                  />
                ) : (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Recorded</th>
                          <th scope="col">Revision</th>
                          <th scope="col">Reason and changes</th>
                          <th scope="col">Governed action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.map((entry) => (
                          <tr key={entry.id}>
                            <td>{date(entry.createdAt)}</td>
                            <td>
                              {entry.expectedRevision} → {entry.resultingRevision}
                            </td>
                            <td>
                              <p>{entry.reason}</p>
                              <ul>
                                {fields
                                  .filter(
                                    (field) =>
                                      entry.beforeState.policy[field.key] !== entry.afterState.policy[field.key],
                                  )
                                  .map((field) => (
                                    <li key={field.key}>
                                      {field.label}: {String(entry.beforeState.policy[field.key])} →{" "}
                                      {String(entry.afterState.policy[field.key])}
                                    </li>
                                  ))}
                              </ul>
                            </td>
                            <td>
                              {canManage ? (
                                <button onClick={() => stage(entry.beforeState.policy)}>Stage previous policy</button>
                              ) : (
                                "Observe only"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p>
                  Showing the latest {data.history.length} retained changes (at most 30); this is not an unlimited audit
                  export.
                </p>
              </Panel>
            </>
          )}
        </>
      )}
      <EvidenceStrip evidence={overview.evidence} />
    </div>
  );
}
