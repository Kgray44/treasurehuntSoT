import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "../src/config.js";
import { registryForRepository } from "../src/registry.js";
import { projectProgress, type ProjectRecord, type TaskRecord } from "../src/domain.js";
import { discoverObservations } from "../src/discovery.js";
import { reconcileProjectRecords } from "../src/reconciliation.js";
import { RepositoryEvidenceCollector } from "../src/repository-evidence.js";
import { compareProgramHistory, summarizeRollups } from "../src/comparison.js";
import { type BridgewatchEventKind, type BridgewatchProgramSnapshot } from "../src/history.js";
import { SoundingLineCollector, testTotals } from "../src/sounding-line.js";
import { authorizeTelemetry, parseHeartbeat, workerState } from "../src/telemetry.js";
import { readNightwatchProjection } from "../src/nightwatch-projection.js";
import { DataFabricCollector, deriveCoverage, type DataFabricSnapshot, type ObservationFact } from "../src/fabric.js";
import { GithubCollector } from "./github.js";
import { BridgewatchStore, type HistoryQuery } from "./store.js";

type HistoryParameters = {
  since?: string;
  until?: string;
  project?: string;
  phase?: string;
  kind?: string;
  limit?: string;
  cursor?: string;
};

type ComparisonParameters = {
  from?: string;
  to?: string;
};

type PullRequestParameters = { state?: string };
type BranchProfileParameters = { name?: string };

type SourceProfile = {
  name: string;
  state: string;
  configured: boolean;
  reachable: boolean | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextRetryAt: string | null;
  detail: string | null;
  cacheAgeMs: number | null;
  rateLimitRemaining?: number | null;
  authenticationState: string;
  sourceId: string;
  expected: boolean;
  configurationSource: string;
  authorityLevel: string;
  schemaVersion: string;
  sourceOccurrenceAt: string | null;
  bridgewatchObservedAt: string;
  records: {
    received: number | null;
    retained: number;
    exposed: number;
    displayed: number;
  };
  capabilityClasses: { supported: string[]; missing: string[] };
  coverage: { state: string; summary: string; limitation: string | null };
  failure: { classification: string; diagnostic: string } | null;
  repairability: "AUTOMATIC_RETRY" | "CONFIGURATION_REQUIRED" | "SOURCE_OWNER_REQUIRED" | "NOT_APPLICABLE";
  servingRetainedStaleData: boolean;
};

export type OperatorAttention = {
  level: "NOTICE" | "AMBER" | "BLOCKED";
  code: string;
  title: string;
  message: string;
  projectId?: string;
  source: {
    id: string;
    reference: string;
    observedAt: string | null;
    state: string | null;
  };
};

type AttentionPullRequest = {
  number: number;
  title: string;
  state: string;
  checkState?: string | null;
  mergeableState?: string | null;
  updatedAt?: string | null;
  headRef?: string | null;
};

type AttentionPlan = {
  id: string;
  state: string;
  createdAt: string | null;
  sourceSha?: string | null;
  finalDecision?: string | null;
  nodes: Array<{ id: string; state: string; rootFailureId?: string | null }>;
};

const attentionLevelRank: Record<OperatorAttention["level"], number> = {
  BLOCKED: 3,
  AMBER: 2,
  NOTICE: 1,
};

/**
 * Turns bounded observations into operator-facing conditions. The function is
 * deliberately pure: it names the observed source and never prescribes or
 * performs a repair.
 */
export function deriveOperatorAttention(input: {
  sources: readonly Pick<SourceProfile, "name" | "sourceId" | "state" | "detail" | "lastSuccessAt" | "configured">[];
  facts: readonly ObservationFact[];
  branches: readonly {
    name: string;
    projectId?: string | null;
    attention?: boolean;
    reason?: string | null;
    message?: string | null;
    lastActivityAt?: string | null;
  }[];
  pullRequests: readonly AttentionPullRequest[];
  plans: readonly AttentionPlan[];
  workers: readonly {
    workerId: string;
    project: string;
    effectiveState?: string;
    state: string;
    heartbeatAt: string;
  }[];
  historyWarning: string | null;
  candidateStaleAfterMs: number;
}): OperatorAttention[] {
  const result: OperatorAttention[] = [];
  const seen = new Set<string>();
  const add = (item: OperatorAttention) => {
    const key = `${item.code}:${item.projectId ?? ""}:${item.source.id}:${item.source.reference}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  };
  const sourceFor = (id: string, reference: string, observedAt: string | null, state: string | null) => ({
    id,
    reference,
    observedAt,
    state,
  });

  for (const source of input.sources) {
    if (["DEGRADED", "UNAVAILABLE", "STALE"].includes(source.state)) {
      add({
        level: source.state === "UNAVAILABLE" ? "BLOCKED" : "AMBER",
        code: "SOURCE_HEALTH",
        title: `${source.name} source ${source.state.toLowerCase()}`,
        message:
          source.detail ??
          "The most recent bounded observation is not healthy; retained data may be stale or incomplete.",
        source: sourceFor(source.sourceId, `source:${source.name}`, source.lastSuccessAt, source.state),
      });
    } else if (source.state === "NOT_CONFIGURED" || !source.configured) {
      add({
        level: "NOTICE",
        code: "SOURCE_NOT_CONFIGURED",
        title: `${source.name} source is not configured`,
        message: source.detail ?? "This observation source is optional and has not been configured on this host.",
        source: sourceFor(source.sourceId, `source:${source.name}`, source.lastSuccessAt, source.state),
      });
    }
  }

  for (const fact of input.facts) {
    const level = fact.state === "SOURCE_UNAVAILABLE" ? "AMBER" : fact.state === "STALE" ? "AMBER" : "NOTICE";
    if (!["SOURCE_UNAVAILABLE", "STALE", "UNKNOWN", "NOT_HISTORICALLY_RECORDED"].includes(fact.state)) continue;
    add({
      level,
      code: "EXPECTED_FACT_GAP",
      title: `${fact.label} is ${fact.state.toLowerCase().replaceAll("_", " ")}`,
      message:
        fact.limitation ??
        "The expected fact class has no current authoritative observation; its absence is retained explicitly rather than inferred.",
      source: sourceFor(
        fact.provenance.sourceId,
        fact.provenance.reference,
        fact.provenance.sourceObservedAt,
        fact.state,
      ),
    });
  }

  for (const worker of input.workers) {
    const state = worker.effectiveState ?? worker.state;
    if (state !== "BLOCKED" && state !== "STALE") continue;
    add({
      level: state === "BLOCKED" ? "BLOCKED" : "NOTICE",
      code: `WORKER_${state}`,
      title: `Worker ${worker.workerId} is ${state.toLowerCase()}`,
      message: `Activity telemetry reports ${state} for this worker. Telemetry remains activity evidence, not lifecycle authority.`,
      projectId: worker.project,
      source: sourceFor("bridgewatch-activity-telemetry", `telemetry:${worker.workerId}`, worker.heartbeatAt, state),
    });
  }

  for (const branch of input.branches.filter((entry) => entry.attention)) {
    add({
      level: "AMBER",
      code: branch.reason ?? "BRANCH_ATTENTION",
      title: `Branch ${branch.name} requires review`,
      message: branch.message ?? "The observed branch has a governed staleness or current-main divergence condition.",
      projectId: branch.projectId ?? undefined,
      source: sourceFor(
        "github-repository-api",
        `branch:${branch.name}`,
        branch.lastActivityAt ?? null,
        branch.reason ?? null,
      ),
    });
  }

  for (const pull of input.pullRequests.filter((entry) => entry.state === "OPEN")) {
    const checks = (pull.checkState ?? "").toUpperCase();
    const mergeability = (pull.mergeableState ?? "").toUpperCase();
    const stale = pull.updatedAt ? Date.now() - Date.parse(pull.updatedAt) > input.candidateStaleAfterMs : false;
    if (checks.includes("FAIL") || checks.includes("ERROR") || mergeability === "BLOCKED" || mergeability === "DIRTY") {
      add({
        level: "BLOCKED",
        code: "PULL_REQUEST_BLOCKED",
        title: `Pull request #${pull.number} is blocked`,
        message: `Observed checks are ${pull.checkState ?? "NOT_RECORDED"}; mergeability is ${pull.mergeableState ?? "NOT_RECORDED"}.`,
        source: sourceFor(
          "github-repository-api",
          `pull-request:${pull.number}`,
          pull.updatedAt ?? null,
          pull.checkState ?? null,
        ),
      });
    } else if (stale) {
      add({
        level: "AMBER",
        code: "PULL_REQUEST_STALE",
        title: `Pull request #${pull.number} is stale`,
        message: `No observed update is within the configured review freshness window. This does not infer an owner action or lifecycle result.`,
        source: sourceFor("github-repository-api", `pull-request:${pull.number}`, pull.updatedAt ?? null, "STALE"),
      });
    }
  }

  for (const plan of input.plans) {
    if (["RELEASE_NO_GO", "EVIDENCE_INVALID"].includes(plan.finalDecision ?? "")) {
      add({
        level: "BLOCKED",
        code: "VERIFICATION_REGRESSION",
        title: `Sounding Line run ${plan.id} did not clear`,
        message: `The retained final decision is ${plan.finalDecision}. Sounding Line remains the authority for its meaning and disposition.`,
        source: sourceFor(
          "sounding-line-runtime-projection",
          `run:${plan.id}`,
          plan.createdAt,
          plan.finalDecision ?? null,
        ),
      });
    }
    if (
      !plan.finalDecision &&
      !["COMPLETE", "CANCELLED", "SUPERSEDED"].includes(plan.state) &&
      plan.createdAt &&
      Number.isFinite(Date.parse(plan.createdAt)) &&
      Date.now() - Date.parse(plan.createdAt) > input.candidateStaleAfterMs
    ) {
      add({
        level: "AMBER",
        code: "CANDIDATE_STALLED",
        title: `Candidate ${plan.id} has no final decision`,
        message:
          "The bounded plan remains active beyond the configured review window; Bridgewatch does not retry, cancel, or advance it.",
        source: sourceFor("sounding-line-runtime-projection", `run:${plan.id}`, plan.createdAt, plan.state),
      });
    }
    const failed = plan.nodes.filter((node) => node.state === "FAILED" || node.state === "BLOCKED");
    if (failed.length) {
      add({
        level: "BLOCKED",
        code: "VERIFICATION_FAILURE",
        title: `Sounding Line run ${plan.id} has failed or blocked nodes`,
        message: `${failed.length} retained node${failed.length === 1 ? " is" : "s are"} failed or blocked. Root-cause detail remains source-owned.`,
        source: sourceFor("sounding-line-runtime-projection", `run:${plan.id}`, plan.createdAt, "FAILED"),
      });
    }
  }

  const runtime = input.facts.find(
    (fact) => fact.factClass === "voyagewright.runtime-identity" && typeof fact.value.sourceSha === "string",
  );
  const main = input.facts
    .filter((fact) => fact.factClass === "repository.current-main" && typeof fact.value.headSha === "string")
    .sort((left, right) => right.provenance.precedence - left.provenance.precedence)[0];
  if (runtime && main && runtime.value.sourceSha !== main.value.headSha) {
    add({
      level: "AMBER",
      code: "RUNTIME_NOT_CURRENT_MAIN",
      title: "Voyagewright runtime does not report current main",
      message:
        "The observed runtime source SHA differs from the current-main source SHA. Bridgewatch does not infer ancestry, deploy, or restart state.",
      source: sourceFor(
        runtime.provenance.sourceId,
        runtime.provenance.reference,
        runtime.provenance.sourceObservedAt,
        runtime.state,
      ),
    });
  }

  const providers = input.facts.find((fact) => fact.factClass === "operations.provider-jobs");
  if (providers && typeof providers.value.degradedCount === "number" && providers.value.degradedCount > 0) {
    add({
      level: "AMBER",
      code: "PROVIDER_DEGRADED",
      title: "Provider or job degradation is observed",
      message: `${providers.value.degradedCount} provider or job status${providers.value.degradedCount === 1 ? " is" : "es are"} reported degraded by the configured projection.`,
      source: sourceFor(
        providers.provenance.sourceId,
        providers.provenance.reference,
        providers.provenance.sourceObservedAt,
        providers.state,
      ),
    });
  }

  if (input.historyWarning) {
    add({
      level: "NOTICE",
      code: "HISTORY_UNAVAILABLE",
      title: "Historical persistence is unavailable",
      message: input.historyWarning,
      source: sourceFor("bridgewatch-history", "bridgewatch:history", null, "DEGRADED"),
    });
  }

  return result.sort(
    (left, right) =>
      attentionLevelRank[right.level] - attentionLevelRank[left.level] ||
      left.title.localeCompare(right.title) ||
      left.source.reference.localeCompare(right.source.reference),
  );
}

const twelveHours = 12 * 60 * 60 * 1_000;
const eventKinds = new Set<BridgewatchEventKind>([
  "PROJECT_STATE_CHANGED",
  "PHASE_STATE_CHANGED",
  "MILESTONE_STATE_CHANGED",
  "PULL_REQUEST_OPENED",
  "PULL_REQUEST_MERGED",
  "PULL_REQUEST_CLOSED",
  "PULL_REQUEST_CHECK_STATE_CHANGED",
  "WORKER_STARTED",
  "WORKER_FINISHED",
  "WORKER_BLOCKED",
  "WORKER_STALE",
  "SOUNDING_LINE_RUN_STARTED",
  "SOUNDING_LINE_ROOT_FAILURE",
  "SOUNDING_LINE_DECISION",
  "MAIN_ADVANCED",
  "EXTERNAL_GATE_CHANGED",
  "SOURCE_STATE_CHANGED",
  "BRANCH_HEALTH_CHANGED",
]);

export function buildServer() {
  const config = loadConfig();
  const store = new BridgewatchStore(config.dbPath);
  const collector = new GithubCollector(config, store);
  const projectRegistry = registryForRepository(config.BRIDGEWATCH_REPOSITORY);
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { redact: ["req.headers.authorization", "req.url"] },
    bodyLimit: config.BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES,
  });
  const soundingLine = new SoundingLineCollector(config, store);
  const repositoryEvidence = new RepositoryEvidenceCollector(
    resolve(process.cwd(), ".."),
    config.BRIDGEWATCH_REQUEST_TIMEOUT_MS,
  );
  const dataFabric = new DataFabricCollector(config, store, resolve(process.cwd(), ".."));
  const telemetryWindows = new Map<string, { startedAt: number; count: number }>();
  let historyWarning: string | null = null;
  let fabricWarning: string | null = null;
  let currentFabric: DataFabricSnapshot | null = null;
  let currentHistory: BridgewatchProgramSnapshot | null | undefined;
  let projectTruthCollection: {
    documentCount: number | null;
    branchCount: number | null;
    lastSuccessfulCollectionAt: string | null;
  } = {
    documentCount: null,
    branchCount: null,
    lastSuccessfulCollectionAt: null,
  };
  store.replaceProjectRegistry(projectRegistry);

  const observation = (): BridgewatchProgramSnapshot => ({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    projects: store.projects(),
    github: collector.cached(),
    workers: store.workers().map((worker) => ({
      ...worker,
      effectiveState: workerState(worker, config.BRIDGEWATCH_TELEMETRY_STALE_MS),
    })),
    soundingLine: soundingLine.cached(),
  });
  const persistHistory = (storeSnapshot = true) => {
    try {
      const snapshot = observation();
      store.recordHistory(
        snapshot,
        currentHistory === undefined ? { storeSnapshot } : { storeSnapshot, prior: currentHistory },
      );
      currentHistory = snapshot;
      historyWarning = null;
    } catch {
      historyWarning = "Historical persistence is unavailable; current source projections remain available.";
    }
  };
  const refreshSources = async () => {
    await Promise.all([collector.refresh(), soundingLine.refresh()]);
    const repository = await repositoryEvidence.refresh();
    const snapshot = collector.cached();
    const attemptedAt = new Date().toISOString();
    const projectTruthAvailable = repository.documentsAvailable && repository.branchesAvailable;
    const priorProjectTruth = store.sourceObservations().find((source) => source.name === "project-truth");
    if (projectTruthAvailable) {
      projectTruthCollection = {
        documentCount: repository.documentCount,
        branchCount: repository.branchCount,
        lastSuccessfulCollectionAt: attemptedAt,
      };
    }
    const retainedSuccessAt =
      projectTruthCollection.lastSuccessfulCollectionAt ?? priorProjectTruth?.lastSuccessAt ?? null;
    store.upsertSourceObservation({
      name: "project-truth",
      state: projectTruthAvailable ? "HEALTHY" : "DEGRADED",
      configured: true,
      reachable: projectTruthAvailable,
      lastAttemptAt: attemptedAt,
      lastSuccessAt: retainedSuccessAt,
      nextRetryAt: projectTruthAvailable
        ? null
        : new Date(Date.now() + config.BRIDGEWATCH_SNAPSHOT_INTERVAL_MS).toISOString(),
      detail: projectTruthAvailable
        ? null
        : "Repository documentation or local-ref discovery could not be read; retained project records remain available.",
      cacheAgeMs: retainedSuccessAt ? Math.max(0, Date.now() - Date.parse(retainedSuccessAt)) : null,
      authenticationState: "NOT_APPLICABLE",
    });
    if (projectTruthAvailable) {
      const discoveredAt = new Date().toISOString();
      const discovery = discoverObservations({
        observedAt: discoveredAt,
        knownProjects: projectRegistry.map((project) => ({
          id: project.id,
          name: project.name,
        })),
        documents: repository.documents,
        branches: [
          ...repository.branches,
          ...(snapshot?.branches ?? []).map((branch) => ({
            name: branch.name,
            headSha: branch.headSha,
          })),
        ],
        pullRequests: (snapshot?.pullRequests ?? []).map((pull) => ({
          number: pull.number,
          title: pull.title,
          state: pull.state,
          headRef: pull.headRef,
        })),
      });
      store.replaceDiscovery(discovery, discoveredAt);
      store.replaceProjectRegistry(reconcileProjectRecords(projectRegistry, discovery));
    }
    try {
      currentFabric = await dataFabric.refresh({
        github: collector.cached(),
        soundingLine: soundingLine.cached(),
        projects: store.projects(),
        workers: store.workers(),
      });
      fabricWarning = null;
    } catch {
      // The data fabric is an observer. A local source/cache failure must not
      // blank existing P1 projections or block the private dashboard.
      fabricWarning = "P2 data-fabric persistence is unavailable; no new fabric observation is claimed.";
    }
    persistHistory();
  };
  const refreshSoundingLine = async () => {
    await soundingLine.refresh();
    persistHistory();
  };

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?", 1)[0] ?? "/";
    const isOperationalEndpoint =
      pathname === "/healthz" || pathname === "/readyz" || pathname.startsWith("/api/telemetry/");
    if (isOperationalEndpoint || !config.BRIDGEWATCH_DASHBOARD_USERNAME || !config.BRIDGEWATCH_DASHBOARD_PASSWORD)
      return;
    const expected = Buffer.from(
      `${config.BRIDGEWATCH_DASHBOARD_USERNAME}:${config.BRIDGEWATCH_DASHBOARD_PASSWORD}`,
    ).toString("base64");
    const received = request.headers.authorization?.replace(/^Basic\s+/iu, "") ?? "";
    const expectedBytes = Buffer.from(expected);
    const receivedBytes = Buffer.from(received);
    if (expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes)) return;
    reply.header("WWW-Authenticate", 'Basic realm="Bridgewatch"');
    return reply.code(401).send({ error: "Private dashboard authentication required" });
  });
  app.addHook("onSend", async (_request, reply) => {
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    reply.header("Cache-Control", "no-store");
  });

  const summary = () => {
    const nightwatch = readNightwatchProjection(
      config.BRIDGEWATCH_NIGHTWATCH_DB_PATH,
      config.BRIDGEWATCH_NIGHTWATCH_REPOSITORY_ROOT,
    );
    const snapshot = collector.cached();
    const soundingLineProjection = soundingLine.cached();
    const projects = store.projects();
    const workers = store.workers().map((worker) => ({
      ...worker,
      effectiveState: workerState(worker, config.BRIDGEWATCH_TELEMETRY_STALE_MS),
    }));
    const totals = testTotals(soundingLineProjection);
    const counts = store.observationCounts();
    const fabric: DataFabricSnapshot = currentFabric ?? {
      observedAt: new Date().toISOString(),
      sources: [],
      facts: store.fabricFacts(),
      coverage: deriveCoverage(store.fabricFacts()),
    };
    const localMain = fabric.facts
      .filter((fact) => fact.factClass === "repository.current-main" && typeof fact.value.headSha === "string")
      .sort((left, right) => right.provenance.precedence - left.provenance.precedence)[0]?.value.headSha;
    const currentMain = snapshot?.headSha ?? (typeof localMain === "string" ? localMain : null);
    const inspectedAt = new Date().toISOString();
    const observedAt = snapshot?.observedAt ?? null;
    const githubHealth = store.sourceObservations().find((source) => source.name === "github") ?? {
      name: "github",
      state: sourceState(observedAt, 60_000),
      configured: Boolean(config.BRIDGEWATCH_REPOSITORY),
      reachable: snapshot ? true : null,
      lastAttemptAt: null,
      lastSuccessAt: observedAt,
      nextRetryAt: null,
      detail: snapshot ? null : "GitHub has not been collected yet.",
      cacheAgeMs: observedAt ? Math.max(0, Date.now() - Date.parse(observedAt)) : null,
      authenticationState: config.BRIDGEWATCH_GITHUB_TOKEN ? "TOKEN_CONFIGURED" : "ANONYMOUS",
    };
    const reporterObservedAt = workers.length
      ? workers.reduce(
          (latest, worker) => (Date.parse(worker.heartbeatAt) > Date.parse(latest) ? worker.heartbeatAt : latest),
          workers[0]!.heartbeatAt,
        )
      : null;
    const reporterHealth = !config.BRIDGEWATCH_TELEMETRY_TOKEN
      ? {
          name: "reporter",
          state: "NOT_CONFIGURED" as const,
          configured: false,
          reachable: null,
          lastAttemptAt: null,
          lastSuccessAt: null,
          nextRetryAt: null,
          detail:
            "Bridgewatch task telemetry is not configured. Configure the private telemetry connection on this host to enable this source.",
          cacheAgeMs: null,
          authenticationState: "NOT_APPLICABLE" as const,
        }
      : {
          name: "reporter",
          state: workers.length ? sourceState(reporterObservedAt, config.BRIDGEWATCH_TELEMETRY_STALE_MS) : "HEALTHY",
          configured: true,
          reachable: true,
          lastAttemptAt: reporterObservedAt,
          lastSuccessAt: reporterObservedAt,
          nextRetryAt: null,
          detail: workers.length ? null : "No active worker telemetry is currently retained.",
          cacheAgeMs: reporterObservedAt ? Math.max(0, Date.now() - Date.parse(reporterObservedAt)) : null,
          authenticationState: "NOT_APPLICABLE" as const,
        };
    const projectTruthHealth = store.sourceObservations().find((source) => source.name === "project-truth") ?? {
      name: "project-truth",
      state: "UNAVAILABLE" as const,
      configured: true,
      reachable: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      nextRetryAt: null,
      detail: "Local repository evidence has not been collected yet.",
      cacheAgeMs: null,
      authenticationState: "NOT_APPLICABLE" as const,
    };
    const soundingStatus = soundingLine.status();
    const soundingUnknownOnly = Boolean(
      soundingLineProjection?.plans.length &&
        soundingLineProjection.plans.every((plan) => !plan.sourceSha && plan.state === "UNKNOWN" && !plan.nodes.length),
    );
    const soundingHealth = {
      name: "sounding-line",
      state: soundingStatus.failure
        ? soundingLineProjection
          ? "DEGRADED"
          : "UNAVAILABLE"
        : sourceState(soundingLineProjection?.observedAt ?? null, 10_000),
      configured: true,
      reachable: soundingStatus.failure ? false : soundingLineProjection ? true : null,
      lastAttemptAt: soundingStatus.lastAttemptAt,
      lastSuccessAt: soundingStatus.lastSuccessAt,
      nextRetryAt: soundingStatus.failure
        ? new Date(Date.now() + config.BRIDGEWATCH_SOUNDING_LINE_POLL_INTERVAL_MS).toISOString()
        : null,
      detail: soundingStatus.diagnostic,
      cacheAgeMs: soundingLineProjection?.observedAt
        ? Math.max(0, Date.now() - Date.parse(soundingLineProjection.observedAt))
        : null,
      authenticationState: "NOT_APPLICABLE",
    };
    const sources: SourceProfile[] = [
      {
        ...githubHealth,
        sourceId: "github-repository-api",
        expected: true,
        configurationSource: "BRIDGEWATCH_REPOSITORY",
        authorityLevel: "AUTHORITATIVE_CURRENT_REMOTE",
        schemaVersion: "github-rest-v3-normalized-1",
        sourceOccurrenceAt: snapshot?.observedAt ?? null,
        bridgewatchObservedAt: inspectedAt,
        records: {
          received: snapshot
            ? snapshot.pullRequests.length + snapshot.branches.length + snapshot.workflows.length
            : null,
          retained: counts.pullRequests + counts.branches,
          exposed:
            (snapshot?.pullRequests.length ?? 0) + (snapshot?.branches.length ?? 0) + (snapshot?.workflows.length ?? 0),
          displayed: (snapshot?.pullRequests.length ?? 0) + (snapshot?.branches.length ?? 0),
        },
        capabilityClasses: {
          supported: ["repository", "branches", "pull-requests", "workflows", "check-state"],
          missing: ["unbounded-history", "provider-job-logs"],
        },
        coverage: {
          state: snapshot ? "BOUNDED_CURRENT" : "NO_CURRENT_OBSERVATION",
          summary: snapshot
            ? "Bounded current repository data is observed."
            : "No current GitHub observation is available.",
          limitation: "GitHub collection is bounded by configured branch and pull-request limits.",
        },
        failure: githubHealth.detail
          ? {
              classification: "SOURCE_UNREACHABLE",
              diagnostic: githubHealth.detail,
            }
          : null,
        repairability: githubHealth.detail ? "AUTOMATIC_RETRY" : "NOT_APPLICABLE",
        servingRetainedStaleData: githubHealth.state === "DEGRADED" && Boolean(snapshot),
      },
      {
        ...projectTruthHealth,
        sourceId: "local-repository-evidence",
        expected: true,
        configurationSource: "Bridgewatch repository root",
        authorityLevel: "AUTHORITATIVE_GOVERNING_AND_REGISTRY",
        schemaVersion: "document-index-and-git-ref-1",
        sourceOccurrenceAt: projectTruthHealth.lastSuccessAt,
        bridgewatchObservedAt: inspectedAt,
        records: {
          received:
            projectTruthCollection.documentCount === null || projectTruthCollection.branchCount === null
              ? null
              : projectTruthCollection.documentCount + projectTruthCollection.branchCount,
          retained: counts.projects,
          exposed: projects.length,
          displayed: projects.length,
        },
        capabilityClasses: {
          supported: ["governing-document-discovery", "project-registry", "phase-version-evidence", "local-git-refs"],
          missing: ["unindexed-private-records", "full-historical-universe"],
        },
        coverage: {
          state: projectTruthHealth.reachable ? "PARTIAL_COVERAGE" : "OBSERVATION_FAILED",
          summary: projectTruthHealth.reachable
            ? "Indexed records are reconciled; unavailable historical evidence is not inferred."
            : "Repository evidence could not be read during the latest attempt.",
          limitation: "Only bounded indexed documents and fixed read-only refs are consumed.",
        },
        failure: projectTruthHealth.detail
          ? {
              classification: "SOURCE_UNREACHABLE",
              diagnostic: projectTruthHealth.detail,
            }
          : null,
        repairability: projectTruthHealth.detail ? "AUTOMATIC_RETRY" : "NOT_APPLICABLE",
        servingRetainedStaleData: projectTruthHealth.state === "DEGRADED" && counts.projects > 0,
      },
      {
        ...soundingHealth,
        sourceId: "sounding-line-runtime-projection",
        expected: true,
        configurationSource: "repository-owned status-projection adapter",
        authorityLevel: "AUTHORITATIVE_RUNTIME_PROJECTION",
        schemaVersion: "sounding-line-runtime-v1",
        sourceOccurrenceAt: soundingLineProjection?.observedAt ?? null,
        bridgewatchObservedAt: inspectedAt,
        records: {
          received: soundingLineProjection?.plans.length ?? null,
          retained: counts.runs,
          exposed: counts.runs,
          displayed: counts.runs,
        },
        capabilityClasses: {
          supported: ["runtime-plans", "nodes", "leases", "final-decisions-when-projected"],
          missing: soundingUnknownOnly
            ? ["current-plan-identity", "current-node-evidence"]
            : ["historical-unrecorded-provider-logs"],
        },
        coverage: {
          state: soundingUnknownOnly
            ? "HISTORICAL_EVIDENCE_UNAVAILABLE"
            : soundingLineProjection
              ? "BOUNDED_CURRENT"
              : "NO_CURRENT_OBSERVATION",
          summary: soundingUnknownOnly
            ? "Only retained unknown legacy plan markers are available; current plan identity and nodes were not recorded."
            : soundingLineProjection
              ? "Available runtime projection is retained without inferring absent evidence."
              : "No Sounding Line projection is currently available.",
          limitation: "Bridgewatch cannot reconstruct plan or node evidence that the projection never retained.",
        },
        failure: soundingStatus.failure
          ? {
              classification: soundingStatus.failure,
              diagnostic: soundingStatus.diagnostic ?? "Projection unavailable",
            }
          : null,
        repairability: soundingStatus.failure ? "AUTOMATIC_RETRY" : "NOT_APPLICABLE",
        servingRetainedStaleData: soundingHealth.state === "DEGRADED" && Boolean(soundingLineProjection),
      },
      {
        ...reporterHealth,
        sourceId: "bridgewatch-activity-telemetry",
        expected: true,
        configurationSource: "BRIDGEWATCH_TELEMETRY_TOKEN",
        authorityLevel: "PROVISIONAL_ACTIVITY_ONLY",
        schemaVersion: "telemetry-heartbeat-v1",
        sourceOccurrenceAt: reporterObservedAt,
        bridgewatchObservedAt: inspectedAt,
        records: {
          received: workers.length,
          retained: counts.workers,
          exposed: workers.length,
          displayed: workers.length,
        },
        capabilityClasses: {
          supported: config.BRIDGEWATCH_TELEMETRY_TOKEN ? ["worker-heartbeats", "retained-activity"] : [],
          missing: config.BRIDGEWATCH_TELEMETRY_TOKEN ? ["project-lifecycle-authority"] : ["worker-heartbeats"],
        },
        coverage: {
          state: !config.BRIDGEWATCH_TELEMETRY_TOKEN
            ? "SOURCE_NOT_CONFIGURED"
            : workers.length
              ? "BOUNDED_CURRENT"
              : counts.workers
                ? "RETAINED_HISTORY_NO_ACTIVE_WORKER"
                : "SOURCE_RETURNED_NO_DATA",
          summary: !config.BRIDGEWATCH_TELEMETRY_TOKEN
            ? "Activity telemetry is not configured."
            : workers.length
              ? "Current reporter activity is retained."
              : counts.workers
                ? "No active worker is reported; retained worker history remains available."
                : "Reporter is configured but no activity has been received.",
          limitation: "Reporter telemetry never establishes lifecycle, release, or project-completion truth.",
        },
        failure: null,
        repairability: !config.BRIDGEWATCH_TELEMETRY_TOKEN ? "CONFIGURATION_REQUIRED" : "NOT_APPLICABLE",
        servingRetainedStaleData: reporterHealth.state === "STALE" && counts.workers > 0,
      },
      ...fabric.sources.map(
        (source): SourceProfile => ({
          name: source.id,
          state: source.state,
          configured: source.configured,
          reachable: source.reachable,
          lastAttemptAt: source.lastAttemptAt,
          lastSuccessAt: source.lastSuccessAt,
          nextRetryAt: null,
          detail: source.failure,
          cacheAgeMs: source.cacheAgeMs,
          authenticationState: "NOT_APPLICABLE",
          sourceId: `p2:${source.id}`,
          expected: true,
          configurationSource: "fixed Bridgewatch P2 adapter",
          authorityLevel: source.authority,
          schemaVersion: "bridgewatch-p2-fabric-1",
          sourceOccurrenceAt: source.lastSuccessAt,
          bridgewatchObservedAt: fabric.observedAt,
          records: {
            received: source.facts.length,
            retained: source.facts.length,
            exposed: source.facts.length,
            displayed: source.facts.length,
          },
          capabilityClasses: {
            supported: source.expectedFactClasses,
            missing: source.facts
              .filter((item) => !["AUTHORITATIVE", "PROVISIONAL"].includes(item.state))
              .map((item) => item.factClass),
          },
          coverage: {
            state: source.facts.some((item) => item.state === "SOURCE_UNAVAILABLE")
              ? "OBSERVATION_FAILED"
              : source.facts.some((item) => item.state === "STALE")
                ? "RETAINED_STALE"
                : source.facts.some((item) => item.state === "UNKNOWN")
                  ? "SOURCE_NOT_CONFIGURED"
                  : "BOUNDED_CURRENT",
            summary: `${source.facts.length} explicit P2 fact class${source.facts.length === 1 ? "" : "es"} observed.`,
            limitation: source.facts.map((item) => item.limitation).find(Boolean) ?? null,
          },
          failure: source.failure ? { classification: "SOURCE_UNREACHABLE", diagnostic: source.failure } : null,
          repairability: source.failure
            ? "AUTOMATIC_RETRY"
            : source.configured
              ? "NOT_APPLICABLE"
              : "CONFIGURATION_REQUIRED",
          servingRetainedStaleData: source.servingRetainedStaleData,
        }),
      ),
    ];
    const branches = annotateBranches(snapshot?.branches ?? [], projects, config);
    const attention = deriveOperatorAttention({
      sources,
      facts: fabric.facts,
      branches,
      pullRequests: snapshot?.pullRequests ?? [],
      plans: (soundingLineProjection?.plans ?? []).map((plan) => ({
        id: plan.id,
        state: plan.state,
        createdAt: plan.createdAt,
        sourceSha: plan.sourceSha,
        finalDecision: plan.finalDecision,
        nodes: plan.nodes.map((node) => ({
          id: node.id,
          state: node.state,
          rootFailureId: node.rootFailureId,
        })),
      })),
      workers,
      historyWarning,
      candidateStaleAfterMs: config.BRIDGEWATCH_REVIEW_BRANCH_STALE_MS,
    });
    return {
      generatedAt: new Date().toISOString(),
      mode: "READ_ONLY",
      source: { name: "github", state: githubHealth.state, observedAt },
      currentMain,
      program: programTotals(projects, snapshot?.openPullRequests.length ?? 0, workers, totals),
      projects: projects.map((project) => ({
        ...project,
        milestonePercent: projectProgress(project).percent,
        milestoneState: projectProgress(project).state,
        phaseProgress: (() => {
          const total = project.declaredPhaseCount ?? project.phases.length;
          const completed = project.phases.filter((phase) => ["COMPLETE", "MERGED"].includes(phase.state)).length;
          return total
            ? { state: "MEASURED", completed, total }
            : { state: "NOT_RECORDED", completed: null, total: null };
        })(),
        mainSha: project.finalMainSha ?? null,
      })),
      github: snapshot,
      branches,
      history: {
        warning: historyWarning,
        recent: store.history({ since: sinceHours(12), limit: 12 }).events,
      },
      dataFabric: {
        ...fabric,
        warning: fabricWarning,
      },
      workers,
      tests: {
        projection: soundingLineProjection,
        totals,
        history: store.recentTestRuns(),
      },
      nightwatch,
      attention,
      sources,
    };
  };

  const historyFor = (query: HistoryParameters): HistoryQuery => {
    const now = Date.now();
    const since = query.since ?? new Date(now - twelveHours).toISOString();
    const sinceMs = Date.parse(since);
    const until = query.until;
    const untilMs = until ? Date.parse(until) : now;
    if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs)) throw new Error("Invalid history timestamp");
    if (sinceMs > untilMs || sinceMs > now + 60_000 || untilMs > now + 60_000)
      throw new Error("History range cannot be in the future or negative");
    if (untilMs - sinceMs > config.BRIDGEWATCH_HISTORY_MAX_RANGE_HOURS * 3_600_000)
      throw new Error("History range exceeds Bridgewatch bounds");
    if (query.kind && !eventKinds.has(query.kind as BridgewatchEventKind))
      throw new Error("Unknown historical event kind");
    const requestedLimit = query.limit ? Number(query.limit) : config.BRIDGEWATCH_HISTORY_PAGE_SIZE;
    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > config.BRIDGEWATCH_HISTORY_PAGE_SIZE
    )
      throw new Error("History page limit is outside Bridgewatch bounds");
    return {
      since: new Date(sinceMs).toISOString(),
      until: until ? new Date(untilMs).toISOString() : undefined,
      projectId: query.project,
      phaseId: query.phase,
      kind: query.kind as BridgewatchEventKind | undefined,
      limit: requestedLimit,
      cursor: query.cursor,
    };
  };
  const sendHistory = (
    query: HistoryParameters,
    reply: { code: (code: number) => { send: (body: unknown) => unknown } },
  ) => {
    try {
      const parsed = historyFor(query);
      const page = store.history(parsed);
      return {
        since: parsed.since,
        until: parsed.until ?? new Date().toISOString(),
        ...page,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid history query",
      });
    }
  };
  const sendComparison = (
    query: ComparisonParameters,
    reply: { code: (code: number) => { send: (body: unknown) => unknown } },
  ) => {
    try {
      const now = Date.now();
      const fromMs = Date.parse(query.from ?? "");
      const toMs = query.to ? Date.parse(query.to) : now;
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs || toMs > now + 60_000)
        throw new Error("Invalid comparison window");
      if (
        toMs - fromMs >
        Math.max(config.BRIDGEWATCH_HISTORY_MAX_RANGE_HOURS, config.BRIDGEWATCH_ROLLUP_RETENTION_DAYS * 24) * 3_600_000
      )
        throw new Error("Comparison range exceeds Bridgewatch bounds");
      const page = store.history({
        since: new Date(fromMs).toISOString(),
        until: new Date(toMs).toISOString(),
        limit: config.BRIDGEWATCH_HISTORY_PAGE_SIZE,
      });
      const rollups = store.dailyRollupsBetween(new Date(fromMs).toISOString(), new Date(toMs).toISOString());
      const fidelity = page.nextCursor ? "COARSE" : page.events.length || !rollups.length ? "EXACT" : "ROLLUP";
      const comparison = compareProgramHistory(
        page.events,
        new Date(fromMs).toISOString(),
        new Date(toMs).toISOString(),
        fidelity,
      );
      return rollups.length && fidelity !== "EXACT"
        ? { ...comparison, rollups, coarse: summarizeRollups(rollups) }
        : comparison;
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid comparison query",
      });
    }
  };

  app.get("/healthz", async () => ({ status: "ok", mode: "READ_ONLY" }));
  app.get("/readyz", async (_request, reply) => {
    const ready = Boolean(collector.cached());
    reply.code(ready ? 200 : 503);
    return { ready, source: ready ? "cached" : "not-collected" };
  });
  app.get("/api/summary", async () => summary());
  app.get("/api/program", async () => ({
    summary: summary().program,
    currentMain: summary().currentMain,
    discoveredProjects: store.discoveredProjects(),
    acceptedHistory: programTrends(store.projects()).acceptedTimeline,
  }));
  app.get("/api/projects", async () => summary().projects);
  app.get<{ Params: { id: string } }>("/api/projects/:id/versions", async (request, reply) => {
    const project = store.projects().find((entry) => entry.id === request.params.id);
    if (!project) return reply.code(404).send({ error: "Unknown project" });
    return project.versions ?? [];
  });
  app.get<{ Params: { id: string; version: string } }>(
    "/api/projects/:id/versions/:version",
    async (request, reply) => {
      const project = store.projects().find((entry) => entry.id === request.params.id);
      if (!project) return reply.code(404).send({ error: "Unknown project" });
      const version = project.versions?.find((entry) => entry.identity === request.params.version);
      if (!version) return reply.code(404).send({ error: "Unknown project version" });
      const snapshot = collector.cached();
      return {
        projectId: project.id,
        project: { id: project.id, name: project.name, state: project.state },
        version,
        phases: project.phases.filter((phase) => phase.integratedMainSha === version.integratedMainSha),
        branches: (snapshot?.branches ?? []).filter((branch) =>
          versionMatches(branch.name, project.id, version.identity),
        ),
        pullRequests: (snapshot?.pullRequests ?? []).filter((pull) =>
          versionMatches(`${pull.title} ${pull.headRef ?? ""}`, project.id, version.identity),
        ),
        history: store.projectHistory(project.id),
        evidence: version.evidence,
      };
    },
  );
  app.get<{ Params: { id: string; ordinal: string } }>("/api/projects/:id/phases/:ordinal", async (request, reply) => {
    const project = store.projects().find((entry) => entry.id === request.params.id);
    const ordinal = Number(request.params.ordinal);
    if (!project || !Number.isInteger(ordinal)) return reply.code(404).send({ error: "Unknown project phase" });
    const phase = project.phases.find((entry) => entry.ordinal === ordinal);
    if (!phase) return reply.code(404).send({ error: "Unknown project phase" });
    const workers = summary().workers.filter(
      (worker) => worker.project === project.id && worker.phase === String(phase.ordinal),
    );
    const tests = store
      .recentTestRuns()
      .filter(
        (run) => run.value.sourceSha === phase.acceptedHeadSha || run.value.sourceSha === phase.integratedMainSha,
      );
    const tasks: TaskRecord[] = workers.map((worker) => ({
      id: `${worker.workerId}:${worker.startedAt}`,
      title: worker.task,
      projectId: project.id,
      phaseId: phase.id,
      workerId: worker.workerId,
      branch: worker.branch,
      startedAt: worker.startedAt,
      heartbeatAt: worker.heartbeatAt,
      finishedAt: worker.state === "FINISHED" ? worker.heartbeatAt : undefined,
      result: worker.effectiveState ?? worker.state,
      sourceSha: worker.sourceSha,
      evidence: [`telemetry:${worker.workerId}:${worker.heartbeatAt}`],
    }));
    return {
      projectId: project.id,
      project: { id: project.id, name: project.name, state: project.state },
      phase,
      workers,
      tasks,
      tests,
      history: store.projectHistory(project.id).filter((event) => event.phaseId === phase.id),
      evidence: [phase.completionReceipt, ...project.governingReferences].filter(Boolean),
    };
  });
  app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const project = summary().projects.find((entry) => entry.id === request.params.id);
    if (!project) return reply.code(404).send({ error: "Unknown project" });
    const snapshot = collector.cached();
    const branches = annotateBranches(snapshot?.branches ?? [], store.projects(), config).filter(
      (branch) => branch.projectId === project.id,
    );
    const pullRequests = (snapshot?.pullRequests ?? []).filter((pull) =>
      associationsFor(`${pull.title} ${pull.headRef ?? ""}`, store.projects(), pull.number).projectIds.includes(
        project.id,
      ),
    );
    const phaseShas = new Set(
      project.phases.flatMap((phase) => [phase.acceptedHeadSha, phase.integratedMainSha]).filter(Boolean),
    );
    return {
      ...project,
      branches,
      pullRequests,
      workers: summary().workers.filter((worker) => worker.project === project.id),
      tests: store.recentTestRuns().filter((run) => run.value.sourceSha && phaseShas.has(run.value.sourceSha)),
      history: store.projectHistory(project.id),
      evidence: project.governingReferences,
    };
  });
  app.get<{ Querystring: HistoryParameters }>("/api/history", async (request, reply) =>
    sendHistory(request.query, reply),
  );
  app.get<{ Querystring: ComparisonParameters }>("/api/compare", async (request, reply) =>
    sendComparison(request.query, reply),
  );
  app.get<{ Params: { id: string }; Querystring: HistoryParameters }>(
    "/api/projects/:id/history",
    async (request, reply) => {
      if (!summary().projects.some((project) => project.id === request.params.id))
        return reply.code(404).send({ error: "Unknown project" });
      return sendHistory(
        {
          ...request.query,
          project: request.params.id,
          since:
            request.query.since ??
            new Date(Date.now() - config.BRIDGEWATCH_HISTORY_MAX_RANGE_HOURS * 3_600_000).toISOString(),
        },
        reply,
      );
    },
  );
  app.get("/api/trends", async () => programTrends(store.projects()));
  app.get<{ Params: { id: string } }>("/api/projects/:id/trends", async (request, reply) => {
    const project = store.projects().find((entry) => entry.id === request.params.id);
    if (!project) return reply.code(404).send({ error: "Unknown project" });
    return projectTrend(project);
  });
  app.get<{ Querystring: { order?: string } }>("/api/archive", async (request, reply) => {
    if (request.query.order && !["chronological", "name"].includes(request.query.order))
      return reply.code(400).send({ error: "Archive order must be chronological or name" });
    return archive(store.projects(), request.query.order === "name" ? "name" : "chronological");
  });
  app.get<{ Querystring: PullRequestParameters }>("/api/pull-requests", async (request, reply) => {
    const state = (request.query.state ?? "ALL").toUpperCase();
    if (!["ALL", "OPEN", "HISTORICAL", "MERGED", "CLOSED"].includes(state))
      return reply.code(400).send({
        error: "Pull-request state must be ALL, OPEN, HISTORICAL, MERGED, or CLOSED",
      });
    const pulls = collector.cached()?.pullRequests ?? [];
    return pulls.filter(
      (pull) => state === "ALL" || (state === "HISTORICAL" ? pull.state !== "OPEN" : pull.state === state),
    );
  });
  app.get<{ Params: { number: string } }>("/api/pull-requests/:number", async (request, reply) => {
    const number = Number(request.params.number);
    if (!Number.isInteger(number) || number < 1) return reply.code(404).send({ error: "Unknown pull request" });
    const pullRequest = (collector.cached()?.pullRequests ?? []).find((entry) => entry.number === number);
    if (!pullRequest) return reply.code(404).send({ error: "Unknown pull request" });
    return {
      pullRequest,
      associations: associationsFor(`${pullRequest.title} ${pullRequest.headRef ?? ""}`, store.projects(), number),
      history: store
        .history({ since: "1970-01-01T00:00:00.000Z", limit: 100 })
        .events.filter((event) => event.entityType === "pull-request" && event.entityId === String(number)),
      evidence: [`github:${config.BRIDGEWATCH_REPOSITORY}:pull:${number}`],
    };
  });
  app.get("/api/branches", async () => annotateBranches(collector.cached()?.branches ?? [], store.projects(), config));
  app.get<{ Querystring: BranchProfileParameters }>("/api/branches/profile", async (request, reply) => {
    const name = request.query.name;
    if (!name) return reply.code(400).send({ error: "Branch name is required" });
    const branch = annotateBranches(collector.cached()?.branches ?? [], store.projects(), config).find(
      (entry) => entry.name === name,
    );
    if (!branch) return reply.code(404).send({ error: "Unknown branch" });
    const pullRequest = (collector.cached()?.pullRequests ?? []).find(
      (entry) => entry.number === branch.pullRequestNumber,
    );
    return {
      branch,
      pullRequest: pullRequest ?? null,
      associations: associationsFor(branch.name, store.projects(), branch.pullRequestNumber ?? undefined),
      history: store
        .history({ since: "1970-01-01T00:00:00.000Z", limit: 100 })
        .events.filter((event) => event.entityType === "branch" && event.entityId === name),
      evidence: [`github:${config.BRIDGEWATCH_REPOSITORY}:branch:${name}`],
    };
  });
  app.get("/api/actions", async () => collector.cached()?.workflows ?? []);
  app.get("/api/workers", async () => summary().workers);
  app.get("/api/tests", async () => summary().tests);
  app.get("/api/nightwatch", async () => summary().nightwatch);
  app.get("/api/attention", async () => summary().attention);
  app.get<{ Querystring: { since?: string } }>("/api/activity", async (request, reply) => {
    const since = request.query.since;
    if (since && Number.isNaN(Date.parse(since))) return reply.code(400).send({ error: "Invalid since timestamp" });
    return summary().workers.filter((worker) => !since || Date.parse(worker.heartbeatAt) >= Date.parse(since));
  });
  app.get("/api/sources", async () => summary().sources);
  app.get<{ Params: { name: string } }>("/api/sources/:name", async (request, reply) => {
    const source = summary().sources.find((entry) => entry.name === request.params.name);
    if (!source) return reply.code(404).send({ error: "Unknown source" });
    return {
      source,
      recentEvents: store
        .history({ since: "1970-01-01T00:00:00.000Z", limit: 100 })
        .events.filter((event) => event.source === request.params.name || event.entityId === request.params.name),
    };
  });
  app.get("/api/facts", async () => {
    const fabric = summary().dataFabric;
    return {
      observedAt: fabric.observedAt,
      warning: fabric.warning,
      sources: fabric.sources,
      facts: fabric.facts,
      coverage: fabric.coverage,
    };
  });
  app.get("/api/coverage", async () => summary().dataFabric.coverage);
  app.get<{ Params: { key: string } }>("/api/facts/:key", async (request, reply) => {
    const fabric = summary().dataFabric;
    const current =
      fabric.facts.find((entry) => entry.key === request.params.key) ??
      store.fabricFacts().find((entry) => entry.key === request.params.key);
    if (!current) return reply.code(404).send({ error: "Unknown data-fabric fact" });
    return { fact: current, history: store.fabricFactHistory(current.key) };
  });
  app.get("/api/sounding-line/runs", async () => store.recentTestRuns());
  app.get<{ Params: { id: string } }>("/api/sounding-line/runs/:id", async (request, reply) => {
    const run = store.recentTestRuns(100).find((entry) => entry.id === request.params.id);
    if (!run) return reply.code(404).send({ error: "Unknown Sounding Line run" });
    return {
      run,
      associations: associationsFor(run.value.sourceSha ?? "", store.projects()),
      history: store
        .history({ since: "1970-01-01T00:00:00.000Z", limit: 100 })
        .events.filter((event) => event.entityType === "sounding-line-run" && event.entityId === run.id),
      evidence: [`sounding-line:${run.id}`],
    };
  });

  const acceptsTelemetry = (
    request: {
      headers: { authorization?: string };
      query: Record<string, unknown>;
      ip: string;
    },
    reply: { code: (code: number) => { send: (body: unknown) => unknown } },
  ) => {
    if (Object.keys(request.query).some((key) => /token|authorization/iu.test(key)))
      return reply.code(400).send({ error: "Telemetry credentials are header-only" });
    if (!authorizeTelemetry(request.headers.authorization, config.BRIDGEWATCH_TELEMETRY_TOKEN))
      return reply.code(401).send({ error: "Unauthorized" });
    const now = Date.now();
    const window = telemetryWindows.get(request.ip);
    const current = !window || now - window.startedAt >= 60_000 ? { startedAt: now, count: 0 } : window;
    current.count += 1;
    telemetryWindows.set(request.ip, current);
    if (current.count > 60) return reply.code(429).send({ error: "Telemetry rate limit exceeded" });
    return null;
  };
  app.post<{ Body: unknown; Querystring: Record<string, unknown> }>(
    "/api/telemetry/heartbeat",
    async (request, reply) => {
      const denied = acceptsTelemetry(request, reply);
      if (denied) return denied;
      try {
        const worker = parseHeartbeat(request.body);
        store.upsertWorker(worker);
        persistHistory(false);
        return reply.code(202).send({
          accepted: true,
          workerId: worker.workerId,
          activityOnly: true,
        });
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Invalid telemetry",
        });
      }
    },
  );
  app.post<{ Body: unknown; Querystring: Record<string, unknown> }>("/api/telemetry/finish", async (request, reply) => {
    const denied = acceptsTelemetry(request, reply);
    if (denied) return denied;
    try {
      const worker = parseHeartbeat({
        ...(request.body as object),
        state: "FINISHED",
      });
      store.upsertWorker(worker, true);
      persistHistory(false);
      return reply.code(202).send({
        accepted: true,
        workerId: worker.workerId,
        activityOnly: true,
      });
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid telemetry",
      });
    }
  });
  app.register(fastifyStatic, {
    root: join(process.cwd(), "public"),
    prefix: "/",
  });
  app.addHook("onClose", async () => store.close());
  return {
    app,
    config,
    store,
    collector,
    soundingLine,
    refreshSources,
    refreshSoundingLine,
  };
}

function sourceState(observedAt: string | null, staleAfterMs: number) {
  if (!observedAt) return "UNAVAILABLE";
  return Date.now() - Date.parse(observedAt) > staleAfterMs ? "STALE" : "HEALTHY";
}

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function versionMatches(value: string, projectId: string, version: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes(projectId.toLowerCase()) && normalized.includes(version.toLowerCase());
}

function associationsFor(value: string, projects: ProjectRecord[], pullRequestNumber?: number) {
  const normalized = value.toLowerCase();
  const matched = projects.filter(
    (project) => normalized.includes(project.id.toLowerCase()) || normalized.includes(project.name.toLowerCase()),
  );
  return {
    projectIds: matched.map((project) => project.id).sort(),
    versionIds: matched
      .flatMap((project) =>
        (project.versions ?? [])
          .filter((version) => versionMatches(value, project.id, version.identity))
          .map((version) => `${project.id}:${version.identity}`),
      )
      .sort(),
    phaseIds: projects
      .flatMap((project) => project.phases)
      .filter(
        (phase) =>
          phase.branch === value || (pullRequestNumber !== undefined && phase.pullRequest === pullRequestNumber),
      )
      .map((phase) => phase.id)
      .sort(),
  };
}

export function annotateBranches(
  branches: NonNullable<ReturnType<GithubCollector["cached"]>>["branches"],
  projects: ProjectRecord[],
  config: ReturnType<typeof loadConfig>,
) {
  return branches.map((branch) => {
    const phase = projects
      .flatMap((project) => project.phases.map((entry) => ({ project, phase: entry })))
      .find((entry) => entry.phase.branch === branch.name);
    const merged = branch.pullRequestState === "MERGED" || ["MERGED", "COMPLETE"].includes(phase?.phase.state ?? "");
    const review = branch.pullRequestState === "OPEN" || phase?.phase.state === "REVIEW";
    const ageMs = branch.lastActivityAt ? Math.max(0, Date.now() - Date.parse(branch.lastActivityAt)) : null;
    const stale =
      !merged &&
      ageMs !== null &&
      ageMs > (review ? config.BRIDGEWATCH_REVIEW_BRANCH_STALE_MS : config.BRIDGEWATCH_BRANCH_STALE_MS);
    const behind = !merged && (branch.behind ?? 0) >= config.BRIDGEWATCH_BRANCH_BEHIND_THRESHOLD;
    const reason = behind ? "BRANCH_BEHIND_MAIN" : "BRANCH_STALE";
    return {
      ...branch,
      projectId: phase?.project.id ?? null,
      phaseId: phase?.phase.id ?? null,
      merged,
      ageMs,
      stale,
      attention: stale || behind,
      reason: stale || behind ? reason : null,
      message: behind
        ? `${branch.name} is ${branch.behind} commits behind ${branch.defaultSha ?? "current main"}.`
        : stale
          ? `${branch.name} has no observed activity within its governed lifecycle threshold.`
          : null,
    };
  });
}

function archive(projects: ProjectRecord[], order: "chronological" | "name") {
  const entries = projects
    .filter((project) => project.state === "COMPLETE")
    .map((project) => ({
      ...project,
      completionDate: completionDate(project),
      phaseTimeline: projectTrend(project).phases,
    }));
  return entries.sort((left, right) =>
    order === "name"
      ? left.name.localeCompare(right.name)
      : (right.completionDate ?? "").localeCompare(left.completionDate ?? "") || left.name.localeCompare(right.name),
  );
}

function completionDate(project: ProjectRecord): string | null {
  return (
    project.phases
      .flatMap((phase) => [phase.completedAt, phase.mergedAt, phase.acceptedAt])
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );
}

function projectTrend(project: ProjectRecord) {
  return {
    projectId: project.id,
    lifecycle: project.phases
      .flatMap((phase) =>
        [
          ["PLANNED", phase.plannedAt],
          ["STARTED", phase.startedAt],
          ["ACCEPTED", phase.acceptedAt],
          ["MERGED", phase.mergedAt],
          ["COMPLETED", phase.completedAt],
        ].map(([state, at]) => (typeof at === "string" ? { at, state, phaseId: phase.id, phase: phase.name } : null)),
      )
      .filter(
        (
          entry,
        ): entry is {
          at: string;
          state: string;
          phaseId: string;
          phase: string;
        } => Boolean(entry),
      )
      .sort((left, right) => left.at.localeCompare(right.at)),
    phases: project.phases.map((phase) => ({
      id: phase.id,
      ordinal: phase.ordinal,
      name: phase.name,
      state: phase.state,
      startedAt: phase.startedAt ?? null,
      acceptedAt: phase.acceptedAt ?? null,
      mergedAt: phase.mergedAt ?? null,
      completedAt: phase.completedAt ?? null,
      branch: phase.branch ?? null,
      pullRequest: phase.pullRequest ?? null,
      acceptedHeadSha: phase.acceptedHeadSha ?? null,
      integratedMainSha: phase.integratedMainSha ?? null,
      finalDecision: phase.finalDecision ?? null,
      milestones: phase.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        state: milestone.state,
        acceptedAt: milestone.acceptedAt ?? null,
      })),
    })),
  };
}

function programTrends(projects: ProjectRecord[]) {
  const completions = projects
    .filter((project) => project.state === "COMPLETE")
    .map((project) => ({ projectId: project.id, at: completionDate(project) }))
    .filter((entry): entry is { projectId: string; at: string } => Boolean(entry.at))
    .sort((left, right) => left.at.localeCompare(right.at));
  const phases = projects
    .flatMap((project) =>
      project.phases.map((phase) => ({
        projectId: project.id,
        phaseId: phase.id,
        at: phase.acceptedAt ?? phase.mergedAt ?? phase.completedAt ?? null,
      })),
    )
    .filter((entry): entry is { projectId: string; phaseId: string; at: string } => Boolean(entry.at))
    .sort((left, right) => left.at.localeCompare(right.at));
  const acceptedTimeline = [
    ...completions.map((entry) => ({
      ...entry,
      type: "PROJECT_COMPLETE" as const,
    })),
    ...phases.map((entry) => ({ ...entry, type: "PHASE_ACCEPTED" as const })),
  ]
    .sort((left, right) => left.at.localeCompare(right.at) || left.type.localeCompare(right.type))
    .map((entry, index, timeline) => {
      const earlier = timeline.slice(0, index + 1);
      const projectsComplete = earlier.filter((candidate) => candidate.type === "PROJECT_COMPLETE").length;
      const phasesAccepted = earlier.filter((candidate) => candidate.type === "PHASE_ACCEPTED").length;
      return {
        ...entry,
        projectsComplete,
        phasesAccepted,
        summary:
          entry.type === "PROJECT_COMPLETE"
            ? `${entry.projectId} completed`
            : `${entry.projectId} / ${entry.phaseId} accepted or integrated`,
      };
    });
  return {
    projectsCompleted: completions.map((entry, index) => ({
      ...entry,
      cumulative: index + 1,
    })),
    phasesAccepted: phases.map((entry, index) => ({
      ...entry,
      cumulative: index + 1,
    })),
    acceptedProjectTimeline: completions,
    acceptedTimeline,
  };
}

function programTotals(
  projects: ReturnType<BridgewatchStore["projects"]>,
  openPullRequests: number,
  workers: Array<{ effectiveState: string }>,
  tests: ReturnType<typeof testTotals>,
) {
  const phases = projects.flatMap((project) => project.phases);
  const milestones = phases.flatMap((phase) => phase.milestones);
  return {
    projects: {
      total: projects.length,
      complete: projects.filter((project) => project.state === "COMPLETE").length,
      active: projects.filter((project) =>
        ["ACTIVE", "TESTING", "REVIEW", "WAITING", "STALE", "MERGED"].includes(project.state),
      ).length,
      planned: projects.filter((project) => project.state === "PLANNED").length,
      blocked: projects.filter((project) => project.state === "BLOCKED").length,
      externalPending: projects.filter((project) => project.state === "EXTERNAL_PENDING").length,
    },
    phases: {
      total: phases.length,
      completeOrMerged: phases.filter((phase) => ["COMPLETE", "MERGED"].includes(phase.state)).length,
      active: phases.filter((phase) => ["ACTIVE", "TESTING", "REVIEW", "WAITING", "STALE"].includes(phase.state))
        .length,
      planned: phases.filter((phase) => phase.state === "PLANNED").length,
      blocked: phases.filter((phase) => phase.state === "BLOCKED").length,
    },
    milestones: {
      completed: milestones.filter((milestone) => milestone.state === "ACCEPTED").length,
      total: milestones.length,
    },
    operational: {
      openPullRequests,
      activeWorkers: workers.filter((worker) => ["WORKING", "TESTING"].includes(worker.effectiveState)).length,
      activeTestNodes: tests.running,
      rootFailures: tests.rootFailures,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app, config, refreshSources, refreshSoundingLine } = buildServer();
  await refreshSources();
  const sourceTimer = setInterval(() => void refreshSources(), config.BRIDGEWATCH_SNAPSHOT_INTERVAL_MS);
  const soundingLineTimer = setInterval(
    () => void refreshSoundingLine(),
    config.BRIDGEWATCH_SOUNDING_LINE_POLL_INTERVAL_MS,
  );
  app.addHook("onClose", async () => {
    clearInterval(sourceTimer);
    clearInterval(soundingLineTimer);
  });
  await app.listen({
    host: config.BRIDGEWATCH_HOST,
    port: config.BRIDGEWATCH_PORT,
  });
}
