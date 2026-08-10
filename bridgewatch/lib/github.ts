import type { Config } from "../src/config.js";
import { BridgewatchStore } from "./store.js";

export interface Snapshot { repository: string; defaultBranch: string; headSha: string | null; openPullRequests: unknown[]; workflows: unknown[]; observedAt: string; }

export class GithubCollector {
  constructor(private readonly config: Config, private readonly store: BridgewatchStore) {}

  cached(): Snapshot | null { return this.store.get<Snapshot>("github:snapshot")?.value ?? null; }

  async refresh(): Promise<Snapshot | null> {
    const base = `${this.config.BRIDGEWATCH_GITHUB_API}/repos/${this.config.BRIDGEWATCH_REPOSITORY}`;
    try {
      const [repo, pulls, runs] = await Promise.all([this.get<{ default_branch?: string }>("repo", base), this.get<unknown[]>("pulls", `${base}/pulls?state=open&per_page=50`), this.get<{ workflow_runs?: unknown[] }>("runs", `${base}/actions/runs?per_page=20`)]);
      const branch = repo.default_branch ?? this.config.BRIDGEWATCH_DEFAULT_BRANCH;
      const ref = await this.get<{ object?: { sha?: string } }>("head", `${base}/git/ref/heads/${encodeURIComponent(branch)}`);
      const snapshot: Snapshot = { repository: this.config.BRIDGEWATCH_REPOSITORY, defaultBranch: branch, headSha: ref.object?.sha ?? null, openPullRequests: pulls, workflows: runs.workflow_runs ?? [], observedAt: new Date().toISOString() };
      this.store.put("github:snapshot", snapshot, null, snapshot.observedAt); return snapshot;
    } catch { return this.cached(); }
  }

  private async get<T>(key: string, url: string): Promise<T> {
    const prior = this.store.get<T>(`github:${key}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.BRIDGEWATCH_REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "bridgewatch-phase1/0.1" };
      if (prior?.etag) headers["If-None-Match"] = prior.etag;
      if (this.config.BRIDGEWATCH_GITHUB_TOKEN) headers.Authorization = `Bearer ${this.config.BRIDGEWATCH_GITHUB_TOKEN}`;
      const response = await fetch(url, { method: "GET", headers, signal: controller.signal });
      if (response.status === 304 && prior) return prior.value;
      if (!response.ok) throw new Error(`GitHub GET failed: ${response.status}`);
      const value = await response.json() as T;
      this.store.put(`github:${key}`, value, response.headers.get("etag")); return value;
    } finally { clearTimeout(timer); }
  }
}
