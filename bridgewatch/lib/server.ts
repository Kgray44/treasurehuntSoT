import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "../src/config.js";
import { projectRegistry } from "../src/registry.js";
import { projectProgress } from "../src/domain.js";
import { SoundingLineCollector, testTotals } from "../src/sounding-line.js";
import { authorizeTelemetry, parseHeartbeat, workerState } from "../src/telemetry.js";
import { BridgewatchStore } from "./store.js";
import { GithubCollector } from "./github.js";

export function buildServer() {
  const config = loadConfig();
  const store = new BridgewatchStore(config.dbPath);
  const collector = new GithubCollector(config, store);
  const app = Fastify({
    logger: { redact: ["req.headers.authorization", "req.url"] },
    bodyLimit: config.BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES,
  });
  const soundingLine = new SoundingLineCollector(config, store);
  const telemetryWindows = new Map<string, { startedAt: number; count: number }>();
  store.replaceProjectRegistry(projectRegistry);
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
    const githubState = snapshot ? "FRESH" : "UNAVAILABLE";
    const reporterObservedAt = workers.length
      ? workers.reduce(
          (latest, worker) => (Date.parse(worker.heartbeatAt) > Date.parse(latest) ? worker.heartbeatAt : latest),
          workers[0]!.heartbeatAt,
        )
      : null;
    const reporterState =
      workers.length === 0
        ? "UNMEASURED"
        : workers.some((worker) => worker.effectiveState === "STALE")
          ? "STALE"
          : "FRESH";
    const attention = [
      ...(snapshot
        ? []
        : [{ level: "ACTION", code: "GITHUB_UNAVAILABLE", message: "No GitHub cache is available yet." }]),
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
      workers,
      tests: { projection: soundingLineProjection, totals, history: store.recentTestRuns() },
      attention,
      sources: [
        { name: "github", state: githubState, observedAt },
        { name: "project-truth", state: "FRESH", observedAt: new Date().toISOString() },
        {
          name: "sounding-line",
          state: soundingLineProjection ? "FRESH" : "UNAVAILABLE",
          observedAt: soundingLineProjection?.observedAt ?? null,
        },
        { name: "reporter", state: reporterState, observedAt: reporterObservedAt },
      ],
    };
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
      return reply.code(202).send({ accepted: true, workerId: worker.workerId, activityOnly: true });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid telemetry" });
    }
  });
  app.register(fastifyStatic, { root: join(process.cwd(), "public"), prefix: "/" });
  app.addHook("onClose", async () => store.close());
  return { app, config, collector, soundingLine };
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
  const { app, config, collector, soundingLine } = buildServer();
  await collector.refresh();
  await soundingLine.refresh();
  await app.listen({ host: config.BRIDGEWATCH_HOST, port: config.BRIDGEWATCH_PORT });
}
