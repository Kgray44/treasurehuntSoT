import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  GitHubInteractionClient,
  GitHubAppAuth,
  SharedRuntimeState,
  credentialPoolId,
  nextPollInterval,
  rateMode,
  recommendTransport,
  verifyWebhook,
} from "../../scripts/github-interaction/index.mjs";

const pool = (kind = "USER") => ({
  kind,
  repository: "owner/repository",
  principalFingerprint: `${kind}-fixture`,
  id: credentialPoolId({ kind, repository: "owner/repository", principalFingerprint: `${kind}-fixture` }),
});
const temporaryRuntime = async () => {
  const directory = await mkdtemp(join(tmpdir(), "fairlead-github-"));
  return { directory, runtime: new SharedRuntimeState("owner/repository", directory) };
};
const headers = (remaining, limit = 100, resource = "core") => ({
  "x-ratelimit-limit": String(limit),
  "x-ratelimit-remaining": String(remaining),
  "x-ratelimit-used": String(limit - remaining),
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
  "x-ratelimit-resource": resource,
});

test("rate modes are percentage based and independently tracked by pool and transport", async () => {
  assert.equal(rateMode({ remaining: 31, limit: 100 }), "NORMAL");
  assert.equal(rateMode({ remaining: 30, limit: 100 }), "CONSERVATION");
  assert.equal(rateMode({ remaining: 10, limit: 100 }), "CRITICAL");
  assert.equal(
    rateMode({ remaining: 0, limit: 100, resetAt: new Date(Date.now() + 60_000).toISOString() }),
    "EXHAUSTED",
  );
  assert.equal(rateMode({ remaining: 300, limit: 1_000 }), "CONSERVATION");
  const { directory, runtime } = await temporaryRuntime();
  try {
    await runtime.observe({ pool: pool("USER"), transport: "rest", headers: headers(2) });
    await runtime.observe({ pool: pool("GITHUB_APP_INSTALLATION"), transport: "rest", headers: headers(88) });
    await runtime.observe({
      pool: pool("USER"),
      transport: "graphql",
      resource: "graphql",
      headers: headers(90, 100, "graphql"),
    });
    const state = await runtime.load();
    assert.equal(Object.keys(state.pools).length, 2);
    assert.equal(state.pools[pool("USER").id].resources["rest:core"].remaining, 2);
    assert.equal(state.pools[pool("USER").id].resources["graphql:graphql"].remaining, 90);
    assert.doesNotMatch(JSON.stringify(state), /fixture-token|authorization/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("conditional cache reuses a 304 and exhausted pools continue cache reads without live calls", async () => {
  const { directory, runtime } = await temporaryRuntime();
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    if (calls === 2) {
      assert.equal(options.headers["if-none-match"], "fixture-etag");
      return new Response(null, { status: 304, headers: headers(70) });
    }
    return new Response(JSON.stringify({ value: "safe" }), {
      status: 200,
      headers: { ...headers(70), etag: "fixture-etag" },
    });
  };
  try {
    const client = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool(),
      runtime,
      fetchImpl,
      tokenProvider: async () => "fixture-token",
    });
    const first = await client.request({ path: "/repos/owner/repository", freshness: "LIVE" });
    assert.deepEqual(first.body, { value: "safe" });
    const second = await client.request({ path: "/repos/owner/repository", freshness: "LIVE" });
    assert.equal(second.notModified, true);
    await runtime.observe({ pool: pool(), transport: "rest", headers: headers(0) });
    const third = await client.request({ path: "/repos/owner/repository", freshness: "LONG" });
    assert.equal(third.deferred, true);
    assert.equal(calls, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("coalescing makes concurrent identical GraphQL reads one live request", async () => {
  const { directory, runtime } = await temporaryRuntime();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 30));
    return new Response(JSON.stringify({ data: { repository: { name: "repository" } } }), {
      status: 200,
      headers: headers(90, 100, "graphql"),
    });
  };
  try {
    const clients = Array.from(
      { length: 9 },
      () =>
        new GitHubInteractionClient({
          repository: "owner/repository",
          apiBase: "https://api.example.test",
          pool: pool(),
          runtime,
          fetchImpl,
        }),
    );
    const responses = await Promise.all(
      clients.map((client) => client.graphql("query { viewer { login } }", {}, { freshness: "LONG" })),
    );
    assert.equal(calls, 1);
    assert.equal(responses.filter((response) => response.cached).length, 8);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("router keeps Git facts local and forbids read fallbacks for mutations", async () => {
  assert.equal(recommendTransport({ operation: "ref", gitAvailable: true }), "GIT");
  assert.equal(recommendTransport({ operation: "pull-request", graphqlHealthy: true }), "GRAPHQL");
  assert.equal(recommendTransport({ operation: "workflow-run", restMode: "EXHAUSTED" }), "DEFER_EXACT_OPERATION");
  assert.equal(recommendTransport({ operation: "workflow-dispatch", mutation: true }), "MUTATION_CONTROLLER");
  assert.equal(nextPollInterval({ mode: "CRITICAL", minimumMs: 30_000 }), 120_000);
});

test("webhook verification fails closed for bad signatures", async () => {
  assert.equal(await verifyWebhook({ payload: "{}", signature: "sha256=bad", secret: "fixture-secret" }), false);
  assert.equal(await verifyWebhook({ payload: "{}", signature: "", secret: "fixture-secret" }), false);
});

test("GitHub App tokens are generated and retained only in memory until proactive refresh", async () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const { directory } = await temporaryRuntime();
  try {
    const keyPath = join(directory, "fixture-app.pem");
    await writeFile(keyPath, privateKey, "utf8");
    const app = new GitHubAppAuth({
      repository: "owner/repository",
      appId: "123",
      installationId: "456",
      privateKeyPath: keyPath,
    });
    assert.match(await app.jwt(), /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
    let calls = 0;
    const first = await app.token(async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          token: "fixture-installation-token",
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          permissions: { contents: "read" },
        }),
        { status: 201 },
      );
    });
    const second = await app.token(async () => {
      calls += 1;
      throw new Error("should reuse memory token");
    });
    assert.equal(first.token, second.token);
    assert.equal(calls, 1);
    assert.equal(app.health().active, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
