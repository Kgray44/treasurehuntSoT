#!/usr/bin/env node
import process from "node:process";
import {
  GitHubInteractionClient,
  GitTransport,
  SharedRuntimeState,
  appFromEnvironment,
  credentialPoolId,
  fingerprint,
  jitteredPollInterval,
  nextPollInterval,
  rateMode,
  recommendTransport,
  repositoryIdentity,
} from "./index.mjs";

const command = process.argv[2] ?? "status";
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const repository = await repositoryIdentity();
const kind = process.env.GITHUB_ACTIONS === "true" ? "ACTIONS_GITHUB_TOKEN" : "USER";
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
const pool = {
  id: credentialPoolId({ kind, repository, principalFingerprint: fingerprint(token ?? "anonymous") }),
  kind,
  repository,
  principalFingerprint: fingerprint(token ?? "anonymous"),
};
const runtime = new SharedRuntimeState(repository);
const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

if (command === "status" || command === "quota") {
  const status = await runtime.status();
  const pools = Object.entries(status.state.pools).map(([id, poolState]) => ({
    id,
    kind: poolState.kind,
    resources: Object.fromEntries(
      Object.entries(poolState.resources ?? {}).map(([key, value]) => [key, { ...value, mode: rateMode(value) }]),
    ),
  }));
  print({
    title: "GitHub Interaction",
    repository,
    stateDirectory: status.directory,
    pools,
    telemetry: status.telemetry.metrics,
    recommendation: recommendTransport({ operation: "ref", gitAvailable: true }),
  });
} else if (command === "doctor") {
  const app = appFromEnvironment(repository);
  print({
    repository,
    git: await new GitTransport().ref().then(
      () => "AVAILABLE",
      () => "UNAVAILABLE",
    ),
    stateDirectory: runtime.directory,
    app: app.health(),
    tokenConfigured: Boolean(token),
    policy: "Run npm run github:policy:validate",
  });
} else if (command === "app-check") {
  const app = appFromEnvironment(repository);
  print(app.health());
} else if (command === "ref") {
  print({
    ref: argument("--ref") ?? "origin/main",
    sha: await new GitTransport().ref(argument("--ref") ?? "origin/main"),
    transport: "GIT",
  });
} else if (command === "pr" || command === "run") {
  const id = argument("--id") ?? process.argv[3];
  if (!/^\d+$/u.test(id ?? "")) throw new Error("GITHUB_CLI_NUMERIC_ID_REQUIRED");
  const client = new GitHubInteractionClient({
    repository,
    pool,
    runtime,
    tokenProvider: token ? async () => token : null,
  });
  const path =
    command === "pr"
      ? `/repos/${repository.replace(/^.*github\.com[:/]/u, "")}/pulls/${id}`
      : `/repos/${repository.replace(/^.*github\.com[:/]/u, "")}/actions/runs/${id}`;
  print(await client.request({ path, freshness: "SHORT" }));
} else if (command === "dispatch") {
  const workflow = argument("--workflow");
  const ref = argument("--ref") ?? "main";
  if (!workflow || !token) throw new Error("GITHUB_DISPATCH_WORKFLOW_AND_AUTHENTICATED_USER_REQUIRED");
  const client = new GitHubInteractionClient({ repository, pool, runtime, tokenProvider: async () => token });
  const result = await client.request({
    method: "POST",
    path: `/repos/${repository.replace(/^.*github\.com[:/]/u, "")}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    body: { ref },
    mutation: true,
  });
  print({ dispatched: true, workflow, ref, status: result.headers.status ?? "accepted" });
} else if (command === "watch-run" || command === "watch-pr") {
  const id = argument("--id") ?? process.argv[3];
  if (!/^\d+$/u.test(id ?? "")) throw new Error("GITHUB_CLI_NUMERIC_ID_REQUIRED");
  const minimumMs = Math.max(30_000, Number(argument("--interval-ms") ?? 60_000));
  const client = new GitHubInteractionClient({
    repository,
    pool,
    runtime,
    tokenProvider: token ? async () => token : null,
  });
  let previous = null;
  let cancelled = false;
  process.once("SIGINT", () => {
    cancelled = true;
    print({ id: Number(id), state: "CANCELLED", reason: "OPERATOR_INTERRUPT" });
  });
  while (!cancelled) {
    const path =
      command === "watch-pr"
        ? `/repos/${repository.replace(/^.*github\.com[:/]/u, "")}/pulls/${id}`
        : `/repos/${repository.replace(/^.*github\.com[:/]/u, "")}/actions/runs/${id}`;
    try {
      const result = await client.request({ path, freshness: "LIVE" });
      const state = result.body?.status ?? result.body?.state ?? "UNKNOWN";
      if (state !== previous)
        print({ id: Number(id), state, cached: result.cached, deferred: Boolean(result.deferred) });
      previous = state;
      if (["completed", "closed", "merged"].includes(String(state).toLowerCase())) break;
      const record = (await runtime.load()).pools?.[pool.id]?.resources?.["rest:core"] ?? null;
      const serverPollIntervalMs = Math.max(0, Number(result.headers?.["x-poll-interval"]) * 1_000 || 0);
      const delay = jitteredPollInterval(
        nextPollInterval({ mode: rateMode(record), minimumMs, serverPollIntervalMs, resetAt: record?.resetAt }),
      );
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    } catch (error) {
      const retryAfterMs = Number(error?.retryAfterMs) || 0;
      const record = (await runtime.load()).pools?.[pool.id]?.resources?.["rest:core"] ?? null;
      const delay = jitteredPollInterval(
        nextPollInterval({ mode: rateMode(record), minimumMs, retryAfterMs, resetAt: record?.resetAt }),
      );
      print({
        id: Number(id),
        state: "DEFERRED",
        classification: error?.classification ?? "GITHUB_UNAVAILABLE",
        retryAfterMs,
        delayMs: delay,
      });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
} else throw new Error(`GITHUB_CLI_UNKNOWN_COMMAND:${command}`);
