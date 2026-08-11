import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { projectRegistry } from "../src/registry.js";
import { BridgewatchStore } from "./store.js";
import { GithubCollector } from "./github.js";

export function buildServer() {
  const config = loadConfig();
  const store = new BridgewatchStore(config.dbPath);
  const collector = new GithubCollector(config, store);
  const app = Fastify({ logger: true });
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
    const observedAt = snapshot?.observedAt ?? null;
    const state = snapshot ? "FRESH" : "UNAVAILABLE";
    return {
      generatedAt: new Date().toISOString(),
      mode: "READ_ONLY",
      source: { name: "github", state, observedAt },
      projects: projectRegistry.map((project) => ({
        ...project,
        milestonePercent: project.milestone
          ? Math.round((project.milestone.completed / project.milestone.total) * 100)
          : null,
        milestoneState: project.milestone ? "MEASURED" : "UNMEASURED",
        github: snapshot,
      })),
      attention: snapshot
        ? []
        : [{ level: "ACTION", code: "SOURCE_UNAVAILABLE", message: "No GitHub cache is available yet." }],
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
  app.get("/api/attention", async () => summary().attention);
  app.get("/api/sources", async () => [
    summary().source,
    { name: "registry", state: "FRESH", observedAt: new Date().toISOString() },
  ]);
  app.register(fastifyStatic, { root: join(process.cwd(), "public"), prefix: "/" });
  app.addHook("onClose", async () => store.close());
  return { app, config, collector };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app, config, collector } = buildServer();
  await collector.refresh();
  await app.listen({ host: config.BRIDGEWATCH_HOST, port: config.BRIDGEWATCH_PORT });
}
