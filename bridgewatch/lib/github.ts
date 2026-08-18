import type { Config } from "../src/config.js";
import type { BranchHealth, GithubHistorySnapshot, GithubPullRequestHistory } from "../src/history.js";
import { projectRegistry } from "../src/registry.js";
import type { BridgewatchStore } from "./store.js";
import {
  GitHubInteractionClient,
  GitHubAppAuth,
  SharedRuntimeState,
  credentialPoolId,
  fingerprint,
  nextPollInterval,
  rateMode,
} from "../../scripts/github-interaction/index.mjs";

export interface WorkflowRun {
  id: number | null;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  updatedAt: string | null;
}

export interface Snapshot extends GithubHistorySnapshot {
  openPullRequests: GithubPullRequestHistory[];
  workflows: WorkflowRun[];
}

type GitHubRecord = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const url = (value: unknown): string | null => {
  const candidate = text(value);
  return candidate && /^https:\/\//iu.test(candidate) ? candidate : null;
};

function checkState(value: GitHubRecord | undefined): GithubPullRequestHistory["checkState"] {
  const checks = Array.isArray(value?.check_runs) ? value.check_runs : [];
  if (!checks.length) return "UNKNOWN";
  const statuses = checks.map((entry) => (entry && typeof entry === "object" ? (entry as GitHubRecord) : {}));
  if (
    statuses.some((entry) =>
      ["failure", "timed_out", "cancelled", "action_required"].includes(text(entry.conclusion) ?? ""),
    )
  )
    return "FAILURE";
  if (statuses.some((entry) => ["queued", "in_progress", "pending", "requested"].includes(text(entry.status) ?? "")))
    return "PENDING";
  if (statuses.every((entry) => text(entry.conclusion) === "success" || text(entry.conclusion) === "neutral"))
    return "SUCCESS";
  return "UNKNOWN";
}

function pullFrom(value: unknown, checks?: GitHubRecord): GithubPullRequestHistory | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as GitHubRecord;
  const number = count(raw.number);
  if (!number) return null;
  const state = text(raw.state)?.toUpperCase();
  const mergedAt = text(raw.merged_at);
  const head = raw.head && typeof raw.head === "object" ? (raw.head as GitHubRecord) : {};
  const base = raw.base && typeof raw.base === "object" ? (raw.base as GitHubRecord) : {};
  const author = raw.user && typeof raw.user === "object" ? (raw.user as GitHubRecord) : {};
  return {
    number,
    title: text(raw.title) ?? `Pull request #${number}`,
    url: url(raw.html_url) ?? "",
    state: mergedAt ? "MERGED" : state === "CLOSED" ? "CLOSED" : "OPEN",
    draft: typeof raw.draft === "boolean" ? raw.draft : null,
    author: text(author.login),
    createdAt: text(raw.created_at),
    closedAt: text(raw.closed_at),
    headRef: text(head.ref),
    headSha: text(head.sha),
    baseRef: text(base.ref),
    baseSha: text(base.sha),
    mergeSha: text(raw.merge_commit_sha),
    commitCount: typeof raw.commits === "number" ? count(raw.commits) : null,
    changedFiles: typeof raw.changed_files === "number" ? count(raw.changed_files) : null,
    additions: typeof raw.additions === "number" ? count(raw.additions) : null,
    deletions: typeof raw.deletions === "number" ? count(raw.deletions) : null,
    updatedAt: text(raw.updated_at),
    mergedAt,
    checkState: checkState(checks),
    mergeableState: text(raw.mergeable_state),
  };
}

function workflowFrom(value: unknown): WorkflowRun | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as GitHubRecord;
  return {
    id: typeof raw.id === "number" ? raw.id : null,
    name: text(raw.name) ?? "Unnamed workflow",
    status: text(raw.status) ?? "UNKNOWN",
    conclusion: text(raw.conclusion),
    htmlUrl: url(raw.html_url),
    updatedAt: text(raw.updated_at),
  };
}

function safeCacheValue(key: string, value: unknown): unknown {
  if (key === "repo") return { default_branch: text((value as GitHubRecord | undefined)?.default_branch) };
  if (key === "head") {
    const object = (value as GitHubRecord | undefined)?.object;
    return { object: { sha: text(object && typeof object === "object" ? (object as GitHubRecord).sha : null) } };
  }
  if (key === "pulls" && Array.isArray(value))
    return value.map((entry) => {
      const raw = entry && typeof entry === "object" ? (entry as GitHubRecord) : {};
      const head = raw.head && typeof raw.head === "object" ? (raw.head as GitHubRecord) : {};
      const base = raw.base && typeof raw.base === "object" ? (raw.base as GitHubRecord) : {};
      return {
        number: count(raw.number),
        title: text(raw.title),
        state: text(raw.state),
        merged_at: text(raw.merged_at),
        closed_at: text(raw.closed_at),
        draft: typeof raw.draft === "boolean" ? raw.draft : null,
        user: { login: text((raw.user as GitHubRecord | undefined)?.login) },
        updated_at: text(raw.updated_at),
        html_url: url(raw.html_url),
        head: { ref: text(head.ref), sha: text(head.sha) },
        base: { ref: text(base.ref), sha: text(base.sha) },
        created_at: text(raw.created_at),
        merge_commit_sha: text(raw.merge_commit_sha),
        commits: typeof raw.commits === "number" ? count(raw.commits) : null,
        changed_files: typeof raw.changed_files === "number" ? count(raw.changed_files) : null,
        additions: typeof raw.additions === "number" ? count(raw.additions) : null,
        deletions: typeof raw.deletions === "number" ? count(raw.deletions) : null,
        mergeable_state: text(raw.mergeable_state),
      };
    });
  if (key === "runs") {
    const raw = value && typeof value === "object" ? (value as GitHubRecord) : {};
    return {
      workflow_runs: (Array.isArray(raw.workflow_runs) ? raw.workflow_runs : [])
        .map((entry) => {
          const workflow = workflowFrom(entry);
          return workflow
            ? {
                id: workflow.id,
                name: workflow.name,
                status: workflow.status,
                conclusion: workflow.conclusion,
                html_url: workflow.htmlUrl,
                updated_at: workflow.updatedAt,
              }
            : null;
        })
        .filter(Boolean),
    };
  }
  if (key.startsWith("checks:")) {
    const raw = value && typeof value === "object" ? (value as GitHubRecord) : {};
    return {
      check_runs: (Array.isArray(raw.check_runs) ? raw.check_runs : []).map((entry) => {
        const check = entry && typeof entry === "object" ? (entry as GitHubRecord) : {};
        return { status: text(check.status), conclusion: text(check.conclusion) };
      }),
    };
  }
  if (key.startsWith("compare:")) {
    const raw = value && typeof value === "object" ? (value as GitHubRecord) : {};
    const head = raw.head_commit && typeof raw.head_commit === "object" ? (raw.head_commit as GitHubRecord) : {};
    const commit = head.commit && typeof head.commit === "object" ? (head.commit as GitHubRecord) : {};
    const committer =
      commit.committer && typeof commit.committer === "object" ? (commit.committer as GitHubRecord) : {};
    return {
      ahead_by: count(raw.ahead_by),
      behind_by: count(raw.behind_by),
      head_commit: { sha: text(head.sha), commit: { committer: { date: text(committer.date) } } },
      commits: [{ commit: { committer: { date: text(committer.date) } } }],
    };
  }
  return value;
}

function snapshotFromCache(value: unknown, observedAt: string): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as GitHubRecord;
  const pullValues = Array.isArray(raw.pullRequests)
    ? raw.pullRequests
    : Array.isArray(raw.openPullRequests)
      ? raw.openPullRequests
      : [];
  const pulls = pullValues
    .map((pull) => {
      const existing = pull && typeof pull === "object" ? (pull as GitHubRecord) : {};
      if (!("headRef" in existing)) return pullFrom(pull);
      const number = count(existing.number);
      const state = text(existing.state);
      if (!number || !state || !["OPEN", "MERGED", "CLOSED", "UNKNOWN"].includes(state)) return null;
      return {
        number,
        title: text(existing.title) ?? `Pull request #${number}`,
        url: url(existing.url) ?? "",
        state: state as GithubPullRequestHistory["state"],
        draft: typeof existing.draft === "boolean" ? existing.draft : null,
        author: text(existing.author),
        updatedAt: text(existing.updatedAt),
        createdAt: text(existing.createdAt),
        closedAt: text(existing.closedAt),
        mergedAt: text(existing.mergedAt),
        headRef: text(existing.headRef),
        headSha: text(existing.headSha),
        baseRef: text(existing.baseRef),
        baseSha: text(existing.baseSha),
        mergeSha: text(existing.mergeSha),
        commitCount: typeof existing.commitCount === "number" ? count(existing.commitCount) : null,
        changedFiles: typeof existing.changedFiles === "number" ? count(existing.changedFiles) : null,
        additions: typeof existing.additions === "number" ? count(existing.additions) : null,
        deletions: typeof existing.deletions === "number" ? count(existing.deletions) : null,
        checkState: text(existing.checkState),
        mergeableState: text(existing.mergeableState),
      } satisfies GithubPullRequestHistory;
    })
    .filter((pull): pull is GithubPullRequestHistory => Boolean(pull));
  const branchValues = Array.isArray(raw.branches) ? raw.branches : [];
  const branches = branchValues
    .map((value) => {
      const branch = value && typeof value === "object" ? (value as GitHubRecord) : {};
      return {
        name: text(branch.name) ?? "UNKNOWN",
        headSha: text(branch.headSha),
        defaultSha: text(branch.defaultSha),
        ahead: typeof branch.ahead === "number" ? branch.ahead : null,
        behind: typeof branch.behind === "number" ? branch.behind : null,
        lastActivityAt: text(branch.lastActivityAt),
        pullRequestNumber: typeof branch.pullRequestNumber === "number" ? branch.pullRequestNumber : null,
        pullRequestState: ["OPEN", "MERGED", "CLOSED", "UNKNOWN"].includes(text(branch.pullRequestState) ?? "")
          ? (text(branch.pullRequestState) as GithubPullRequestHistory["state"])
          : null,
        compareState: branch.compareState === "AVAILABLE" ? "AVAILABLE" : "UNMEASURED",
      } satisfies BranchHealth;
    })
    .filter((branch) => branch.name !== "UNKNOWN");
  return {
    repository: text(raw.repository) ?? "UNKNOWN",
    defaultBranch: text(raw.defaultBranch) ?? "main",
    headSha: text(raw.headSha),
    pullRequests: pulls,
    openPullRequests: pulls.filter((pull) => pull.state === "OPEN"),
    workflows: (Array.isArray(raw.workflows) ? raw.workflows : [])
      .map(workflowFrom)
      .filter((workflow): workflow is WorkflowRun => Boolean(workflow)),
    branches,
    observedAt: text(raw.observedAt) ?? observedAt,
  };
}

export class GithubCollector {
  private rateLimitRemaining: number | null = null;
  private rateLimitLimit: number | null = null;
  private rateLimitResetAt: string | null = null;
  private rateMode: "NORMAL" | "CONSERVATION" | "CRITICAL" | "EXHAUSTED" | "UNKNOWN" = "UNKNOWN";
  private readonly interaction: GitHubInteractionClient;
  private readonly appAuth: GitHubAppAuth;
  private readonly sharedRuntime: SharedRuntimeState;
  private readonly poolId: string;

  constructor(
    private readonly config: Config,
    private readonly store: BridgewatchStore,
  ) {
    this.appAuth = new GitHubAppAuth({
      repository: config.BRIDGEWATCH_REPOSITORY,
      apiBase: config.BRIDGEWATCH_GITHUB_API,
      appId: config.BRIDGEWATCH_GITHUB_APP_ID,
      installationId: config.BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID,
      privateKeyPath: config.BRIDGEWATCH_GITHUB_APP_PRIVATE_KEY_PATH,
    });
    const authenticationKind = this.appAuth.configured()
      ? "GITHUB_APP_INSTALLATION"
      : config.BRIDGEWATCH_GITHUB_TOKEN
        ? "USER"
        : "ANONYMOUS";
    const principalFingerprint = fingerprint(
      this.appAuth.configured()
        ? `${config.BRIDGEWATCH_GITHUB_APP_ID}:${config.BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID}`
        : (config.BRIDGEWATCH_GITHUB_TOKEN ?? "anonymous"),
    );
    const pool = {
      kind: authenticationKind,
      repository: config.BRIDGEWATCH_REPOSITORY,
      principalFingerprint,
      id: credentialPoolId({
        kind: authenticationKind,
        repository: config.BRIDGEWATCH_REPOSITORY,
        principalFingerprint,
        installationId: config.BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID,
      }),
    };
    this.poolId = pool.id;
    this.sharedRuntime = new SharedRuntimeState(config.BRIDGEWATCH_REPOSITORY, config.BRIDGEWATCH_GITHUB_STATE_DIR);
    this.interaction = new GitHubInteractionClient({
      repository: config.BRIDGEWATCH_REPOSITORY,
      apiBase: config.BRIDGEWATCH_GITHUB_API,
      pool,
      runtime: this.sharedRuntime,
      tokenProvider: this.appAuth.configured()
        ? async () => (await this.appAuth.token()).token
        : config.BRIDGEWATCH_GITHUB_TOKEN
          ? async () => config.BRIDGEWATCH_GITHUB_TOKEN ?? null
          : null,
      requestTimeoutMs: config.BRIDGEWATCH_REQUEST_TIMEOUT_MS,
      thresholds: {
        conservation: config.BRIDGEWATCH_GITHUB_CONSERVATION_RATIO,
        critical: config.BRIDGEWATCH_GITHUB_CRITICAL_RATIO,
      },
    });
  }

  cached(): Snapshot | null {
    const cached = this.store.get<unknown>("github:snapshot");
    if (!cached) return null;
    return snapshotFromCache(cached.value, cached.observedAt);
  }

  recommendedRefreshInterval(): number {
    return nextPollInterval({
      mode: this.rateMode,
      minimumMs: Math.max(30_000, this.config.BRIDGEWATCH_SNAPSHOT_INTERVAL_MS),
      resetAt: this.rateLimitResetAt,
    });
  }

  async refresh(): Promise<Snapshot | null> {
    const base = `${this.config.BRIDGEWATCH_GITHUB_API}/repos/${this.config.BRIDGEWATCH_REPOSITORY}`;
    const attemptedAt = new Date().toISOString();
    this.rateLimitRemaining = null;
    this.rateLimitLimit = null;
    this.rateLimitResetAt = null;
    this.rateMode = "UNKNOWN";
    try {
      const [repo, pulls, runs] = await Promise.all([
        this.get<GitHubRecord>("repo", base),
        this.get<unknown[]>("pulls", `${base}/pulls?state=all&sort=updated&direction=desc&per_page=100`),
        this.get<GitHubRecord>("runs", `${base}/actions/runs?per_page=20`),
      ]);
      const branch = text(repo.default_branch) ?? this.config.BRIDGEWATCH_DEFAULT_BRANCH;
      const ref = await this.get<GitHubRecord>("head", `${base}/git/ref/heads/${encodeURIComponent(branch)}`);
      const headObject = ref.object && typeof ref.object === "object" ? (ref.object as GitHubRecord) : {};
      const headSha = text(headObject.sha);
      const batchedChecks = await this.collectCheckRuns(pulls);
      const normalizedPulls = await Promise.all(
        pulls.slice(0, 100).map(async (pull, index) => {
          const raw = pull && typeof pull === "object" ? (pull as GitHubRecord) : {};
          const number = count(raw.number);
          const checks =
            number && text(raw.state)?.toUpperCase() === "OPEN" && index < this.config.BRIDGEWATCH_GITHUB_MAX_BRANCHES
              ? batchedChecks?.has(number)
                ? batchedChecks.get(number)
                : await this.get<GitHubRecord>(
                    `checks:${number}`,
                    `${base}/commits/${encodeURIComponent(text((raw.head as GitHubRecord | undefined)?.sha) ?? "")}/check-runs?per_page=100`,
                  )
              : undefined;
          return pullFrom(raw, checks);
        }),
      );
      const pullRequests = normalizedPulls.filter((pull): pull is GithubPullRequestHistory => Boolean(pull));
      const branches = await this.collectBranches(
        base,
        branch,
        headSha,
        pullRequests,
        projectRegistry.flatMap((project) =>
          project.phases.map((phase) => phase.branch).filter((name): name is string => Boolean(name)),
        ),
      );
      const workflowRuns = Array.isArray(runs.workflow_runs) ? runs.workflow_runs : [];
      const snapshot: Snapshot = {
        repository: this.config.BRIDGEWATCH_REPOSITORY,
        defaultBranch: branch,
        headSha,
        pullRequests,
        openPullRequests: pullRequests.filter((pull) => pull.state === "OPEN"),
        workflows: workflowRuns.map(workflowFrom).filter((workflow): workflow is WorkflowRun => Boolean(workflow)),
        branches,
        observedAt: new Date().toISOString(),
      };
      this.store.put("github:snapshot", snapshot, null, snapshot.observedAt);
      this.store.replaceGithubObservations(snapshot, snapshot.observedAt);
      const interactionHealth = await this.interactionHealth();
      this.store.upsertSourceObservation({
        name: "github",
        state: this.githubSourceState(),
        configured: Boolean(this.config.BRIDGEWATCH_GITHUB_TOKEN) || this.appAuth.configured(),
        reachable: true,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: snapshot.observedAt,
        nextRetryAt: null,
        detail: null,
        cacheAgeMs: 0,
        rateLimitRemaining: this.rateLimitRemaining,
        rateLimitLimit: this.rateLimitLimit,
        rateLimitResetAt: this.rateLimitResetAt,
        rateMode: this.rateMode,
        credentialSource: this.appAuth.configured()
          ? "GITHUB_APP_INSTALLATION"
          : this.config.BRIDGEWATCH_GITHUB_TOKEN
            ? "USER_TOKEN"
            : "ANONYMOUS",
        appInstallationHealth: this.appAuth.configured()
          ? this.appAuth.health().active
            ? "ACTIVE"
            : "CONFIGURED"
          : "NOT_CONFIGURED",
        restRatePercent: interactionHealth.restRatePercent,
        graphqlRatePercent: interactionHealth.graphqlRatePercent,
        githubTelemetry: interactionHealth.metrics,
        authenticationState: this.appAuth.configured()
          ? "TOKEN_CONFIGURED"
          : this.config.BRIDGEWATCH_GITHUB_TOKEN
            ? "TOKEN_CONFIGURED"
            : "ANONYMOUS",
      });
      return snapshot;
    } catch (error) {
      const cached = this.cached();
      const detail =
        error instanceof Error ? error.message.replace(/[\r\n]+/gu, " ").slice(0, 500) : "GitHub refresh failed";
      const cacheAgeMs = cached ? Math.max(0, Date.now() - Date.parse(cached.observedAt)) : null;
      const interactionHealth = await this.interactionHealth();
      this.store.upsertSourceObservation({
        name: "github",
        state: cached ? "DEGRADED" : "UNAVAILABLE",
        configured: Boolean(this.config.BRIDGEWATCH_GITHUB_TOKEN) || this.appAuth.configured(),
        reachable: false,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: cached?.observedAt ?? null,
        nextRetryAt: new Date(Date.now() + this.recommendedRefreshInterval()).toISOString(),
        detail,
        cacheAgeMs,
        rateLimitRemaining: this.rateLimitRemaining,
        rateLimitLimit: this.rateLimitLimit,
        rateLimitResetAt: this.rateLimitResetAt,
        rateMode: this.rateMode,
        credentialSource: this.appAuth.configured()
          ? "GITHUB_APP_INSTALLATION"
          : this.config.BRIDGEWATCH_GITHUB_TOKEN
            ? "USER_TOKEN"
            : "ANONYMOUS",
        appInstallationHealth: this.appAuth.configured()
          ? this.appAuth.health().active
            ? "ACTIVE"
            : "CONFIGURED"
          : "NOT_CONFIGURED",
        restRatePercent: interactionHealth.restRatePercent,
        graphqlRatePercent: interactionHealth.graphqlRatePercent,
        githubTelemetry: interactionHealth.metrics,
        authenticationState: this.appAuth.configured()
          ? "TOKEN_CONFIGURED"
          : this.config.BRIDGEWATCH_GITHUB_TOKEN
            ? "TOKEN_CONFIGURED"
            : "ANONYMOUS",
      });
      return cached;
    }
  }

  private async interactionHealth(): Promise<{
    restRatePercent: number | null;
    graphqlRatePercent: number | null;
    metrics: Record<string, number>;
  }> {
    const status = (await this.sharedRuntime.status()) as {
      state?: { pools?: Record<string, { resources?: Record<string, { limit?: unknown; remaining?: unknown }> }> };
      telemetry?: { metrics?: Record<string, number> };
    };
    const resources = status.state?.pools?.[this.poolId]?.resources ?? {};
    const percent = (record: { limit?: unknown; remaining?: unknown } | undefined) => {
      const limit = Number(record?.limit);
      const remaining = Number(record?.remaining);
      return Number.isFinite(limit) && limit > 0 && Number.isFinite(remaining)
        ? Math.round((remaining / limit) * 10_000) / 100
        : null;
    };
    return {
      restRatePercent: percent(resources["rest:core"]),
      graphqlRatePercent: percent(resources["graphql:graphql"]),
      metrics: status.telemetry?.metrics ?? {},
    };
  }

  private githubSourceState(): "HEALTHY" | "CONSERVATION" | "DEGRADED" {
    const mode = this.rateMode;
    if (mode === "CONSERVATION") return "CONSERVATION";
    return mode === "CRITICAL" || mode === "EXHAUSTED" ? "DEGRADED" : "HEALTHY";
  }

  private async collectBranches(
    base: string,
    defaultBranch: string,
    defaultSha: string | null,
    pulls: GithubPullRequestHistory[],
    projectBranches: string[],
  ): Promise<BranchHealth[]> {
    const candidates = [
      ...new Set([
        ...pulls.map((pull) => pull.headRef).filter((branch): branch is string => Boolean(branch)),
        ...projectBranches,
      ]),
    ].slice(0, this.config.BRIDGEWATCH_GITHUB_MAX_BRANCHES);
    return Promise.all(
      candidates.map(async (branch) => {
        try {
          const compare = await this.get<GitHubRecord>(
            `compare:${branch}`,
            `${base}/compare/${encodeURIComponent(defaultBranch)}...${encodeURIComponent(branch)}`,
          );
          const commits = Array.isArray(compare.commits) ? compare.commits : [];
          const newest = commits.at(-1);
          const commit = newest && typeof newest === "object" ? (newest as GitHubRecord) : {};
          const nestedCommit =
            commit.commit && typeof commit.commit === "object" ? (commit.commit as GitHubRecord) : {};
          const associatedPull = pulls.find((pull) => pull.headRef === branch) ?? null;
          return {
            name: branch,
            headSha: text(
              compare.head_commit && typeof compare.head_commit === "object"
                ? (compare.head_commit as GitHubRecord).sha
                : null,
            ),
            defaultSha,
            ahead: count(compare.ahead_by),
            behind: count(compare.behind_by),
            lastActivityAt:
              text(
                nestedCommit.committer && typeof nestedCommit.committer === "object"
                  ? (nestedCommit.committer as GitHubRecord).date
                  : null,
              ) ??
              associatedPull?.updatedAt ??
              null,
            pullRequestNumber: associatedPull?.number ?? null,
            pullRequestState: associatedPull?.state ?? null,
            compareState: "AVAILABLE",
          } satisfies BranchHealth;
        } catch {
          const associatedPull = pulls.find((pull) => pull.headRef === branch) ?? null;
          return {
            name: branch,
            headSha: associatedPull?.headSha ?? null,
            defaultSha,
            ahead: null,
            behind: null,
            lastActivityAt: associatedPull?.updatedAt ?? null,
            pullRequestNumber: associatedPull?.number ?? null,
            pullRequestState: associatedPull?.state ?? null,
            compareState: "UNMEASURED",
          } satisfies BranchHealth;
        }
      }),
    );
  }

  private async get<T>(key: string, target: string): Promise<T> {
    const cached = this.store.get<unknown>(`github:${key}`);
    const prior = cached ? { ...cached, value: safeCacheValue(key, cached.value) as T } : null;
    if (prior) this.store.put(`github:${key}`, prior.value, prior.etag, prior.observedAt);
    const url = new URL(target);
    const response = await this.interaction.request<T>({
      path: `${url.pathname}${url.search}`,
      freshness: "LIVE",
      cacheKey: { consumer: "bridgewatch", key, repository: this.config.BRIDGEWATCH_REPOSITORY },
    });
    const remaining = Number(response.headers["x-ratelimit-remaining"]);
    if (Number.isInteger(remaining) && remaining >= 0) this.rateLimitRemaining = remaining;
    const limit = Number(response.headers["x-ratelimit-limit"]);
    if (Number.isInteger(limit) && limit > 0) this.rateLimitLimit = limit;
    const reset = Number(response.headers["x-ratelimit-reset"]);
    if (Number.isFinite(reset) && reset > 0) this.rateLimitResetAt = new Date(reset * 1000).toISOString();
    this.rateMode = rateMode(
      {
        limit: this.rateLimitLimit,
        remaining: this.rateLimitRemaining,
        resetAt: this.rateLimitResetAt,
      },
      {
        conservation: this.config.BRIDGEWATCH_GITHUB_CONSERVATION_RATIO,
        critical: this.config.BRIDGEWATCH_GITHUB_CRITICAL_RATIO,
      },
    );
    const value = safeCacheValue(key, response.body) as T;
    this.store.put(`github:${key}`, value, response.headers.etag ?? prior?.etag ?? null);
    return value;
  }

  private async collectCheckRuns(pulls: unknown[]): Promise<Map<number, GitHubRecord> | null> {
    const [owner, name] = this.config.BRIDGEWATCH_REPOSITORY.split("/");
    if (
      !owner ||
      !name ||
      !pulls.some((pull) => text((pull as GitHubRecord | undefined)?.state)?.toUpperCase() === "OPEN")
    )
      return new Map();
    try {
      const response = await this.interaction.graphql<{
        data?: { repository?: { pullRequests?: { nodes?: Array<Record<string, unknown>> } } };
      }>(
        "query BridgewatchPullChecks($owner:String!,$name:String!){rateLimit{limit remaining used resetAt cost} repository(owner:$owner,name:$name){pullRequests(first:100,states:OPEN,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number commits(last:1){nodes{commit{checkSuites(first:100){nodes{status conclusion}}}}}}}}}",
        { owner, name },
        {
          freshness: "SHORT",
          cacheKey: {
            consumer: "bridgewatch",
            operation: "pull-checks",
            repository: this.config.BRIDGEWATCH_REPOSITORY,
          },
        },
      );
      const nodes = response.body?.data?.repository?.pullRequests?.nodes;
      if (!Array.isArray(nodes)) return null;
      const checks = new Map<number, GitHubRecord>();
      for (const node of nodes) {
        const number = count(node.number);
        const commits = node.commits && typeof node.commits === "object" ? (node.commits as GitHubRecord) : {};
        const commitNodes = Array.isArray(commits.nodes) ? commits.nodes : [];
        const commit =
          commitNodes[0] && typeof commitNodes[0] === "object" ? (commitNodes[0] as GitHubRecord).commit : null;
        const suites = commit && typeof commit === "object" ? (commit as GitHubRecord).checkSuites : null;
        const suiteNodes =
          suites && typeof suites === "object" && Array.isArray((suites as GitHubRecord).nodes)
            ? ((suites as GitHubRecord).nodes as unknown[])
            : [];
        if (number)
          checks.set(number, {
            check_runs: suiteNodes.map((entry) => {
              const suite = entry && typeof entry === "object" ? (entry as GitHubRecord) : {};
              return {
                status: text(suite.status)?.toLowerCase() ?? null,
                conclusion: text(suite.conclusion)?.toLowerCase() ?? null,
              };
            }),
          });
      }
      return checks;
    } catch {
      return null;
    }
  }
}
