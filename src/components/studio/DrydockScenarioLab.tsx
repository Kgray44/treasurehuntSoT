"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ScenarioSummary = {
  scenarioId: string;
  revision: number;
  sourceChecksum: string;
  title: string;
  purpose: string;
  tags: string[];
  createdAt: string;
};
type Scenario = Omit<ScenarioSummary, "scenarioId" | "createdAt"> & {
  id: string;
  seed: string;
  initialState: { variables: Record<string, boolean | number | string | string[]>; inventory: string[]; actorMode: "PLAYER" | "CAPTAIN" | "CREATOR" };
  environment: { virtualStart: string; locale: string; viewport: "DESKTOP" | "MOBILE" | "NARROW"; reducedMotion: boolean; soundEnabled: boolean; keyboardOnly: boolean };
  limits: { maxSteps: number; maxStates: number; maxTraceEntries: number; maxVirtualMilliseconds: number };
  inputs: unknown[];
  faults: unknown[];
  assertions: unknown[];
  schemaVersion: 1;
};
type Run = { summary: { runId: string; status: string; sourceChecksum: string; completedInputs: number }; result: { assertions?: Array<{ kind: string; passed: boolean }>; coverage?: { blockIds?: string[]; faultIds?: string[] }; traceDigest?: string }; trace: Array<{ ordinal: number; inputKind: string; status: string; intentTypes: string[]; faultIds: string[] }> };
type Suite = { suiteId: string; title: string; sourceChecksum: string; updatedAt: string; members: Array<{ scenarioId: string; revision: number }> };

const privateRequest = (csrfToken: string, init: RequestInit = {}) => ({
  ...init,
  credentials: "same-origin" as const,
  headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken, ...init.headers },
});

function freshScenario(sourceChecksum: string): Scenario {
  return {
    schemaVersion: 1,
    id: `scenario-${crypto.randomUUID()}`,
    revision: 1,
    sourceChecksum,
    title: "New deterministic sea trial",
    purpose: "Exercise one bounded authored path without changing a live Voyage.",
    seed: "sea-trial-seed",
    initialState: { variables: {}, inventory: [], actorMode: "CREATOR" },
    environment: { virtualStart: "2026-01-01T00:00:00.000Z", locale: "en-US", viewport: "DESKTOP", reducedMotion: false, soundEnabled: true, keyboardOnly: false },
    limits: { maxSteps: 100, maxStates: 100, maxTraceEntries: 200, maxVirtualMilliseconds: 86_400_000 },
    inputs: [{ kind: "CONTINUE" }],
    faults: [],
    assertions: [],
    tags: ["creator"],
  };
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function DrydockScenarioLab({ taleId, csrfToken }: { taleId: string; csrfToken: string }) {
  const [sourceChecksum, setSourceChecksum] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [suiteTitle, setSuiteTitle] = useState("Current Sea Trial suite");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [inputsText, setInputsText] = useState(formatJson([{ kind: "CONTINUE" }]));
  const [faultsText, setFaultsText] = useState("[]");
  const [assertionsText, setAssertionsText] = useState("[]");
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [response, suitesResponse] = await Promise.all([
        fetch(`/api/studio/tales/${taleId}/scenarios`, privateRequest(csrfToken)),
        fetch(`/api/studio/tales/${taleId}/scenarios/suites`, privateRequest(csrfToken)),
      ]);
      const body = (await response.json()) as { error?: string; sourceChecksum?: string; scenarios?: ScenarioSummary[] };
      const suitesBody = (await suitesResponse.json()) as { suites?: Suite[] };
      if (!response.ok || !body.sourceChecksum) throw new Error(body.error ?? "Sea Trial Scenarios could not be loaded.");
      const currentSourceChecksum = body.sourceChecksum;
      setSourceChecksum(currentSourceChecksum);
      setScenarios(body.scenarios ?? []);
      setSuites(suitesResponse.ok ? suitesBody.suites ?? [] : []);
      setScenario((current) => current ?? freshScenario(currentSourceChecksum));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sea Trial Scenarios could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [csrfToken, taleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const assertionStatus = useMemo(() => run?.result.assertions ?? [], [run]);

  async function selectScenario(summary: ScenarioSummary) {
    setError("");
    try {
      const response = await fetch(`/api/studio/tales/${taleId}/scenarios/${encodeURIComponent(summary.scenarioId)}`, privateRequest(csrfToken));
      const body = (await response.json()) as { error?: string; scenario?: Scenario };
      if (!response.ok || !body.scenario) throw new Error(body.error ?? "Scenario could not be loaded.");
      setScenario(body.scenario);
      setInputsText(formatJson(body.scenario.inputs));
      setFaultsText(formatJson(body.scenario.faults));
      setAssertionsText(formatJson(body.scenario.assertions));
      setRun(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario could not be loaded.");
    }
  }

  async function saveScenario() {
    if (!scenario || !sourceChecksum) return null;
    setBusy("save");
    setError("");
    try {
      const inputs = JSON.parse(inputsText) as unknown;
      const faults = JSON.parse(faultsText) as unknown;
      const assertions = JSON.parse(assertionsText) as unknown;
      if (!Array.isArray(inputs) || !Array.isArray(faults) || !Array.isArray(assertions)) throw new Error("Steps, faults, and assertions must each be a JSON array.");
      const existing = scenarios.find((candidate) => candidate.scenarioId === scenario.id);
      const next: Scenario = {
        ...scenario,
        revision: existing ? existing.revision + 1 : 1,
        sourceChecksum,
        inputs,
        faults,
        assertions,
        tags: scenario.tags.filter(Boolean),
      };
      const response = await fetch(
        `/api/studio/tales/${taleId}/scenarios`,
        privateRequest(csrfToken, { method: "POST", body: JSON.stringify(next) }),
      );
      const body = (await response.json()) as { error?: string; scenario?: ScenarioSummary };
      if (!response.ok || !body.scenario) throw new Error(body.error ?? "Scenario could not be saved.");
      setScenario(next);
      setScenarios((current) => [body.scenario!, ...current.filter((candidate) => candidate.scenarioId !== body.scenario!.scenarioId)]);
      return body.scenario;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario could not be saved.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function runScenario() {
    const saved = await saveScenario();
    if (!saved) return;
    setBusy("run");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/scenarios/${encodeURIComponent(saved.scenarioId)}/runs`,
        privateRequest(csrfToken, { method: "POST", body: JSON.stringify({ revision: saved.revision }) }),
      );
      const body = (await response.json()) as { error?: string; run?: Run };
      if (!response.ok || !body.run) throw new Error(body.error ?? "Scenario run could not be completed.");
      setRun(body.run);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario run could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function saveSuite() {
    if (!sourceChecksum || !scenarios.length) {
      setError("Save at least one current Scenario revision before creating a Suite.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/scenarios/suites`,
        privateRequest(csrfToken, {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: 1,
            id: `suite-${crypto.randomUUID()}`,
            title: suiteTitle,
            sourceChecksum,
            members: scenarios.map(({ scenarioId, revision }) => ({ scenarioId, revision })),
          }),
        }),
      );
      const body = (await response.json()) as { error?: string; suite?: Suite };
      if (!response.ok || !body.suite) throw new Error(body.error ?? "Suite could not be saved.");
      setSuites((current) => [body.suite!, ...current.filter((item) => item.suiteId !== body.suite!.suiteId)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Suite could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function runSuite(suite: Suite) {
    setBusy("run");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/scenarios/suites/${encodeURIComponent(suite.suiteId)}/runs`,
        privateRequest(csrfToken, { method: "POST", body: "{}" }),
      );
      const body = (await response.json()) as { error?: string; result?: { proofStatus: string; runs: Array<{ run: Run }> } };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Suite could not be run.");
      setRun(body.result.runs.at(-1)?.run ?? null);
      if (body.result.proofStatus !== "COMPLETE") setError("Suite completed with incomplete proof. Inspect its individual safe receipts.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Suite could not be run.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <section className="editor-single-panel"><p>Opening deterministic Sea Trials…</p></section>;
  if (!scenario) return <section className="editor-single-panel"><p role="alert">{error || "Sea Trials are unavailable."}</p></section>;

  return (
    <section className="editor-single-panel drydock-scenario-lab" aria-labelledby="sea-trials-heading">
      <header>
        <div>
          <p className="eyebrow">Project Drydock</p>
          <h2 id="sea-trials-heading">Sea Trials</h2>
          <p>Run deterministic, source-bound simulations. These records never change a live Voyage or provider state.</p>
        </div>
        <button onClick={() => setScenario(freshScenario(sourceChecksum))}>New Scenario</button>
      </header>
      {error && <p className="editor-error" role="alert">{error}</p>}
      <div className="drydock-scenario-layout">
        <aside aria-label="Saved Sea Trial Scenarios">
          <strong>Revision ledger</strong>
          <p className="drydock-checksum">Source {sourceChecksum.slice(0, 12)}…</p>
          <ul>
            {scenarios.map((item) => (
              <li key={item.scenarioId}>
                <button className={scenario.id === item.scenarioId ? "active" : ""} onClick={() => void selectScenario(item)}>
                  <span>{item.title}</span><small>r{item.revision}</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="drydock-scenario-editor">
          <div className="settings-grid">
            <label><span>Scenario title</span><input aria-label="Scenario title" value={scenario.title} onChange={(event) => setScenario({ ...scenario, title: event.target.value })} /></label>
            <label><span>Deterministic seed</span><input aria-label="Deterministic seed" value={scenario.seed} onChange={(event) => setScenario({ ...scenario, seed: event.target.value })} /></label>
            <label className="wide"><span>Purpose</span><textarea aria-label="Scenario purpose" value={scenario.purpose} onChange={(event) => setScenario({ ...scenario, purpose: event.target.value })} /></label>
            <label><span>Viewport</span><select aria-label="Simulation viewport" value={scenario.environment.viewport} onChange={(event) => setScenario({ ...scenario, environment: { ...scenario.environment, viewport: event.target.value as Scenario["environment"]["viewport"] } })}><option value="DESKTOP">Desktop</option><option value="MOBILE">Mobile</option><option value="NARROW">Narrow</option></select></label>
            <label><span>Actor mode</span><select aria-label="Simulation actor mode" value={scenario.initialState.actorMode} onChange={(event) => setScenario({ ...scenario, initialState: { ...scenario.initialState, actorMode: event.target.value as Scenario["initialState"]["actorMode"] } })}><option value="CREATOR">Creator</option><option value="CAPTAIN">Captain</option><option value="PLAYER">Player</option></select></label>
          </div>
          <div className="drydock-json-fields">
            <label><span>Outcome steps</span><textarea aria-label="Scenario outcome steps" value={inputsText} onChange={(event) => setInputsText(event.target.value)} /></label>
            <label><span>Catalogued faults</span><textarea aria-label="Scenario faults" value={faultsText} onChange={(event) => setFaultsText(event.target.value)} /></label>
            <label><span>Assertions</span><textarea aria-label="Scenario assertions" value={assertionsText} onChange={(event) => setAssertionsText(event.target.value)} /></label>
          </div>
          <div className="drydock-scenario-actions">
            <button onClick={() => void saveScenario()} disabled={busy !== ""}>{busy === "save" ? "Saving revision…" : "Save Scenario revision"}</button>
            <button className="brass-button" onClick={() => void runScenario()} disabled={busy !== ""}>{busy === "run" ? "Running bounded trial…" : "Save and run Sea Trial"}</button>
          </div>
          <section className="drydock-suite-panel" aria-label="Scenario Suite controls">
            <strong>Scenario Suites</strong>
            <p>Save the current revisions as an ordered, source-bound regression set.</p>
            <div>
              <input aria-label="Scenario Suite title" value={suiteTitle} onChange={(event) => setSuiteTitle(event.target.value)} />
              <button onClick={() => void saveSuite()} disabled={busy !== ""}>Save current revisions as Suite</button>
            </div>
            <ul>
              {suites.map((suite) => (
                <li key={suite.suiteId}>
                  <span>{suite.title} ({suite.members.length} revisions)</span>
                  <button onClick={() => void runSuite(suite)} disabled={busy !== ""}>Run Suite</button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      {run && (
        <section className="drydock-run-receipt" aria-label="Sea Trial receipt">
          <header><strong>{run.summary.status}</strong><span>Run {run.summary.runId}</span></header>
          <p>{run.summary.completedInputs} trace entries; source {run.summary.sourceChecksum.slice(0, 12)}…</p>
          <ul aria-label="Scenario assertions">{assertionStatus.map((assertion, index) => <li key={`${assertion.kind}-${index}`} data-passed={assertion.passed}>{assertion.kind}: {assertion.passed ? "passed" : "failed"}</li>)}</ul>
          <ol aria-label="Safe simulation trace">{run.trace.map((entry) => <li key={entry.ordinal}><strong>{entry.ordinal}. {entry.inputKind}</strong><span>{entry.status}</span><small>{[...entry.intentTypes, ...entry.faultIds].join(", ") || "No emitted event"}</small></li>)}</ol>
        </section>
      )}
    </section>
  );
}
