import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { createHash, createHmac, generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  GitHubInteractionClient,
  GitHubAppAuth,
  GitTransport,
  SharedCache,
  SharedRuntimeState,
  credentialPoolId,
  isRateObservationStale,
  isTerminalWatchState,
  jitteredPollInterval,
  nextPollInterval,
  rateMode,
  redact,
  recommendTransport,
  requestReadWithFallback,
  retryAfterRemainingMs,
  secondaryBackoffMs,
  shouldReportWatchState,
  verifyWebhook,
  withFileLock,
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
    await runtime.observe({ pool: pool("ACTIONS_GITHUB_TOKEN"), transport: "rest", headers: headers(77) });
    await runtime.observe({
      pool: pool("USER"),
      transport: "graphql",
      resource: "graphql",
      headers: headers(90, 100, "graphql"),
    });
    const state = await runtime.load();
    assert.equal(Object.keys(state.pools).length, 3);
    assert.equal(state.pools[pool("USER").id].resources["rest:core"].remaining, 2);
    assert.equal(state.pools[pool("USER").id].resources["graphql:graphql"].remaining, 90);
    assert.equal(state.pools[pool("ACTIONS_GITHUB_TOKEN").id].resources["rest:core"].remaining, 77);
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
    assert.equal((await runtime.status()).telemetry.metrics.coalesced_calls, 8);
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
  assert.equal(
    jitteredPollInterval(30_000, 0.1, () => 0.5),
    30_000,
  );
  assert.equal(nextPollInterval({ minimumMs: 30_000, serverPollIntervalMs: 60_000 }), 60_000);
  assert.equal(
    nextPollInterval({ mode: "EXHAUSTED", minimumMs: 30_000, now: 0, resetAt: new Date(90_000).toISOString() }),
    90_000,
  );
  assert.equal(isTerminalWatchState("completed"), true);
  assert.equal(isTerminalWatchState("in_progress"), false);
  assert.equal(shouldReportWatchState("in_progress", "in_progress"), false);
  assert.equal(shouldReportWatchState("in_progress", "completed"), true);
});

test("webhook verification fails closed for bad signatures", async () => {
  assert.equal(await verifyWebhook({ payload: "{}", signature: "sha256=bad", secret: "fixture-secret" }), false);
  assert.equal(await verifyWebhook({ payload: "{}", signature: "", secret: "fixture-secret" }), false);
  const payload = '{"event":"fixture"}';
  const signature = `sha256=${createHmac("sha256", "fixture-secret").update(payload).digest("hex")}`;
  assert.equal(await verifyWebhook({ payload, signature, secret: "fixture-secret" }), true);
  assert.equal(await verifyWebhook({ payload: "a".repeat(1_048_577), signature, secret: "fixture-secret" }), false);
  assert.equal(
    redact("authorization: Bearer fixture-token secret=fixture-secret"),
    "authorization=[REDACTED] secret=[REDACTED]",
  );
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
    assert.doesNotMatch(JSON.stringify(app.health()), /fixture-installation-token/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GitHub App configuration, expiry, installation, and invalid-key failures are safe", async () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const { directory } = await temporaryRuntime();
  try {
    const absent = new GitHubAppAuth({ repository: "owner/repository" });
    assert.deepEqual(await absent.validateInstallation(), {
      configured: false,
      active: false,
      repositoryInstalled: false,
      permissions: {},
      missingPermissions: [],
      error: "NOT_CONFIGURED",
    });
    const keyPath = join(directory, "fixture-app.pem");
    await writeFile(keyPath, privateKey, "utf8");
    const app = new GitHubAppAuth({
      repository: "owner/repository",
      appId: "123",
      installationId: "456",
      privateKeyPath: keyPath,
      apiBase: "https://api.example.test",
    });
    let calls = 0;
    await app.token(async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          token: "first-short-lived-token",
          expires_at: new Date(Date.now() + 90_000).toISOString(),
          permissions: {},
        }),
        { status: 201 },
      );
    });
    await app.token(async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          token: "refreshed-token",
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          permissions: {},
        }),
        { status: 201 },
      );
    });
    assert.equal(calls, 2);
    const invalidExpiry = new GitHubAppAuth({
      repository: "owner/repository",
      appId: "123",
      installationId: "456",
      privateKeyPath: keyPath,
      apiBase: "https://api.example.test",
    });
    await assert.rejects(
      invalidExpiry.token(
        async () => new Response(JSON.stringify({ token: "invalid", expires_at: "not-a-date" }), { status: 201 }),
      ),
      /GITHUB_APP_TOKEN_RESPONSE_INVALID/u,
    );
    const missingKey = new GitHubAppAuth({
      repository: "owner/repository",
      appId: "123",
      installationId: "456",
      privateKeyPath: join(directory, "missing.pem"),
      apiBase: "https://api.example.test",
    });
    const missingKeyCheck = await missingKey.validateInstallation();
    assert.equal(missingKeyCheck.active, false);
    assert.equal(missingKeyCheck.error, "GITHUB_APP_PRIVATE_KEY_UNAVAILABLE");
    const wrongInstallation = new GitHubAppAuth({
      repository: "owner/repository",
      appId: "123",
      installationId: "456",
      privateKeyPath: keyPath,
      apiBase: "https://api.example.test",
    });
    const wrongInstallationCheck = await wrongInstallation.validateInstallation(
      async () => new Response("not installed", { status: 404 }),
    );
    assert.equal(wrongInstallationCheck.active, false);
    assert.equal(wrongInstallationCheck.error, "GITHUB_APP_TOKEN_FAILED:404");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stale rate observations safely refresh while future reset windows stay protected", async () => {
  const { directory, runtime } = await temporaryRuntime();
  try {
    await runtime.observe({
      pool: pool(),
      transport: "rest",
      headers: { ...headers(0), "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) - 60) },
      now: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    const stale = (await runtime.load()).pools[pool().id].resources["rest:core"];
    assert.equal(isRateObservationStale(stale), true);
    let calls = 0;
    const client = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool(),
      runtime,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ refreshed: true }), { status: 200, headers: headers(99) });
      },
    });
    assert.equal((await client.request({ path: "/repos/owner/repository" })).body.refreshed, true);
    assert.equal(calls, 1);
    await runtime.observe({ pool: pool(), transport: "rest", headers: headers(0) });
    const exhausted = (await runtime.load()).pools[pool().id].resources["rest:core"];
    assert.equal(isRateObservationStale(exhausted), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GraphQL rate metadata and secondary limits are persisted without secrets", async () => {
  const { directory, runtime } = await temporaryRuntime();
  try {
    const graph = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool(),
      runtime,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            data: {
              rateLimit: {
                limit: 5_000,
                remaining: 4_900,
                used: 100,
                cost: 7,
                resetAt: new Date(Date.now() + 60_000).toISOString(),
              },
            },
          }),
          { status: 200, headers: headers(4_999, 5_000, "graphql") },
        ),
    });
    await graph.graphql("query { rateLimit { remaining } }");
    const limited = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool("GITHUB_APP_INSTALLATION"),
      runtime,
      fetchImpl: async () => new Response("secondary rate limit", { status: 403, headers: { "retry-after": "1" } }),
    });
    await assert.rejects(
      limited.request({ path: "/repos/owner/repository" }),
      (error) => error.classification === "SECONDARY_LIMITED",
    );
    const state = await runtime.load();
    assert.equal(state.pools[pool().id].resources["graphql:graphql"].remaining, 4_900);
    assert.equal(
      state.pools[pool("GITHUB_APP_INSTALLATION").id].resources["rest:core"].errorClassification,
      "SECONDARY_LIMITED",
    );
    assert.equal(state.pools[pool("GITHUB_APP_INSTALLATION").id].resources["rest:core"].retryAfterUntil !== null, true);
    assert.doesNotMatch(JSON.stringify(state), /authorization|fixture-token/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stale locks recover and corrupt cache records fail closed", async () => {
  const { directory, runtime } = await temporaryRuntime();
  try {
    const lockDirectory = join(directory, "locks");
    await mkdir(lockDirectory, { recursive: true });
    const staleLock = join(lockDirectory, `${createHash("sha256").update("stale-fixture").digest("hex")}.lock`);
    await writeFile(staleLock, "{not-a-live-lock}");
    const staleAt = new Date(Date.now() - 120_000);
    await utimes(staleLock, staleAt, staleAt);
    let ran = false;
    await withFileLock(
      lockDirectory,
      "stale-fixture",
      async () => {
        ran = true;
      },
      { staleMs: 1, waitMs: 1_000 },
    );
    assert.equal(ran, true);

    const cache = new SharedCache(runtime);
    const scope = { repository: "owner/repository", path: "/repos/owner/repository" };
    await cache.put(scope, { body: { expected: true }, headers: {} });
    await writeFile(cache.file(scope), "{invalid-json");
    assert.equal(await cache.get(scope), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("secondary limits create shared backoff and healthy credential pools can serve the exact read", async () => {
  const { directory, runtime } = await temporaryRuntime();
  try {
    let limitedCalls = 0;
    const limited = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool(),
      runtime,
      fetchImpl: async () => {
        limitedCalls += 1;
        return new Response("secondary rate limit", { status: 403, headers: { "retry-after": "1" } });
      },
    });
    await assert.rejects(limited.request({ path: "/repos/owner/repository" }), (error) => {
      assert.equal(error.classification, "SECONDARY_LIMITED");
      assert.equal(error.retryAfterMs >= 30_000, true);
      return true;
    });
    await assert.rejects(limited.request({ path: "/repos/owner/repository" }), (error) => {
      assert.equal(error.message, "GITHUB_RATE_BACKOFF_ACTIVE");
      assert.equal(error.retryAfterMs > 0, true);
      return true;
    });
    assert.equal(limitedCalls, 1);
    assert.equal(secondaryBackoffMs({ previous: { secondaryFailureCount: 2 } }), 120_000);
    const throttledState = await runtime.load();
    assert.equal(retryAfterRemainingMs(throttledState.pools[pool().id].resources["rest:core"]) > 0, true);

    await runtime.observe({ pool: pool("USER"), transport: "rest", headers: headers(0) });
    const app = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool("GITHUB_APP_INSTALLATION"),
      runtime,
      fetchImpl: async () => new Response(JSON.stringify({ source: "app" }), { status: 200, headers: headers(90) }),
    });
    const fallback = await requestReadWithFallback({
      primary: limited,
      alternatives: [app],
      request: { path: "/repos/owner/repository", freshness: "LIVE" },
    });
    assert.equal(fallback.body.source, "app");
    assert.equal(fallback.fallbackPoolId, pool("GITHUB_APP_INSTALLATION").id);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("credential-scoped caches and App installation validation remain authorization-safe", async () => {
  const { directory, runtime } = await temporaryRuntime();
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  try {
    let calls = 0;
    const user = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool("USER"),
      runtime,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ source: "user" }), { status: 200, headers: headers(90) });
      },
    });
    const appClient = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool("GITHUB_APP_INSTALLATION"),
      runtime,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ source: "app" }), { status: 200, headers: headers(90) });
      },
    });
    assert.equal((await user.request({ path: "/repos/owner/repository", freshness: "LONG" })).body.source, "user");
    assert.equal((await appClient.request({ path: "/repos/owner/repository", freshness: "LONG" })).body.source, "app");
    assert.equal(calls, 2);

    const keyPath = join(directory, "fixture-app.pem");
    await writeFile(keyPath, privateKey, "utf8");
    const app = new GitHubAppAuth({
      repository: "owner/repository",
      appId: "123",
      installationId: "456",
      privateKeyPath: keyPath,
      apiBase: "https://api.example.test",
    });
    let appCalls = 0;
    const installation = await app.validateInstallation(async (url) => {
      appCalls += 1;
      if (url.includes("access_tokens"))
        return new Response(
          JSON.stringify({
            token: "fixture-installation-token",
            expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
            permissions: { metadata: "read", contents: "read", pull_requests: "read", checks: "read", actions: "read" },
          }),
          { status: 201 },
        );
      return new Response(JSON.stringify({ repositories: [{ full_name: "owner/repository" }] }), { status: 200 });
    });
    assert.equal(appCalls, 2);
    assert.equal(installation.repositoryInstalled, true);
    assert.deepEqual(installation.missingPermissions, []);
    assert.equal(installation.error, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("mutations are globally serialized and Git transport records local operations", async () => {
  const { directory, runtime } = await temporaryRuntime();
  try {
    let active = 0;
    let maximumActive = 0;
    const client = new GitHubInteractionClient({
      repository: "owner/repository",
      apiBase: "https://api.example.test",
      pool: pool(),
      runtime,
      fetchImpl: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
        active -= 1;
        return new Response(null, { status: 204, headers: headers(90) });
      },
    });
    await Promise.all([
      client.request({
        method: "POST",
        path: "/repos/owner/repository/dispatches",
        body: { ref: "main" },
        mutation: true,
      }),
      client.request({
        method: "POST",
        path: "/repos/owner/repository/labels",
        body: { name: "fixture" },
        mutation: true,
      }),
    ]);
    assert.equal(maximumActive, 1);
    const transport = new GitTransport(process.cwd(), runtime);
    await transport.ref("HEAD");
    assert.equal((await runtime.status()).telemetry.metrics.git_operations, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
