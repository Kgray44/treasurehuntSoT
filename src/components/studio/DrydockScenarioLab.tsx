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
  initialState: {
    startBlockId?: string;
    variables: Record<string, boolean | number | string | string[]>;
    inventory: string[];
    actorMode: "PLAYER" | "CAPTAIN" | "CREATOR";
  };
  environment: {
    virtualStart: string;
    locale: string;
    viewport: "DESKTOP" | "MOBILE" | "NARROW";
    reducedMotion: boolean;
    soundEnabled: boolean;
    keyboardOnly: boolean;
  };
  limits: { maxSteps: number; maxStates: number; maxTraceEntries: number; maxVirtualMilliseconds: number };
  inputs: unknown[];
  faults: unknown[];
  assertions: unknown[];
  schemaVersion: 1;
};
type Run = {
  summary: {
    runId: string;
    status: string;
    sourceChecksum: string;
    completedInputs: number;
    cancellationRequested?: boolean;
  };
  result: {
    runtimeAdapterVersion?: string;
    assertions?: Array<{ kind: string; passed: boolean }>;
    coverage?: { blockIds?: string[]; edgeIds?: string[]; faultIds?: string[] };
    traceDigest?: string;
  };
  trace: Array<{
    ordinal: number;
    blockId?: string | null;
    inputKind: string;
    status: string;
    intentTypes: string[];
    faultIds: string[];
    stateDigest?: string;
  }>;
};
type Suite = {
  suiteId: string;
  title: string;
  sourceChecksum: string;
  updatedAt: string;
  members: Array<{ scenarioId: string; revision: number }>;
};
type RunSummary = Run["summary"];
type StateDiff = {
  changed: string[];
  from: { ordinal: number; blockId: string | null; status: string; stateDigest: string };
  to: { ordinal: number; blockId: string | null; status: string; stateDigest: string };
};
type Comparison = {
  compatible: boolean;
  source: { same: boolean };
  adapter: { same: boolean };
  trace: { firstDivergence: { ordinal: number; kind: string } | null };
  result: { same: boolean };
};
type CoverageView = {
  uncoveredBlockIds: string[];
  uncoveredEdgeIds: string[];
  uncoveredEndingBlockIds: string[];
  coveredStateDigests: string[];
  coveredProviderOutcomes: string[];
  coveredEnvironmentModes: string[];
  proofStatus: string;
};
type Suggestion = { id: string; kind: string; target: string; safeHint: string };
type RequiredScenarioClass = { id: string; capability: string; reason: string };

const scenarioClassLabels: Record<string, string> = {
  BASELINE_SUCCESS: "Baseline successful path",
  REQUIRED_ENDING: "Every required ending",
  MAJOR_BRANCH: "Major authored alternatives",
  TIMER_TIMEOUT: "Timer or wait outcome",
  CAPTAIN_APPROVE_REJECT: "Captain approval outcomes",
  ANSWER_MATCH_AND_NO_MATCH: "Answer match and no-match outcomes",
  PROVIDER_OUTCOMES: "Provider outcomes",
  REDUCED_MOTION_AND_SOUND_BLOCKED: "Reduced-motion and sound-blocked presentation",
};

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
    environment: {
      virtualStart: "2026-01-01T00:00:00.000Z",
      locale: "en-US",
      viewport: "DESKTOP",
      reducedMotion: false,
      soundEnabled: true,
      keyboardOnly: false,
    },
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

function passageHref(taleId: string, blockId: string) {
  return `/studio/tales/${encodeURIComponent(taleId)}#block-${encodeURIComponent(blockId)}`;
}

export function DrydockScenarioLab({ taleId, csrfToken }: { taleId: string; csrfToken: string }) {
  const [sourceChecksum, setSourceChecksum] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [suiteTitle, setSuiteTitle] = useState("Current Sea Trial suite");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [inputsText, setInputsText] = useState(formatJson([{ kind: "CONTINUE" }]));
  const [faultsText, setFaultsText] = useState("[]");
  const [assertionsText, setAssertionsText] = useState("[]");
  const [run, setRun] = useState<Run | null>(null);
  const [compareRunId, setCompareRunId] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [stateDiff, setStateDiff] = useState<StateDiff | null>(null);
  const [coverage, setCoverage] = useState<CoverageView | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [requiredScenarioClasses, setRequiredScenarioClasses] = useState<RequiredScenarioClass[]>([]);
  const [filter, setFilter] = useState("");
  const [cancellationRequestedRunId, setCancellationRequestedRunId] = useState("");
  const [choiceTargetBlockId, setChoiceTargetBlockId] = useState("");
  const [timerMilliseconds, setTimerMilliseconds] = useState("1000");
  const [faultIdentity, setFaultIdentity] = useState("NETWORK:OFFLINE");
  const [faultBeforeInput, setFaultBeforeInput] = useState("0");
  const [inventoryArtifactId, setInventoryArtifactId] = useState("");
  const [variableName, setVariableName] = useState("");
  const [variableValue, setVariableValue] = useState("");
  const [assertionKind, setAssertionKind] = useState("RUN_COMPLETES");
  const [assertionTarget, setAssertionTarget] = useState("");
  const [assertionValue, setAssertionValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [response, suitesResponse, runsResponse] = await Promise.all([
        fetch(`/api/studio/tales/${taleId}/scenarios`, privateRequest(csrfToken)),
        fetch(`/api/studio/tales/${taleId}/scenarios/suites`, privateRequest(csrfToken)),
        fetch(`/api/studio/tales/${taleId}/simulation-runs`, privateRequest(csrfToken)),
      ]);
      const body = (await response.json()) as {
        error?: string;
        sourceChecksum?: string;
        scenarios?: ScenarioSummary[];
        requiredScenarioClasses?: RequiredScenarioClass[];
      };
      const suitesBody = (await suitesResponse.json()) as { suites?: Suite[] };
      if (!response.ok || !body.sourceChecksum)
        throw new Error(body.error ?? "Sea Trial Scenarios could not be loaded.");
      const currentSourceChecksum = body.sourceChecksum;
      setSourceChecksum(currentSourceChecksum);
      setRequiredScenarioClasses(body.requiredScenarioClasses ?? []);
      setScenarios(body.scenarios ?? []);
      setSuites(suitesResponse.ok ? (suitesBody.suites ?? []) : []);
      if (runsResponse.ok) setRuns(((await runsResponse.json()) as { runs?: RunSummary[] }).runs ?? []);
      setScenario((current) => current ?? freshScenario(currentSourceChecksum));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sea Trial Scenarios could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [csrfToken, taleId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const assertionStatus = useMemo(() => run?.result.assertions ?? [], [run]);
  const visibleScenarios = useMemo(
    () =>
      scenarios.filter((candidate) =>
        `${candidate.title} ${candidate.purpose} ${candidate.tags.join(" ")}`
          .toLocaleLowerCase()
          .includes(filter.toLocaleLowerCase()),
      ),
    [filter, scenarios],
  );
  const coveredPassages = useMemo(() => [...new Set(run?.result.coverage?.blockIds?.filter(Boolean) ?? [])], [run]);

  function addJsonEntry(kind: "inputs" | "faults" | "assertions", value: unknown) {
    const setters = { inputs: setInputsText, faults: setFaultsText, assertions: setAssertionsText };
    const current = { inputs: inputsText, faults: faultsText, assertions: assertionsText }[kind];
    try {
      const parsed = JSON.parse(current) as unknown;
      if (!Array.isArray(parsed)) throw new Error("The advanced editor must contain a JSON array.");
      setters[kind](formatJson([...parsed, value]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The advanced editor is not a JSON array.");
    }
  }

  function setRequiredScenarioClass(required: RequiredScenarioClass, selected: boolean) {
    if (!scenario) return;
    const tag = `required:${required.id}`;
    setScenario({
      ...scenario,
      tags: selected ? [...new Set([...scenario.tags, tag])] : scenario.tags.filter((candidate) => candidate !== tag),
    });
  }

  function addInventoryArtifact() {
    if (!scenario || !inventoryArtifactId.trim()) return;
    const artifactId = inventoryArtifactId.trim();
    setScenario({
      ...scenario,
      initialState: {
        ...scenario.initialState,
        inventory: [...new Set([...scenario.initialState.inventory, artifactId])],
      },
    });
    setInventoryArtifactId("");
  }

  function addInitialVariable() {
    if (!scenario || !variableName.trim()) return;
    const trimmedValue = variableValue.trim();
    const parsedValue: boolean | number | string =
      trimmedValue === "true"
        ? true
        : trimmedValue === "false"
          ? false
          : trimmedValue !== "" && Number.isFinite(Number(trimmedValue))
            ? Number(trimmedValue)
            : variableValue;
    setScenario({
      ...scenario,
      initialState: {
        ...scenario.initialState,
        variables: { ...scenario.initialState.variables, [variableName.trim()]: parsedValue },
      },
    });
    setVariableName("");
    setVariableValue("");
  }

  function addCataloguedFault() {
    const [family, code] = faultIdentity.split(":");
    const beforeInput = Number(faultBeforeInput);
    if (!family || !code || !Number.isSafeInteger(beforeInput) || beforeInput < 0) {
      setError("Choose a catalogued fault and a non-negative input position.");
      return;
    }
    addJsonEntry("faults", {
      id: `${family.toLowerCase()}-${code.toLowerCase()}-${crypto.randomUUID()}`,
      family,
      code,
      beforeInput,
    });
  }

  function addStructuredAssertion() {
    const target = assertionTarget.trim();
    const assertion = (() => {
      switch (assertionKind) {
        case "CURRENT_BLOCK":
        case "CURRENT_BLOCK_IS":
        case "COVERED_BLOCK":
          return { kind: assertionKind, blockId: target };
        case "CURRENT_CHAPTER_IS":
          return { kind: assertionKind, chapterId: target };
        case "STATUS":
        case "FINAL_OUTCOME_IS":
          return { kind: assertionKind, status: target || "COMPLETED" };
        case "VARIABLE_EQUALS":
          return {
            kind: assertionKind,
            variable: target,
            expected:
              assertionValue === "true"
                ? true
                : assertionValue === "false"
                  ? false
                  : assertionValue !== "" && Number.isFinite(Number(assertionValue))
                    ? Number(assertionValue)
                    : assertionValue,
          };
        case "VARIABLE_NOT_EXPOSED":
          return { kind: assertionKind, variable: target };
        case "INVENTORY_CONTAINS":
        case "INVENTORY_DOES_NOT_CONTAIN":
        case "ARTIFACT_GRANTED":
        case "ARTIFACT_NOT_DUPLICATED":
          return { kind: assertionKind, artifactId: target };
        case "REVEAL_EXISTS":
          return { kind: assertionKind, revealId: target };
        case "EVENT_COUNT":
        case "SIDE_EFFECT_COUNT":
        case "EVENT_INTENT_COUNT":
          return {
            kind: assertionKind,
            eventType: target,
            count: Number.isSafeInteger(Number(assertionValue)) ? Number(assertionValue) : 0,
          };
        case "EVENT_INTENT_ORDER":
          return {
            kind: assertionKind,
            eventTypes: target
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          };
        case "EVENT_INTENT_TYPE":
          return { kind: assertionKind, eventType: target };
        case "ERROR_CLASS_IS":
          return { kind: assertionKind, code: target };
        case "PROVIDER_OUTCOME":
        case "PRESENTATION_OUTCOME":
          return {
            kind: assertionKind,
            outcome: target || (assertionKind === "PROVIDER_OUTCOME" ? "MATCH" : "PRESENTED"),
          };
        case "PLAYER_SAFE_FIELD_PRESENT":
        case "PROTECTED_FIELD_ABSENT":
          return { kind: assertionKind, field: target || "stateDigest" };
        case "COVERAGE_THRESHOLD":
          return {
            kind: assertionKind,
            domain: target || "BLOCKS",
            minimum: Number.isSafeInteger(Number(assertionValue)) ? Number(assertionValue) : 0,
          };
        case "TRACE_STEP_LIMIT":
          return {
            kind: assertionKind,
            maximum: Number.isSafeInteger(Number(assertionValue)) ? Number(assertionValue) : 0,
          };
        default:
          return { kind: assertionKind };
      }
    })();
    addJsonEntry("assertions", assertion);
    setAssertionTarget("");
    setAssertionValue("");
  }

  async function selectScenario(summary: ScenarioSummary) {
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/scenarios/${encodeURIComponent(summary.scenarioId)}`,
        privateRequest(csrfToken),
      );
      const body = (await response.json()) as { error?: string; scenario?: Scenario };
      if (!response.ok || !body.scenario) throw new Error(body.error ?? "Scenario could not be loaded.");
      setScenario(body.scenario);
      setInputsText(formatJson(body.scenario.inputs));
      setFaultsText(formatJson(body.scenario.faults));
      setAssertionsText(formatJson(body.scenario.assertions));
      setRun(null);
      setStateDiff(null);
      setComparison(null);
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
      if (!Array.isArray(inputs) || !Array.isArray(faults) || !Array.isArray(assertions))
        throw new Error("Steps, faults, and assertions must each be a JSON array.");
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
      setScenarios((current) => [
        body.scenario!,
        ...current.filter((candidate) => candidate.scenarioId !== body.scenario!.scenarioId),
      ]);
      return body.scenario;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario could not be saved.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function duplicateScenario() {
    if (!scenario || !scenarios.some((item) => item.scenarioId === scenario.id)) return;
    setBusy("save");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/scenarios/${encodeURIComponent(scenario.id)}?revision=${scenario.revision}`,
        privateRequest(csrfToken, { method: "POST" }),
      );
      const body = (await response.json()) as { error?: string; scenario?: ScenarioSummary };
      if (!response.ok || !body.scenario) throw new Error(body.error ?? "Scenario could not be duplicated.");
      setScenarios((current) => [body.scenario!, ...current]);
      setScenario({
        ...scenario,
        id: body.scenario.scenarioId,
        revision: body.scenario.revision,
        title: body.scenario.title,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario could not be duplicated.");
    } finally {
      setBusy("");
    }
  }

  async function archiveScenario() {
    if (!scenario || !scenarios.some((item) => item.scenarioId === scenario.id)) return;
    setBusy("save");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/scenarios/${encodeURIComponent(scenario.id)}`,
        privateRequest(csrfToken, { method: "DELETE" }),
      );
      const body = (await response.json()) as { error?: string; archived?: boolean };
      if (!response.ok || !body.archived) throw new Error(body.error ?? "Scenario could not be archived.");
      setScenarios((current) => current.filter((item) => item.scenarioId !== scenario.id));
      setScenario(freshScenario(sourceChecksum));
      setRun(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario could not be archived.");
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
      setRuns((current) => [body.run!.summary, ...current.filter((item) => item.runId !== body.run!.summary.runId)]);
      setCompareRunId("");
      setStateDiff(null);
      setComparison(null);
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
      const body = (await response.json()) as {
        error?: string;
        result?: { proofStatus: string; runs: Array<{ run: Run }> };
      };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Suite could not be run.");
      setRun(body.result.runs.at(-1)?.run ?? null);
      if (body.result.proofStatus !== "COMPLETE")
        setError("Suite completed with incomplete proof. Inspect its individual safe receipts.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Suite could not be run.");
    } finally {
      setBusy("");
    }
  }

  async function selectRun(runId: string) {
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/simulation-runs/${encodeURIComponent(runId)}`,
        privateRequest(csrfToken),
      );
      const body = (await response.json()) as { error?: string; run?: Run };
      if (!response.ok || !body.run) throw new Error(body.error ?? "Sea Trial receipt could not be loaded.");
      setRun(body.run);
      setStateDiff(null);
      setComparison(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sea Trial receipt could not be loaded.");
    }
  }

  async function replayRun() {
    if (!run) return;
    setBusy("run");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/simulation-runs/${encodeURIComponent(run.summary.runId)}/replay`,
        privateRequest(csrfToken, { method: "POST" }),
      );
      const body = (await response.json()) as { error?: string; replay?: { run?: Run } };
      if (!response.ok || !body.replay?.run) throw new Error(body.error ?? "Sea Trial replay could not be completed.");
      setRun(body.replay.run);
      setRuns((current) => [
        body.replay!.run!.summary,
        ...current.filter((item) => item.runId !== body.replay!.run!.summary.runId),
      ]);
      setCompareRunId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sea Trial replay could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function cancelRun() {
    if (!run) return;
    setBusy("run");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/simulation-runs/${encodeURIComponent(run.summary.runId)}`,
        privateRequest(csrfToken, { method: "DELETE" }),
      );
      const body = (await response.json()) as { error?: string; cancellationRequested?: boolean };
      if (!response.ok || !body.cancellationRequested)
        throw new Error(body.error ?? "Cancellation could not be requested.");
      setCancellationRequestedRunId(run.summary.runId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cancellation could not be requested.");
    } finally {
      setBusy("");
    }
  }

  async function compareRuns() {
    if (!run || !compareRunId) return;
    setBusy("run");
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/simulation-runs/${encodeURIComponent(run.summary.runId)}/compare/${encodeURIComponent(compareRunId)}`,
        privateRequest(csrfToken),
      );
      const body = (await response.json()) as { error?: string; comparison?: Comparison };
      if (!response.ok || !body.comparison) throw new Error(body.error ?? "Sea Trial receipts could not be compared.");
      setComparison(body.comparison);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sea Trial receipts could not be compared.");
    } finally {
      setBusy("");
    }
  }

  async function showStateDiff(from: number, to: number) {
    if (!run) return;
    setError("");
    try {
      const response = await fetch(
        `/api/studio/tales/${taleId}/simulation-runs/${encodeURIComponent(run.summary.runId)}/state-diff?from=${from}&to=${to}`,
        privateRequest(csrfToken),
      );
      const body = (await response.json()) as { error?: string; diff?: StateDiff };
      if (!response.ok || !body.diff) throw new Error(body.error ?? "State Diff could not be loaded.");
      setStateDiff(body.diff);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "State Diff could not be loaded.");
    }
  }

  async function loadCoverageSuggestions() {
    setBusy("run");
    setError("");
    try {
      const response = await fetch(`/api/studio/tales/${taleId}/scenarios/suggestions`, privateRequest(csrfToken));
      const body = (await response.json()) as { error?: string; coverage?: CoverageView; suggestions?: Suggestion[] };
      if (!response.ok || !body.coverage) throw new Error(body.error ?? "Coverage gaps could not be calculated.");
      setCoverage(body.coverage);
      setSuggestions(body.suggestions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Coverage gaps could not be calculated.");
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <section className="editor-single-panel">
        <p>Opening deterministic Sea Trials…</p>
      </section>
    );
  if (!scenario)
    return (
      <section className="editor-single-panel">
        <p role="alert">{error || "Sea Trials are unavailable."}</p>
      </section>
    );

  return (
    <section className="editor-single-panel drydock-scenario-lab" aria-labelledby="sea-trials-heading">
      <header>
        <div>
          <p className="eyebrow">Project Drydock</p>
          <h2 id="sea-trials-heading">Sea Trials</h2>
          <p>
            Run deterministic, source-bound simulations. These records never change a live Voyage or provider state.
          </p>
        </div>
        <button onClick={() => setScenario(freshScenario(sourceChecksum))}>New Scenario</button>
      </header>
      {error && (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
      <div className="drydock-scenario-layout">
        <aside aria-label="Saved Sea Trial Scenarios">
          <strong>Revision ledger</strong>
          <p className="drydock-checksum">Source {sourceChecksum.slice(0, 12)}…</p>
          <label className="drydock-filter">
            <span>Filter Scenarios</span>
            <input
              aria-label="Filter Scenarios"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Title or tag"
            />
          </label>
          <ul>
            {visibleScenarios.map((item) => (
              <li key={item.scenarioId}>
                <button
                  className={scenario.id === item.scenarioId ? "active" : ""}
                  onClick={() => void selectScenario(item)}
                >
                  <span>{item.title}</span>
                  <small>r{item.revision}</small>
                </button>
              </li>
            ))}
          </ul>
          {!visibleScenarios.length && <p>No current Scenario matches this filter.</p>}
        </aside>
        <div className="drydock-scenario-editor">
          <div className="settings-grid">
            <label>
              <span>Scenario title</span>
              <input
                aria-label="Scenario title"
                value={scenario.title}
                onChange={(event) => setScenario({ ...scenario, title: event.target.value })}
              />
            </label>
            <label>
              <span>Deterministic seed</span>
              <input
                aria-label="Deterministic seed"
                value={scenario.seed}
                onChange={(event) => setScenario({ ...scenario, seed: event.target.value })}
              />
            </label>
            <label className="wide">
              <span>Purpose</span>
              <textarea
                aria-label="Scenario purpose"
                value={scenario.purpose}
                onChange={(event) => setScenario({ ...scenario, purpose: event.target.value })}
              />
            </label>
            <label>
              <span>Viewport</span>
              <select
                aria-label="Simulation viewport"
                value={scenario.environment.viewport}
                onChange={(event) =>
                  setScenario({
                    ...scenario,
                    environment: {
                      ...scenario.environment,
                      viewport: event.target.value as Scenario["environment"]["viewport"],
                    },
                  })
                }
              >
                <option value="DESKTOP">Desktop</option>
                <option value="MOBILE">Mobile</option>
                <option value="NARROW">Narrow</option>
              </select>
            </label>
            <label>
              <span>Actor mode</span>
              <select
                aria-label="Simulation actor mode"
                value={scenario.initialState.actorMode}
                onChange={(event) =>
                  setScenario({
                    ...scenario,
                    initialState: {
                      ...scenario.initialState,
                      actorMode: event.target.value as Scenario["initialState"]["actorMode"],
                    },
                  })
                }
              >
                <option value="CREATOR">Creator</option>
                <option value="CAPTAIN">Captain</option>
                <option value="PLAYER">Player</option>
              </select>
            </label>
            <label>
              <span>Locale</span>
              <input
                aria-label="Simulation locale"
                value={scenario.environment.locale}
                onChange={(event) =>
                  setScenario({ ...scenario, environment: { ...scenario.environment, locale: event.target.value } })
                }
              />
            </label>
            <label>
              <span>Virtual start (UTC)</span>
              <input
                aria-label="Simulation virtual start"
                value={scenario.environment.virtualStart}
                onChange={(event) =>
                  setScenario({
                    ...scenario,
                    environment: { ...scenario.environment, virtualStart: event.target.value },
                  })
                }
              />
            </label>
            <label>
              <span>Start Passage ID</span>
              <input
                aria-label="Simulation start Passage"
                value={scenario.initialState.startBlockId ?? ""}
                onChange={(event) =>
                  setScenario({
                    ...scenario,
                    initialState: { ...scenario.initialState, startBlockId: event.target.value.trim() || undefined },
                  })
                }
              />
            </label>
            <label className="drydock-toggle">
              <input
                aria-label="Simulation reduced motion"
                type="checkbox"
                checked={scenario.environment.reducedMotion}
                onChange={(event) =>
                  setScenario({
                    ...scenario,
                    environment: { ...scenario.environment, reducedMotion: event.target.checked },
                  })
                }
              />
              <span>Reduced motion</span>
            </label>
            <label className="drydock-toggle">
              <input
                aria-label="Simulation sound enabled"
                type="checkbox"
                checked={scenario.environment.soundEnabled}
                onChange={(event) =>
                  setScenario({
                    ...scenario,
                    environment: { ...scenario.environment, soundEnabled: event.target.checked },
                  })
                }
              />
              <span>Sound enabled</span>
            </label>
            <label className="drydock-toggle">
              <input
                aria-label="Simulation keyboard only"
                type="checkbox"
                checked={scenario.environment.keyboardOnly}
                onChange={(event) =>
                  setScenario({
                    ...scenario,
                    environment: { ...scenario.environment, keyboardOnly: event.target.checked },
                  })
                }
              />
              <span>Keyboard only</span>
            </label>
          </div>
          <div className="drydock-json-fields">
            <section aria-label="Required Sea Trial classes">
              <strong>Required release coverage</strong>
              <p>
                Choose the authored outcomes this Scenario covers. Studio keeps the source-bound Drydock tag for you.
              </p>
              {requiredScenarioClasses.map((required) => {
                const tag = `required:${required.id}`;
                return (
                  <label className="drydock-toggle" key={required.id}>
                    <input
                      type="checkbox"
                      checked={scenario.tags.includes(tag)}
                      onChange={(event) => setRequiredScenarioClass(required, event.target.checked)}
                    />
                    <span>
                      {scenarioClassLabels[required.id] ?? required.capability}: {required.reason}
                    </span>
                  </label>
                );
              })}
            </section>
            <section aria-label="Scenario initial-state builder">
              <strong>Initial state</strong>
              <p>Set safe starting inventory and variables without exposing a live Voyage.</p>
              <div>
                <label>
                  <span>Artifact ID</span>
                  <input
                    aria-label="Initial inventory artifact"
                    value={inventoryArtifactId}
                    onChange={(event) => setInventoryArtifactId(event.target.value)}
                  />
                </label>
                <button onClick={addInventoryArtifact} disabled={!inventoryArtifactId.trim()}>
                  Add inventory artifact
                </button>
              </div>
              <div>
                <label>
                  <span>Variable name</span>
                  <input
                    aria-label="Initial variable name"
                    value={variableName}
                    onChange={(event) => setVariableName(event.target.value)}
                  />
                </label>
                <label>
                  <span>Value</span>
                  <input
                    aria-label="Initial variable value"
                    value={variableValue}
                    onChange={(event) => setVariableValue(event.target.value)}
                  />
                </label>
                <button onClick={addInitialVariable} disabled={!variableName.trim()}>
                  Set initial variable
                </button>
              </div>
              <p>
                {scenario.initialState.inventory.length
                  ? `Inventory: ${scenario.initialState.inventory.join(", ")}`
                  : "No initial inventory."}
              </p>
            </section>
            <section aria-label="Scenario step builder">
              <strong>Ordered outcome steps</strong>
              <p>Use these normal controls to build a safe deterministic path.</p>
              <div>
                <button onClick={() => addJsonEntry("inputs", { kind: "CONTINUE" })}>Add Continue</button>
                <label>
                  <span>Choice Passage</span>
                  <input
                    aria-label="Choice target Passage"
                    value={choiceTargetBlockId}
                    onChange={(event) => setChoiceTargetBlockId(event.target.value)}
                  />
                </label>
                <button
                  onClick={() => {
                    addJsonEntry("inputs", { kind: "CHOICE", targetBlockId: choiceTargetBlockId.trim() });
                    setChoiceTargetBlockId("");
                  }}
                  disabled={!choiceTargetBlockId.trim()}
                >
                  Add Choice
                </button>
              </div>
              <div>
                <button onClick={() => addJsonEntry("inputs", { kind: "TEXT_ANSWER", outcome: "MATCH" })}>
                  Answer match
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "TEXT_ANSWER", outcome: "NO_MATCH" })}>
                  Answer no match
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "TEXT_ANSWER", outcome: "EXHAUSTED" })}>
                  Answer exhausted
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "CAPTAIN", outcome: "APPROVE" })}>
                  Captain approve
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "CAPTAIN", outcome: "REJECT" })}>
                  Captain reject
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "CAPTAIN", outcome: "OVERRIDE" })}>
                  Captain override
                </button>
              </div>
              <div>
                <button onClick={() => addJsonEntry("inputs", { kind: "PROVIDER", outcome: "MATCH" })}>
                  Provider match
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "PROVIDER", outcome: "UNCERTAIN" })}>
                  Provider uncertain
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "PROVIDER", outcome: "UNAVAILABLE" })}>
                  Provider unavailable
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "PRESENTATION", outcome: "PRESENTED" })}>
                  Presentation shown
                </button>
                <button onClick={() => addJsonEntry("inputs", { kind: "PRESENTATION", outcome: "FALLBACK" })}>
                  Presentation fallback
                </button>
                <label>
                  <span>Timer ms</span>
                  <input
                    aria-label="Virtual timer milliseconds"
                    inputMode="numeric"
                    value={timerMilliseconds}
                    onChange={(event) => setTimerMilliseconds(event.target.value)}
                  />
                </label>
                <button
                  onClick={() =>
                    addJsonEntry("inputs", { kind: "ADVANCE_TIME", milliseconds: Number(timerMilliseconds) })
                  }
                  disabled={!Number.isSafeInteger(Number(timerMilliseconds)) || Number(timerMilliseconds) < 0}
                >
                  Add timer
                </button>
              </div>
            </section>
            <section aria-label="Scenario fault builder">
              <strong>Catalogued faults</strong>
              <p>Faults alter only the synthetic Sea Trial.</p>
              <div>
                <label>
                  <span>Fault</span>
                  <select
                    aria-label="Catalogued fault"
                    value={faultIdentity}
                    onChange={(event) => setFaultIdentity(event.target.value)}
                  >
                    <option value="NETWORK:OFFLINE">Network offline</option>
                    <option value="NETWORK:LATENCY">Network latency</option>
                    <option value="ASSET:UNAVAILABLE">Asset unavailable</option>
                    <option value="ASSET:DECODE_FAILED">Asset decode failed</option>
                    <option value="PROVIDER:UNAVAILABLE">Provider unavailable</option>
                    <option value="PROVIDER:STALE">Provider stale</option>
                    <option value="PROVIDER:DUPLICATE">Provider duplicate</option>
                    <option value="RUNTIME:CANCEL">Runtime cancel</option>
                    <option value="RUNTIME:RESTART">Runtime restart</option>
                    <option value="PRESENTATION:INTERRUPTED">Presentation interrupted</option>
                    <option value="PRESENTATION:FAILED">Presentation failed</option>
                    <option value="DEVICE:INPUT_UNAVAILABLE">Device input unavailable</option>
                    <option value="ACCESSIBILITY:REDUCED_MOTION">Accessibility reduced motion</option>
                    <option value="ACCESSIBILITY:SCREEN_READER">Accessibility screen reader</option>
                    <option value="TIME:CLOCK_LIMIT">Virtual clock limit</option>
                  </select>
                </label>
                <label>
                  <span>Before input</span>
                  <input
                    aria-label="Fault before input"
                    inputMode="numeric"
                    value={faultBeforeInput}
                    onChange={(event) => setFaultBeforeInput(event.target.value)}
                  />
                </label>
                <button onClick={addCataloguedFault}>Add catalogued fault</button>
              </div>
            </section>
            <section aria-label="Scenario assertion builder">
              <strong>Expected assertions</strong>
              <p>Assertions evaluate only redacted simulation state.</p>
              <div>
                <label>
                  <span>Assertion</span>
                  <select
                    aria-label="Scenario assertion kind"
                    value={assertionKind}
                    onChange={(event) => setAssertionKind(event.target.value)}
                  >
                    <option value="RUN_COMPLETES">Run completes</option>
                    <option value="RUN_REMAINS_INCOMPLETE">Run remains incomplete</option>
                    <option value="STATUS">Final status</option>
                    <option value="FINAL_OUTCOME_IS">Final outcome</option>
                    <option value="CURRENT_BLOCK">Current Passage (legacy)</option>
                    <option value="CURRENT_BLOCK_IS">Current Passage</option>
                    <option value="COVERED_BLOCK">Covered Passage (legacy)</option>
                    <option value="CURRENT_CHAPTER_IS">Current chapter</option>
                    <option value="VARIABLE_EQUALS">Variable equals</option>
                    <option value="VARIABLE_NOT_EXPOSED">Variable remains private</option>
                    <option value="INVENTORY_CONTAINS">Inventory contains artifact</option>
                    <option value="INVENTORY_DOES_NOT_CONTAIN">Inventory lacks artifact</option>
                    <option value="ARTIFACT_GRANTED">Artifact granted</option>
                    <option value="ARTIFACT_NOT_DUPLICATED">Artifact not duplicated</option>
                    <option value="REVEAL_EXISTS">Reveal exists</option>
                    <option value="EVENT_COUNT">Event count (legacy)</option>
                    <option value="SIDE_EFFECT_COUNT">Side-effect count</option>
                    <option value="EVENT_INTENT_COUNT">Intent count</option>
                    <option value="EVENT_INTENT_ORDER">Intent order</option>
                    <option value="EVENT_INTENT_TYPE">Intent type</option>
                    <option value="IDEMPOTENCY_PRESERVED">Idempotency preserved</option>
                    <option value="PROVIDER_REQUESTED">Provider requested</option>
                    <option value="PROVIDER_OUTCOME">Provider outcome</option>
                    <option value="PLAYER_SAFE_FIELD_PRESENT">Player-safe field present</option>
                    <option value="PROTECTED_FIELD_ABSENT">Protected field absent</option>
                    <option value="PRESENTATION_OUTCOME">Presentation outcome</option>
                    <option value="COVERAGE_THRESHOLD">Coverage threshold</option>
                    <option value="TRACE_STEP_LIMIT">Trace step limit</option>
                    <option value="ERROR_CLASS_IS">Error class</option>
                  </select>
                </label>
                <label>
                  <span>Target</span>
                  <input
                    aria-label="Scenario assertion target"
                    value={assertionTarget}
                    onChange={(event) => setAssertionTarget(event.target.value)}
                  />
                </label>
                <label>
                  <span>Value or count</span>
                  <input
                    aria-label="Scenario assertion value"
                    value={assertionValue}
                    onChange={(event) => setAssertionValue(event.target.value)}
                  />
                </label>
                <button onClick={addStructuredAssertion}>Add assertion</button>
              </div>
            </section>
            <details className="drydock-advanced-json">
              <summary>Advanced strict JSON import/export</summary>
              <p>
                Use only when importing or exporting an already governed Scenario; the normal controls above require no
                raw JSON.
              </p>
              <label>
                <span>Outcome steps</span>
                <textarea
                  aria-label="Scenario outcome steps"
                  value={inputsText}
                  onChange={(event) => setInputsText(event.target.value)}
                />
              </label>
              <label>
                <span>Catalogued faults</span>
                <textarea
                  aria-label="Scenario faults"
                  value={faultsText}
                  onChange={(event) => setFaultsText(event.target.value)}
                />
              </label>
              <label>
                <span>Assertions</span>
                <textarea
                  aria-label="Scenario assertions"
                  value={assertionsText}
                  onChange={(event) => setAssertionsText(event.target.value)}
                />
              </label>
            </details>
          </div>
          <div className="drydock-scenario-actions">
            <button onClick={() => void loadCoverageSuggestions()} disabled={busy !== ""}>
              View coverage and suggestions
            </button>
            <button
              onClick={() => void duplicateScenario()}
              disabled={busy !== "" || !scenarios.some((item) => item.scenarioId === scenario.id)}
            >
              Duplicate Scenario
            </button>
            <button
              onClick={() => void archiveScenario()}
              disabled={busy !== "" || !scenarios.some((item) => item.scenarioId === scenario.id)}
            >
              Archive Scenario
            </button>
            <button onClick={() => void saveScenario()} disabled={busy !== ""}>
              {busy === "save" ? "Saving revision…" : "Save Scenario revision"}
            </button>
            <button className="brass-button" onClick={() => void runScenario()} disabled={busy !== ""}>
              {busy === "run" ? "Running bounded trial…" : "Save and run Sea Trial"}
            </button>
          </div>
          <section className="drydock-suite-panel" aria-label="Scenario Suite controls">
            <strong>Scenario Suites</strong>
            <p>Save the current revisions as an ordered, source-bound regression set.</p>
            <div>
              <input
                aria-label="Scenario Suite title"
                value={suiteTitle}
                onChange={(event) => setSuiteTitle(event.target.value)}
              />
              <button onClick={() => void saveSuite()} disabled={busy !== ""}>
                Save current revisions as Suite
              </button>
            </div>
            <ul>
              {suites.map((suite) => (
                <li key={suite.suiteId}>
                  <span>
                    {suite.title} ({suite.members.length} revisions)
                  </span>
                  <button onClick={() => void runSuite(suite)} disabled={busy !== ""}>
                    Run Suite
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {coverage && (
            <section className="drydock-coverage-view" aria-label="Coverage view">
              <h3>Coverage view: {coverage.proofStatus}</h3>
              <p>
                States {coverage.coveredStateDigests.length}; provider outcomes{" "}
                {coverage.coveredProviderOutcomes.length}; environment modes {coverage.coveredEnvironmentModes.length}.
              </p>
              <ul>
                <li>
                  Uncovered Passages:{" "}
                  {coverage.uncoveredBlockIds.length ? (
                    <span className="drydock-passage-links">
                      {coverage.uncoveredBlockIds.map((blockId) => (
                        <a key={blockId} href={passageHref(taleId, blockId)}>
                          {blockId}
                        </a>
                      ))}
                    </span>
                  ) : (
                    "none"
                  )}
                </li>
                <li>Uncovered edges: {coverage.uncoveredEdgeIds.join(", ") || "none"}</li>
                <li>Uncovered endings: {coverage.uncoveredEndingBlockIds.join(", ") || "none"}</li>
              </ul>
              <h4>Unsaved Scenario suggestions</h4>
              <ul>
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <strong>{suggestion.kind}</strong>: {suggestion.target}. {suggestion.safeHint}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      {run && (
        <section className="drydock-run-receipt" aria-label="Sea Trial receipt">
          <header>
            <strong>{run.summary.status}</strong>
            <span>Run {run.summary.runId}</span>
          </header>
          <div className="drydock-run-actions">
            {(run.summary.status === "QUEUED" || run.summary.status === "RUNNING") && (
              <button
                onClick={() => void cancelRun()}
                disabled={busy !== "" || cancellationRequestedRunId === run.summary.runId}
              >
                {cancellationRequestedRunId === run.summary.runId ? "Cancellation requested" : "Cancel Sea Trial"}
              </button>
            )}
            <button onClick={() => void replayRun()} disabled={busy !== ""}>
              Replay this frozen receipt
            </button>
            <label>
              <span>Compare with</span>
              <select
                aria-label="Compare Sea Trial receipt"
                value={compareRunId}
                onChange={(event) => setCompareRunId(event.target.value)}
              >
                <option value="">Choose another receipt</option>
                {runs
                  .filter((item) => item.runId !== run.summary.runId)
                  .map((item) => (
                    <option key={item.runId} value={item.runId}>
                      {item.runId} ({item.status})
                    </option>
                  ))}
              </select>
            </label>
            <button onClick={() => void compareRuns()} disabled={busy !== "" || !compareRunId}>
              Compare receipts
            </button>
          </div>
          {comparison && (
            <section className="drydock-comparison" aria-label="Sea Trial comparison">
              <strong>{comparison.compatible ? "Compatible source lineage" : "Different source lineage"}</strong>
              <p>
                Result {comparison.result.same ? "matches" : "differs"}; adapter{" "}
                {comparison.adapter.same ? "matches" : "differs"}.
              </p>
              <p>
                {comparison.trace.firstDivergence
                  ? `First divergence: step ${comparison.trace.firstDivergence.ordinal} (${comparison.trace.firstDivergence.kind}).`
                  : "No semantic trace divergence."}
              </p>
            </section>
          )}
          <p>
            {run.summary.completedInputs} trace entries; source {run.summary.sourceChecksum.slice(0, 12)}…
          </p>
          <dl className="drydock-coverage-summary" aria-label="Run coverage summary">
            <div>
              <dt>Passages</dt>
              <dd>{run.result.coverage?.blockIds?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Edges</dt>
              <dd>{run.result.coverage?.edgeIds?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Injected faults</dt>
              <dd>{run.result.coverage?.faultIds?.length ?? 0}</dd>
            </div>
          </dl>
          <section className="drydock-run-coverage-map" aria-label="Run Passage coverage">
            <h3>Run Passage coverage</h3>
            <p>
              These links return to the exact authored Passage. A covered Passage is evidence for this frozen Sea Trial,
              not a statement about a live Voyage.
            </p>
            {coveredPassages.length ? (
              <ul>
                {coveredPassages.map((blockId) => (
                  <li key={blockId} data-coverage-state="covered">
                    <span aria-hidden="true">●</span>
                    <a href={passageHref(taleId, blockId)}>Open covered Passage {blockId}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No Passage coverage was recorded for this run.</p>
            )}
          </section>
          <ul aria-label="Scenario assertions">
            {assertionStatus.map((assertion, index) => (
              <li key={`${assertion.kind}-${index}`} data-passed={assertion.passed}>
                {assertion.kind}: {assertion.passed ? "passed" : "failed"}
              </li>
            ))}
          </ul>
          <section aria-label="Trace Inspector">
            <h3>Trace Inspector</h3>
            <p>Each entry is a redacted virtual-time receipt. Select a transition to view its safe State Diff.</p>
            <ol>
              {run.trace.map((entry, index) => (
                <li key={`inspector-${entry.ordinal}`}>
                  <strong>
                    {entry.ordinal}. {entry.inputKind}
                  </strong>
                  <span>{entry.status}</span>
                  <small>
                    {[...entry.intentTypes, ...entry.faultIds].join(", ") || "No emitted event"}; state{" "}
                    {entry.stateDigest?.slice(0, 12) ?? "unchanged"}
                  </small>
                  {entry.blockId ? (
                    <a className="drydock-trace-passage-link" href={passageHref(taleId, entry.blockId)}>
                      Open Passage
                    </a>
                  ) : null}
                  {index > 0 && (
                    <button onClick={() => void showStateDiff(run.trace[index - 1]!.ordinal, entry.ordinal)}>
                      View State Diff from prior step
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
          {stateDiff && (
            <section className="drydock-state-diff" aria-label="State Diff">
              <h3>State Diff</h3>
              <p>
                Step {stateDiff.from.ordinal} to {stateDiff.to.ordinal}:{" "}
                {stateDiff.changed.join(", ") || "no canonical state change"}.
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Passage</th>
                    <td>{stateDiff.from.blockId ?? "none"}</td>
                    <td>{stateDiff.to.blockId ?? "none"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Status</th>
                    <td>{stateDiff.from.status}</td>
                    <td>{stateDiff.to.status}</td>
                  </tr>
                  <tr>
                    <th scope="row">State digest</th>
                    <td>{stateDiff.from.stateDigest.slice(0, 12)}</td>
                    <td>{stateDiff.to.stateDigest.slice(0, 12)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}
          <ol aria-label="Safe simulation trace">
            {run.trace.map((entry) => (
              <li key={entry.ordinal}>
                <strong>
                  {entry.ordinal}. {entry.inputKind}
                </strong>
                <span>{entry.status}</span>
                <small>
                  {[...entry.intentTypes, ...entry.faultIds].join(", ") || "No emitted event"} · state{" "}
                  {entry.stateDigest?.slice(0, 12) ?? "unchanged"}…
                </small>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!!runs.length && (
        <section className="drydock-run-history" aria-label="Sea Trial run history">
          <h3>Recent Sea Trial receipts</h3>
          <ul>
            {runs.map((item) => (
              <li key={item.runId}>
                <button onClick={() => void selectRun(item.runId)}>{item.runId}</button>
                <span>{item.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
