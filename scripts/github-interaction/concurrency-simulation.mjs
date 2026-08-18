#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubInteractionClient, GitTransport, SharedRuntimeState, credentialPoolId, fingerprint } from "./index.mjs";

const consumers = Number(process.argv[2] ?? 9);
if (!Number.isInteger(consumers) || consumers < 2 || consumers > 32)
  throw new Error("GITHUB_SIMULATION_CONSUMERS_2_TO_32_REQUIRED");
const directory = await mkdtemp(join(tmpdir(), "fairlead-concurrency-"));
const repository = "fixture/controlled-replay";
const pool = {
  kind: "USER",
  repository,
  principalFingerprint: fingerprint("simulation"),
  id: credentialPoolId({ kind: "USER", repository, principalFingerprint: fingerprint("simulation") }),
};
const liveCalls = { graphql: 0, rest: 0 };
const fetchImpl = async (url) => {
  const graphql = String(url).endsWith("/graphql");
  liveCalls[graphql ? "graphql" : "rest"] += 1;
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  const resource = graphql ? "graphql" : "core";
  const body = graphql
    ? { data: { repository: { name: "controlled-replay" } } }
    : { id: 42, status: "in_progress", name: "controlled workflow" };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "x-ratelimit-limit": "100",
      "x-ratelimit-remaining": "99",
      "x-ratelimit-used": "1",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      "x-ratelimit-resource": resource,
    },
  });
};
try {
  const runtime = new SharedRuntimeState(repository, directory);
  const clients = Array.from(
    { length: consumers },
    () => new GitHubInteractionClient({ repository, apiBase: "https://api.example.test", pool, runtime, fetchImpl }),
  );
  const responses = await Promise.all(
    clients.map(async (client) => {
      const [mainSha, pullRequest, workflow] = await Promise.all([
        new GitTransport(process.cwd(), runtime).ref("HEAD"),
        client.graphql(
          'query Simulation($owner:String!){repository(owner:$owner,name:"controlled-replay"){name}}',
          { owner: "fixture" },
          { freshness: "LONG" },
        ),
        client.request({ path: "/repos/fixture/controlled-replay/actions/runs/42", freshness: "LONG" }),
      ]);
      return { mainSha, pullRequest, workflow };
    }),
  );
  const coordinatedCalls = liveCalls.graphql + liveCalls.rest;
  const uncoordinatedCalls = consumers * 2;
  const graphCacheHits = responses.filter((entry) => entry.pullRequest.cached).length;
  const restCacheHits = responses.filter((entry) => entry.workflow.cached).length;
  process.stdout.write(
    `${JSON.stringify(
      {
        simulation: "CONTROLLED_MOCK_NO_GITHUB_NETWORK",
        consumers,
        withoutCoordinator: { liveCalls: uncoordinatedCalls, simulatedQuotaConsumption: uncoordinatedCalls },
        withFairlead: {
          liveCalls: coordinatedCalls,
          cacheHits: graphCacheHits + restCacheHits,
          coalescedCalls: graphCacheHits + restCacheHits,
          simulatedQuotaConsumption: coordinatedCalls,
          transportDistribution: {
            gitLocalFacts: responses.length,
            graphql: { liveCalls: liveCalls.graphql, cacheHits: graphCacheHits },
            conditionalRest: { liveCalls: liveCalls.rest, cacheHits: restCacheHits },
          },
        },
        liveRequestReductionPercent:
          Math.round(((uncoordinatedCalls - coordinatedCalls) / uncoordinatedCalls) * 10_000) / 100,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
