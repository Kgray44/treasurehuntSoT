#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubInteractionClient, SharedRuntimeState, credentialPoolId, fingerprint } from "./index.mjs";

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
let liveCalls = 0;
const fetchImpl = async () => {
  liveCalls += 1;
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  return new Response(JSON.stringify({ data: { repository: { name: "controlled-replay" } } }), {
    status: 200,
    headers: {
      "x-ratelimit-limit": "100",
      "x-ratelimit-remaining": "99",
      "x-ratelimit-used": "1",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      "x-ratelimit-resource": "graphql",
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
    clients.map((client) =>
      client.graphql(
        'query Simulation($owner:String!){repository(owner:$owner,name:"controlled-replay"){name}}',
        { owner: "fixture" },
        { freshness: "LONG" },
      ),
    ),
  );
  const coordinatedCalls = liveCalls;
  process.stdout.write(
    `${JSON.stringify(
      {
        simulation: "CONTROLLED_MOCK_NO_GITHUB_NETWORK",
        consumers,
        withoutCoordinator: { liveCalls: consumers, simulatedQuotaConsumption: consumers },
        withFairlead: {
          liveCalls: coordinatedCalls,
          cacheHits: responses.filter((entry) => entry.cached).length,
          coalescedCalls: consumers - coordinatedCalls,
          simulatedQuotaConsumption: coordinatedCalls,
        },
        liveRequestReductionPercent: Math.round(((consumers - coordinatedCalls) / consumers) * 10_000) / 100,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
