import { execFile } from "node:child_process";
import { createHash, createPrivateKey, createSign, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const STATE_VERSION = 1;
const API_VERSION = "2022-11-28";
const DEFAULT_THRESHOLDS = Object.freeze({ conservation: 0.3, critical: 0.1 });
const FRESHNESS_MS = Object.freeze({ IMMUTABLE: Infinity, LONG: 3_600_000, MEDIUM: 300_000, SHORT: 60_000, LIVE: 0 });
const redactPattern = /(authorization|token|secret|private.?key|cookie|password)=?[^\s,;]*/giu;

export const redact = (value) => String(value ?? "").replace(redactPattern, "$1=[REDACTED]");
export const fingerprint = (value) =>
  createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex")
    .slice(0, 24);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const stable = (value) => JSON.stringify(canonical(value));
export const credentialPoolId = ({ kind, repository, principalFingerprint, installationId = null }) =>
  `${kind}:${fingerprint(`${repository}|${installationId ?? ""}|${principalFingerprint ?? "anonymous"}`)}`;

export function rateMode(record, thresholds = DEFAULT_THRESHOLDS, now = Date.now()) {
  if (!record || !Number.isFinite(record.limit) || record.limit <= 0 || !Number.isFinite(record.remaining))
    return "UNKNOWN";
  if (record.remaining <= 0 && (!record.resetAt || Date.parse(record.resetAt) > now)) return "EXHAUSTED";
  const ratio = record.remaining / record.limit;
  if (ratio <= thresholds.critical) return "CRITICAL";
  if (ratio <= thresholds.conservation) return "CONSERVATION";
  return "NORMAL";
}

export function nextPollInterval({
  mode = "NORMAL",
  minimumMs = 30_000,
  serverPollIntervalMs = 0,
  retryAfterMs = 0,
  now = Date.now(),
  resetAt = null,
}) {
  const multiplier = { NORMAL: 1, CONSERVATION: 2, CRITICAL: 4, EXHAUSTED: 1 }[mode] ?? 1;
  const resetDelay = mode === "EXHAUSTED" && resetAt ? Math.max(0, Date.parse(resetAt) - now) : 0;
  return Math.max(minimumMs * multiplier, serverPollIntervalMs, retryAfterMs, resetDelay);
}

function defaultStateDir(repository) {
  const safe = fingerprint(repository).slice(0, 16);
  if (process.env.VOYAGEWRIGHT_GITHUB_STATE_DIR) return resolve(process.env.VOYAGEWRIGHT_GITHUB_STATE_DIR, safe);
  if (process.platform === "win32")
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
      "Voyagewright",
      "github-interaction",
      safe,
    );
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "Voyagewright", "github-interaction", safe);
  return join(
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"),
    "voyagewright",
    "github-interaction",
    safe,
  );
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
async function atomicJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}

export class SharedRuntimeState {
  constructor(repository, directory = defaultStateDir(repository)) {
    this.repository = repository;
    this.directory = directory;
    this.file = join(directory, "rate-state.json");
    this.telemetryFile = join(directory, "telemetry.json");
  }
  async load() {
    return readJson(this.file, {
      schemaVersion: STATE_VERSION,
      repository: this.repository,
      observedAt: null,
      pools: {},
    });
  }
  async observe({
    pool,
    transport,
    resource = "core",
    headers = {},
    source = "response",
    now = new Date().toISOString(),
  }) {
    const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    const limit = Number(lower["x-ratelimit-limit"]);
    const remaining = Number(lower["x-ratelimit-remaining"]);
    const used = Number(lower["x-ratelimit-used"]);
    const epoch = Number(lower["x-ratelimit-reset"]);
    if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return null;
    return withFileLock(join(this.directory, "locks"), "rate-state", async () => {
      const state = await this.load();
      const poolState = (state.pools[pool.id] ??= {
        kind: pool.kind,
        repository: pool.repository,
        principalFingerprint: pool.principalFingerprint,
        resources: {},
      });
      poolState.resources[`${transport}:${resource}`] = {
        limit,
        remaining,
        used: Number.isFinite(used) ? used : null,
        resetAt: Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : null,
        resource,
        observedAt: now,
        source,
      };
      state.observedAt = now;
      await atomicJson(this.file, state);
      return poolState.resources[`${transport}:${resource}`];
    });
  }
  async recordTelemetry(name, increment = 1) {
    return withFileLock(join(this.directory, "locks"), "telemetry", async () => {
      const metrics = await readJson(this.telemetryFile, { schemaVersion: STATE_VERSION, metrics: {} });
      metrics.metrics[name] = Math.min(1_000_000_000, (metrics.metrics[name] ?? 0) + increment);
      await atomicJson(this.telemetryFile, metrics);
      return metrics.metrics[name];
    });
  }
  async status() {
    const state = await this.load();
    const telemetry = await readJson(this.telemetryFile, { schemaVersion: STATE_VERSION, metrics: {} });
    return { directory: this.directory, state, telemetry };
  }
}

export class SharedCache {
  constructor(runtime) {
    this.runtime = runtime;
    this.directory = join(runtime.directory, "cache");
  }
  key(scope) {
    return createHash("sha256").update(stable(scope)).digest("hex");
  }
  file(scope) {
    return join(this.directory, `${this.key(scope)}.json`);
  }
  async get(scope, freshness = "LIVE") {
    const value = await readJson(this.file(scope), null);
    if (!value || value.schemaVersion !== STATE_VERSION) return null;
    const ageMs = Math.max(0, Date.now() - Date.parse(value.observedAt));
    const maxAge = FRESHNESS_MS[freshness] ?? FRESHNESS_MS.LIVE;
    return { ...value, ageMs, fresh: ageMs <= maxAge };
  }
  async put(scope, entry) {
    const record = { schemaVersion: STATE_VERSION, scope, observedAt: new Date().toISOString(), ...entry };
    await atomicJson(this.file(scope), record);
    return record;
  }
}

export async function withFileLock(directory, name, work, { waitMs = 10_000, staleMs = 60_000 } = {}) {
  await mkdir(directory, { recursive: true });
  const file = join(directory, `${createHash("sha256").update(name).digest("hex")}.lock`);
  const deadline = Date.now() + waitMs;
  while (true) {
    try {
      const handle = await open(file, "wx", 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      try {
        return await work();
      } finally {
        await handle.close();
        await rm(file, { force: true });
      }
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        if (Date.now() - (await stat(file)).mtimeMs > staleMs) await rm(file, { force: true });
      } catch {
        /* contender completed */
      }
      if (Date.now() >= deadline) throw new Error("GITHUB_INTERACTION_COALESCING_TIMEOUT");
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 80 + Math.floor(Math.random() * 80)));
    }
  }
}

export class GitHubAppAuth {
  constructor({ appId, installationId, privateKeyPath, apiBase = "https://api.github.com", repository }) {
    this.appId = appId;
    this.installationId = installationId;
    this.privateKeyPath = privateKeyPath;
    this.apiBase = validateApiBase(apiBase);
    this.repository = repository;
    this.cached = null;
  }
  configured() {
    return Boolean(this.appId && this.installationId && this.privateKeyPath);
  }
  async jwt(now = Date.now()) {
    if (!this.configured()) throw new Error("GITHUB_APP_CONFIGURATION_REQUIRED");
    const key = await readFile(this.privateKeyPath, "utf8");
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const payload = encode({
      iat: Math.floor(now / 1000) - 30,
      exp: Math.floor(now / 1000) + 540,
      iss: String(this.appId),
    });
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    return `${unsigned}.${signer.sign(createPrivateKey(key)).toString("base64url")}`;
  }
  async token(fetchImpl = fetch) {
    if (this.cached && Date.parse(this.cached.expiresAt) - Date.now() > 120_000) return this.cached;
    const response = await fetchImpl(
      `${this.apiBase}/app/installations/${encodeURIComponent(this.installationId)}/access_tokens`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${await this.jwt()}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": API_VERSION,
        },
      },
    );
    if (!response.ok) throw new Error(`GITHUB_APP_TOKEN_FAILED:${response.status}`);
    const body = await response.json();
    if (typeof body.token !== "string" || !body.token || typeof body.expires_at !== "string")
      throw new Error("GITHUB_APP_TOKEN_RESPONSE_INVALID");
    this.cached = { token: body.token, expiresAt: body.expires_at, permissions: body.permissions ?? {} };
    return this.cached;
  }
  health() {
    return {
      configured: this.configured(),
      active: Boolean(this.cached),
      installationId: this.installationId ? String(this.installationId) : null,
      tokenExpiresAt: this.cached?.expiresAt ?? null,
    };
  }
}

export function verifyWebhook({ payload, signature, secret }) {
  if (!secret || !signature?.startsWith("sha256=")) return false;
  // The guarded dynamic import keeps the uncommon receiver-only dependency out
  // of ordinary polling paths while preserving constant-time comparison.
  return import("node:crypto").then(({ createHmac }) => {
    const candidate = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
    return candidate.length === signature.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(signature));
  });
}

function validateApiBase(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error("GITHUB_API_BASE_MUST_BE_HTTPS");
  return url.toString().replace(/\/$/u, "");
}
function responseHeaders(response) {
  return Object.fromEntries(response.headers.entries());
}
function retryAfterMs(headers) {
  const seconds = Number(headers["retry-after"]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}
function isSecondary(response, body) {
  return (
    response.status === 429 ||
    (response.status === 403 && /secondary rate limit|abuse detection/iu.test(String(body ?? "")))
  );
}

export class GitHubInteractionClient {
  constructor({
    repository,
    apiBase = "https://api.github.com",
    pool,
    tokenProvider = null,
    runtime = new SharedRuntimeState(repository),
    fetchImpl = fetch,
    requestTimeoutMs = 15_000,
  }) {
    this.repository = repository;
    this.apiBase = validateApiBase(apiBase);
    this.pool = pool;
    this.tokenProvider = tokenProvider;
    this.runtime = runtime;
    this.cache = new SharedCache(runtime);
    this.fetch = fetchImpl;
    this.requestTimeoutMs = Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 15_000;
  }
  async request({
    method = "GET",
    path,
    body = null,
    freshness = "LIVE",
    accept = "application/vnd.github+json",
    apiVersion = API_VERSION,
    mutation = false,
    cacheKey = null,
  }) {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//"))
      throw new Error("GITHUB_API_PATH_INVALID");
    if (mutation && method === "GET") throw new Error("GITHUB_MUTATION_METHOD_INVALID");
    const scope = { apiBase: this.apiBase, pool: this.pool.id, ...(cacheKey ?? { path, accept, apiVersion }) };
    const resourceKey = method === "POST" && path === "/graphql" ? "graphql:graphql" : "rest:core";
    const state = await this.runtime.load();
    const record = state.pools?.[this.pool.id]?.resources?.[resourceKey] ?? null;
    const mode = rateMode(record);
    if (!mutation && mode === "EXHAUSTED") {
      const cached = await this.cache.get(scope, freshness);
      if (cached?.fresh) {
        await this.runtime.recordTelemetry("cache_hits");
        return { body: cached.body, cached: true, deferred: true, headers: cached.headers ?? {} };
      }
      await this.runtime.recordTelemetry("rate_deferred_operations");
      throw new Error("GITHUB_PRIMARY_RATE_EXHAUSTED");
    }
    const cacheable = !mutation && (method === "GET" || path === "/graphql");
    return withFileLock(join(this.runtime.directory, "locks"), `${method}:${this.cache.key(scope)}`, async () => {
      const cached = cacheable ? await this.cache.get(scope, freshness) : null;
      if (cached?.fresh) {
        await this.runtime.recordTelemetry("cache_hits");
        return { body: cached.body, cached: true, headers: cached.headers ?? {} };
      }
      const token = this.tokenProvider ? await this.tokenProvider() : null;
      const headers = {
        accept,
        "x-github-api-version": apiVersion,
        "user-agent": "voyagewright-github-interaction/1",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cached?.etag ? { "if-none-match": cached.etag } : {}),
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error("GITHUB_REQUEST_TIMEOUT")), this.requestTimeoutMs);
      let response;
      try {
        response = await this.fetch(`${this.apiBase}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const headersObserved = responseHeaders(response);
      const resource = headersObserved["x-ratelimit-resource"] ?? (path === "/graphql" ? "graphql" : "core");
      await this.runtime.observe({
        pool: this.pool,
        transport: path === "/graphql" ? "graphql" : "rest",
        resource,
        headers: headersObserved,
      });
      if (response.status === 304 && cached) {
        await this.runtime.recordTelemetry("conditional_304s");
        return { body: cached.body, cached: true, headers: headersObserved, notModified: true };
      }
      const text = await response.text();
      if (!response.ok) {
        await this.runtime.recordTelemetry(isSecondary(response, text) ? "secondary_limit_events" : "request_failures");
        const error = new Error(`GITHUB_REQUEST_FAILED:${response.status}:${redact(text).slice(0, 300)}`);
        error.retryAfterMs = retryAfterMs(headersObserved);
        throw error;
      }
      const parsed = text ? JSON.parse(text) : null;
      if (cacheable)
        await this.cache.put(scope, {
          poolId: this.pool.id,
          etag: headersObserved.etag ?? null,
          headers: headersObserved,
          body: parsed,
          freshness,
        });
      await this.runtime.recordTelemetry(path === "/graphql" ? "graphql_requests" : "rest_requests");
      return { body: parsed, cached: false, headers: headersObserved };
    });
  }
  graphql(query, variables = {}, options = {}) {
    return this.request({
      method: "POST",
      path: "/graphql",
      body: { query, variables },
      cacheKey: { pool: this.pool.id, graphql: fingerprint(query), variables },
      ...options,
    });
  }
}

export class GitTransport {
  constructor(root = process.cwd()) {
    this.root = root;
  }
  async run(...args) {
    const { stdout } = await execute("git", args, { cwd: this.root, maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  }
  ref(ref = "origin/main") {
    return this.run("rev-parse", ref);
  }
  remoteRef(remote = "origin", ref = "refs/heads/main") {
    return this.run("ls-remote", remote, ref).then((value) => value.split(/\s+/u)[0] ?? "");
  }
  ancestry(ancestor, descendant) {
    return execute("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: this.root }).then(
      () => true,
      () => false,
    );
  }
  tree(ref) {
    return this.run("rev-parse", `${ref}^{tree}`);
  }
  changed(base, head) {
    return this.run("diff", "--name-only", "--no-renames", base, head).then((value) =>
      value ? value.split(/\r?\n/u) : [],
    );
  }
}

export function recommendTransport({
  operation,
  gitAvailable = true,
  cacheFresh = false,
  graphqlHealthy = false,
  restMode = "NORMAL",
  mutation = false,
}) {
  if (mutation) return "MUTATION_CONTROLLER";
  if (gitAvailable && ["ref", "tree", "ancestry", "changed-paths", "commit"].includes(operation)) return "GIT";
  if (cacheFresh) return "CACHE";
  if (graphqlHealthy && ["pull-request", "pull-requests", "checks", "repository"].includes(operation)) return "GRAPHQL";
  if (restMode === "EXHAUSTED") return "DEFER_EXACT_OPERATION";
  return "REST_CONDITIONAL";
}

export async function repositoryIdentity(root = process.cwd()) {
  try {
    const { stdout } = await execute("git", ["config", "--get", "remote.origin.url"], { cwd: root });
    return stdout.trim().replace(/\.git$/u, "");
  } catch {
    return basename(resolve(root));
  }
}

export function appFromEnvironment(repository, environment = process.env) {
  return new GitHubAppAuth({
    repository,
    appId: environment.VOYAGEWRIGHT_GITHUB_APP_ID,
    installationId: environment.VOYAGEWRIGHT_GITHUB_APP_INSTALLATION_ID,
    privateKeyPath: environment.VOYAGEWRIGHT_GITHUB_APP_PRIVATE_KEY_PATH,
    apiBase: environment.VOYAGEWRIGHT_GITHUB_API ?? "https://api.github.com",
  });
}
