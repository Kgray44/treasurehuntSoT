import type { Config } from "../src/config.js";
import type { BranchHealth, GithubHistorySnapshot, GithubPullRequestHistory } from "../src/history.js";
import { projectRegistry } from "../src/registry.js";
import { BridgewatchStore } from "./store.js";

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
  return {
    number,
    title: text(raw.title) ?? `Pull request #${number}`,
    url: url(raw.html_url) ?? "",
    state: mergedAt ? "MERGED" : state === "CLOSED" ? "CLOSED" : "OPEN",
    createdAt: text(raw.created_at),
    headRef: text(head.ref),
    headSha: text(head.sha),
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
        updated_at: text(raw.updated_at),
        html_url: url(raw.html_url),
        head: { ref: text(head.ref), sha: text(head.sha) },
        base: { ref: text(base.ref) },
        created_at: text(raw.created_at),
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
        updatedAt: text(existing.updatedAt),
        createdAt: text(existing.createdAt),
        mergedAt: text(existing.mergedAt),
        headRef: text(existing.headRef),
        headSha: text(existing.headSha),
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

  constructor(
    private readonly config: Config,
    private readonly store: BridgewatchStore,
  ) {}

  cached(): Snapshot | null {
    const cached = this.store.get<unknown>("github:snapshot");
    if (!cached) return null;
    return snapshotFromCache(cached.value, cached.observedAt);
  }

  async refresh(): Promise<Snapshot | null> {
    const base = `${this.config.BRIDGEWATCH_GITHUB_API}/repos/${this.config.BRIDGEWATCH_REPOSITORY}`;
    const attemptedAt = new Date().toISOString();
    this.rateLimitRemaining = null;
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
      const normalizedPulls = await Promise.all(
        pulls.slice(0, 100).map(async (pull, index) => {
          const raw = pull && typeof pull === "object" ? (pull as GitHubRecord) : {};
          const number = count(raw.number);
          const checks =
            number && text(raw.state)?.toUpperCase() === "OPEN" && index < this.config.BRIDGEWATCH_GITHUB_MAX_BRANCHES
              ? await this.get<GitHubRecord>(
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
      this.store.upsertSourceObservation({
        name: "github",
        state: "HEALTHY",
        configured: Boolean(this.config.BRIDGEWATCH_GITHUB_TOKEN),
        reachable: true,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: snapshot.observedAt,
        nextRetryAt: null,
        detail: null,
        cacheAgeMs: 0,
        rateLimitRemaining: this.rateLimitRemaining,
        authenticationState: this.config.BRIDGEWATCH_GITHUB_TOKEN ? "TOKEN_CONFIGURED" : "ANONYMOUS",
      });
      return snapshot;
    } catch (error) {
      const cached = this.cached();
      const detail =
        error instanceof Error ? error.message.replace(/[\r\n]+/gu, " ").slice(0, 500) : "GitHub refresh failed";
      const cacheAgeMs = cached ? Math.max(0, Date.now() - Date.parse(cached.observedAt)) : null;
      this.store.upsertSourceObservation({
        name: "github",
        state: cached ? "DEGRADED" : "UNAVAILABLE",
        configured: Boolean(this.config.BRIDGEWATCH_GITHUB_TOKEN),
        reachable: false,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: cached?.observedAt ?? null,
        nextRetryAt: new Date(Date.now() + this.config.BRIDGEWATCH_SNAPSHOT_INTERVAL_MS).toISOString(),
        detail,
        cacheAgeMs,
        rateLimitRemaining: this.rateLimitRemaining,
        authenticationState: this.config.BRIDGEWATCH_GITHUB_TOKEN ? "TOKEN_CONFIGURED" : "ANONYMOUS",
      });
      return cached;
    }
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.BRIDGEWATCH_REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "bridgewatch-phase3/0.1",
      };
      if (prior?.etag) headers["If-None-Match"] = prior.etag;
      if (this.config.BRIDGEWATCH_GITHUB_TOKEN)
        headers.Authorization = `Bearer ${this.config.BRIDGEWATCH_GITHUB_TOKEN}`;
      const response = await fetch(target, { method: "GET", headers, signal: controller.signal });
      const remaining = Number(response.headers.get("x-ratelimit-remaining"));
      if (Number.isInteger(remaining) && remaining >= 0) this.rateLimitRemaining = remaining;
      if (response.status === 304 && prior) return prior.value;
      if (!response.ok) throw new Error(`GitHub GET failed: ${response.status}`);
      const value = safeCacheValue(key, await response.json()) as T;
      this.store.put(`github:${key}`, value, response.headers.get("etag"));
      return value;
    } finally {
      clearTimeout(timer);
    }
  }
}
