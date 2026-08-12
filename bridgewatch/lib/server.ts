import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "../src/config.js";
import { projectRegistry } from "../src/registry.js";
import { projectProgress, type ProjectRecord } from "../src/domain.js";
import { type BridgewatchEventKind, type BridgewatchProgramSnapshot } from "../src/history.js";
import { SoundingLineCollector, testTotals } from "../src/sounding-line.js";
import { authorizeTelemetry, parseHeartbeat, workerState } from "../src/telemetry.js";
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
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { redact: ["req.headers.authorization", "req.url"] },
    bodyLimit: config.BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES,
  });
  const soundingLine = new SoundingLineCollector(config, store);
  const telemetryWindows = new Map<string, { startedAt: number; count: number }>();
  let historyWarning: string | null = null;
  store.replaceProjectRegistry(projectRegistry);

  const observation = (): BridgewatchProgramSnapshot => ({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    projects: store.projects(),
    github: collector.cached(),
    workers: store
      .workers()
      .map((worker) => ({ ...worker, effectiveState: workerState(worker, config.BRIDGEWATCH_TELEMETRY_STALE_MS) })),
    soundingLine: soundingLine.cached(),
  });
  const persistHistory = () => {
    try {
      store.recordHistory(observation());
      historyWarning = null;
    } catch {
      historyWarning = "Historical persistence is unavailable; current source projections remain available.";
    }
  };
  const refreshSources = async () => {
    store.replaceProjectRegistry(projectRegistry);
    await Promise.all([collector.refresh(), soundingLine.refresh()]);
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
    const snapshot = collector.cached();
    const soundingLineProjection = soundingLine.cached();
    const projects = store.projects();
    const workers = store
      .workers()
      .map((worker) => ({ ...worker, effectiveState: workerState(worker, config.BRIDGEWATCH_TELEMETRY_STALE_MS) }));
    const totals = testTotals(soundingLineProjection);
    const observedAt = snapshot?.observedAt ?? null;
    const githubState = sourceState(observedAt, 60_000);
    const reporterObservedAt = workers.length
      ? workers.reduce(
          (latest, worker) => (Date.parse(worker.heartbeatAt) > Date.parse(latest) ? worker.heartbeatAt : latest),
          workers[0]!.heartbeatAt,
        )
      : null;
    const reporterState =
      workers.length === 0 ? "UNMEASURED" : sourceState(reporterObservedAt, config.BRIDGEWATCH_TELEMETRY_STALE_MS);
    const branches = annotateBranches(snapshot?.branches ?? [], projects, config);
    const attention = [
      ...(snapshot
        ? []
        : [{ level: "ACTION", code: "GITHUB_UNAVAILABLE", message: "No GitHub cache is available yet." }]),
      ...(historyWarning ? [{ level: "NOTICE", code: "HISTORY_UNAVAILABLE", message: historyWarning }] : []),
      ...workers
        .filter((worker) => worker.effectiveState === "BLOCKED")
        .map((worker) => ({
          level: "BLOCKED",
          projectId: worker.project,
          code: "WORKER_BLOCKED",
          message: `${worker.workerId} reports BLOCKED activity.`,
        })),
      ...workers
        .filter((worker) => worker.effectiveState === "STALE")
        .map((worker) => ({
          level: "NOTICE",
          projectId: worker.project,
          code: "WORKER_STALE",
          message: `${worker.workerId} has a stale heartbeat.`,
        })),
      ...branches
        .filter((branch) => branch.attention)
        .map((branch) => ({
          level: "AMBER",
          projectId: branch.projectId ?? undefined,
          code: branch.reason,
          message: branch.message,
        })),
      ...store.rootFailureRecurrences(sinceHours(config.BRIDGEWATCH_EVENT_RETENTION_DAYS * 24)).map((recurrence) => ({
        level: "AMBER",
        code: "ROOT_FAILURE_RECURRENCE",
        message: `${recurrence.rootFailureId} recurred ${recurrence.count} times in retained history; Sounding Line classification remains authoritative.`,
      })),
      ...rootAttention(soundingLineProjection),
      ...(soundingLineProjection?.plans
        .filter((plan) => plan.finalDecision === "RELEASE_NO_GO" || plan.finalDecision === "EVIDENCE_INVALID")
        .map((plan) => ({
          level: "BLOCKED",
          code: "SOUNDING_LINE_DECISION",
          message: `${plan.id} reports ${plan.finalDecision}.`,
        })) ?? []),
    ];
    return {
      generatedAt: new Date().toISOString(),
      mode: "READ_ONLY",
      source: { name: "github", state: githubState, observedAt },
      program: programTotals(projects, snapshot?.openPullRequests.length ?? 0, workers, totals),
      projects: projects.map((project) => ({
        ...project,
        milestonePercent: projectProgress(project).percent,
        milestoneState: projectProgress(project).state,
      })),
      github: snapshot,
      branches,
      history: { warning: historyWarning, recent: store.history({ since: sinceHours(12), limit: 12 }).events },
      workers,
      tests: { projection: soundingLineProjection, totals, history: store.recentTestRuns() },
      attention,
      sources: [
        { name: "github", state: githubState, observedAt },
        { name: "project-truth", state: "FRESH", observedAt: new Date().toISOString() },
        {
          name: "sounding-line",
          state: sourceState(soundingLineProjection?.observedAt ?? null, 10_000),
          observedAt: soundingLineProjection?.observedAt ?? null,
        },
        { name: "reporter", state: reporterState, observedAt: reporterObservedAt },
      ],
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
      return { since: parsed.since, until: parsed.until ?? new Date().toISOString(), ...page };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid history query" });
    }
  };

  app.get("/healthz", async () => ({ status: "ok", mode: "READ_ONLY" }));
  app.get("/readyz", async (_request, reply) => {
    const ready = Boolean(collector.cached());
    reply.code(ready ? 200 : 503);
    return { ready, source: ready ? "cached" : "not-collected" };
  });
  app.get("/api/summary", async () => summary());
  app.get("/api/projects", async () => summary().projects);
  app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const project = summary().projects.find((entry) => entry.id === request.params.id);
    if (!project) return reply.code(404).send({ error: "Unknown project" });
    return project;
  });
  app.get<{ Querystring: HistoryParameters }>("/api/history", async (request, reply) =>
    sendHistory(request.query, reply),
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
  app.get("/api/branches", async () => annotateBranches(collector.cached()?.branches ?? [], store.projects(), config));
  app.get("/api/pull-requests", async () => collector.cached()?.openPullRequests ?? []);
  app.get("/api/actions", async () => collector.cached()?.workflows ?? []);
  app.get("/api/workers", async () => summary().workers);
  app.get("/api/tests", async () => summary().tests);
  app.get("/api/attention", async () => summary().attention);
  app.get<{ Querystring: { since?: string } }>("/api/activity", async (request, reply) => {
    const since = request.query.since;
    if (since && Number.isNaN(Date.parse(since))) return reply.code(400).send({ error: "Invalid since timestamp" });
    return summary().workers.filter((worker) => !since || Date.parse(worker.heartbeatAt) >= Date.parse(since));
  });
  app.get("/api/sources", async () => summary().sources);

  const acceptsTelemetry = (
    request: { headers: { authorization?: string }; query: Record<string, unknown>; ip: string },
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
        persistHistory();
        return reply.code(202).send({ accepted: true, workerId: worker.workerId, activityOnly: true });
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid telemetry" });
      }
    },
  );
  app.post<{ Body: unknown; Querystring: Record<string, unknown> }>("/api/telemetry/finish", async (request, reply) => {
    const denied = acceptsTelemetry(request, reply);
    if (denied) return denied;
    try {
      const worker = parseHeartbeat({ ...(request.body as object), state: "FINISHED" });
      store.upsertWorker(worker, true);
      persistHistory();
      return reply.code(202).send({ accepted: true, workerId: worker.workerId, activityOnly: true });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid telemetry" });
    }
  });
  app.register(fastifyStatic, { root: join(process.cwd(), "public"), prefix: "/" });
  app.addHook("onClose", async () => store.close());
  return { app, config, store, collector, soundingLine, refreshSources, refreshSoundingLine };
}

function sourceState(observedAt: string | null, staleAfterMs: number) {
  if (!observedAt) return "UNAVAILABLE";
  return Date.now() - Date.parse(observedAt) > staleAfterMs ? "STALE" : "FRESH";
}

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function rootAttention(projection: ReturnType<SoundingLineCollector["cached"]>) {
  if (!projection) return [];
  const roots = new Map<string, number>();
  for (const node of projection.plans.flatMap((plan) => plan.nodes)) {
    if (node.state === "BLOCKED" && node.rootFailureId)
      roots.set(node.rootFailureId, (roots.get(node.rootFailureId) ?? 0) + 1);
    if (node.state === "FAILED")
      roots.set(node.rootFailureId ?? node.id, roots.get(node.rootFailureId ?? node.id) ?? 0);
  }
  return [...roots].map(([id, blocked]) => ({
    level: "BLOCKED",
    code: "ROOT_FAILURE",
    message: `${id}: 1 root failure${blocked ? `; ${blocked} blocked dependents` : ""}.`,
  }));
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
      .filter((entry): entry is { at: string; state: string; phaseId: string; phase: string } => Boolean(entry))
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
    ...completions.map((entry) => ({ ...entry, type: "PROJECT_COMPLETE" as const })),
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
    projectsCompleted: completions.map((entry, index) => ({ ...entry, cumulative: index + 1 })),
    phasesAccepted: phases.map((entry, index) => ({ ...entry, cumulative: index + 1 })),
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
  await app.listen({ host: config.BRIDGEWATCH_HOST, port: config.BRIDGEWATCH_PORT });
}
