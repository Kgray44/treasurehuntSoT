import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExactCandidateIdentity } from "./runtime";
import type { ExternalRunResult, NightwatchControlPlane } from "./controller";

type GitHubRun = {
  databaseId: number;
  status: string;
  conclusion: string | null;
  displayTitle: string;
  createdAt: string;
};
type PullRequest = { number: number; headRefOid: string };

const sha = (value: string) => /^[0-9a-f]{40}$/u.test(value);

/** GitHub CLI transport deliberately consumes the user's existing authenticated session and never reads or stores its token. */
export class GitHubCliControlPlane implements NightwatchControlPlane {
  constructor(
    private readonly repository: string,
    private readonly branch = "main",
  ) {}

  private gh(args: string[]) {
    return execFileSync("gh", args, { encoding: "utf8", windowsHide: true }).trim();
  }

  private api<T>(endpoint: string, fields: Record<string, string> = {}): T {
    const args = ["api", endpoint, "--repo", this.repository];
    if (Object.keys(fields).length)
      args.push("-X", "POST", ...Object.entries(fields).flatMap(([key, value]) => ["-f", `${key}=${value}`]));
    const output = this.gh(args);
    return (output ? JSON.parse(output) : undefined) as T;
  }

  private candidatePullRequest(ref: string, expectedSha: string): PullRequest {
    const branch = ref.replace(/^refs\/heads\//u, "");
    if (branch === ref) throw new Error("NIGHTWATCH_CANDIDATE_REF_INVALID");
    const pulls = JSON.parse(
      this.gh([
        "pr",
        "list",
        "--repo",
        this.repository,
        "--head",
        branch,
        "--base",
        this.branch,
        "--state",
        "open",
        "--json",
        "number,headRefOid",
      ]),
    ) as PullRequest[];
    if (pulls.length !== 1 || pulls[0]!.headRefOid !== expectedSha)
      throw new Error("NIGHTWATCH_CANDIDATE_PR_NOT_UNIQUE");
    return pulls[0]!;
  }

  currentIdentity(candidate: { branch: string; productHeadSha: string; localBaseSha: string }): ExactCandidateIdentity {
    const candidateRef = candidate.branch.startsWith("refs/") ? candidate.branch : `refs/heads/${candidate.branch}`;
    const pull = this.candidatePullRequest(candidateRef, candidate.productHeadSha);
    const pr = this.api<{ base: { sha: string }; head: { sha: string } }>(
      `repos/${this.repository}/pulls/${pull.number}`,
    );
    if (pr.head.sha !== candidate.productHeadSha || pr.base.sha !== candidate.localBaseSha)
      throw new Error("NIGHTWATCH_CANDIDATE_IDENTITY_CHANGED");
    const candidateCommit = this.api<{ tree: { sha: string } }>(
      `repos/${this.repository}/git/commits/${candidate.productHeadSha}`,
    );
    const baseCommit = this.api<{ tree: { sha: string } }>(
      `repos/${this.repository}/git/commits/${candidate.localBaseSha}`,
    );
    return {
      candidateSha: candidate.productHeadSha,
      candidateTreeSha: candidateCommit.tree.sha,
      baseSha: candidate.localBaseSha,
      baseTreeSha: baseCommit.tree.sha,
      candidateRef,
    };
  }

  preflight() {
    return { deterministicRegistryHealthy: true, ownershipResolved: true, identityStable: true, leaseAvailable: true };
  }

  private exactDispatchedRun(workflow: string, title: string) {
    const runs = JSON.parse(
      this.gh([
        "run",
        "list",
        "--repo",
        this.repository,
        "--workflow",
        workflow,
        "--event",
        "workflow_dispatch",
        "--limit",
        "100",
        "--json",
        "databaseId,status,conclusion,displayTitle,createdAt",
      ]),
    ) as GitHubRun[];
    const matches = runs.filter((run) => run.displayTitle === title);
    if (matches.length > 1) throw new Error("NIGHTWATCH_DISPATCH_RUN_AMBIGUOUS");
    return matches[0] ?? null;
  }

  private dispatch(workflow: string, title: string, inputs: Record<string, string>) {
    const prior = this.exactDispatchedRun(workflow, title);
    if (prior) return { runId: String(prior.databaseId) };
    this.api<unknown>(`repos/${this.repository}/actions/workflows/${workflow}/dispatches`, {
      ref: this.branch,
      ...Object.fromEntries(Object.entries(inputs).map(([key, value]) => [`inputs[${key}]`, value])),
    });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const run = this.exactDispatchedRun(workflow, title);
      if (run) return { runId: String(run.databaseId) };
    }
    throw new Error("NIGHTWATCH_DISPATCH_RUN_UNAVAILABLE");
  }

  dispatchAuthority(input: ExactCandidateIdentity & { dispatchKey: string }) {
    const pull = this.candidatePullRequest(input.candidateRef, input.candidateSha);
    return this.dispatch("sounding-line-authoritative.yml", `Sounding Line authoritative ${input.dispatchKey}`, {
      gate: "mainline",
      candidate_sha: input.candidateSha,
      candidate_ref: input.candidateRef,
      pr_number: String(pull.number),
      base_sha: input.baseSha,
      authority_mode: "candidate",
      nightwatch_dispatch_key: input.dispatchKey,
    });
  }

  dispatchBinding(input: ExactCandidateIdentity & { authorityRunId: string; dispatchKey: string }) {
    const pull = this.candidatePullRequest(input.candidateRef, input.candidateSha);
    return this.dispatch(
      "sounding-line-protected-binding-dispatch.yml",
      `Sounding Line protected binding ${input.dispatchKey}`,
      {
        pr_number: String(pull.number),
        candidate_sha: input.candidateSha,
        candidate_ref: input.candidateRef,
        base_sha: input.baseSha,
        authority_run_id: input.authorityRunId,
        nightwatch_dispatch_key: input.dispatchKey,
      },
    );
  }

  private artifactJson(runId: string, name: string) {
    const directory = mkdtempSync(join(tmpdir(), "nightwatch-artifact-"));
    try {
      this.gh(["run", "download", runId, "--repo", this.repository, "--name", name, "--dir", directory]);
      const paths = readdirSync(directory, { recursive: true }).filter((entry) => String(entry).endsWith(".json"));
      if (paths.length !== 1) throw new Error("NIGHTWATCH_ARTIFACT_NOT_UNIQUE");
      return JSON.parse(readFileSync(join(directory, String(paths[0])), "utf8")) as { decision?: unknown };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  observeRun(input: { runId: string; stage: "AUTHORITY" | "BINDING" }): ExternalRunResult {
    const run = JSON.parse(
      this.gh(["run", "view", input.runId, "--repo", this.repository, "--json", "status,conclusion"]),
    ) as { status: string; conclusion: string | null };
    if (run.status !== "completed") return "PENDING";
    if (run.conclusion !== "success") return input.stage === "AUTHORITY" ? "REJECTED" : "BINDING_REJECTED";
    const receipt = this.artifactJson(
      input.runId,
      input.stage === "AUTHORITY" ? "sounding-line-finalization" : "nightwatch-protected-binding-receipt",
    );
    if (input.stage === "AUTHORITY") return receipt.decision === "RELEASE_GO" ? "RELEASE_GO" : "REJECTED";
    return receipt.decision === "BINDING_PASS" ? "BINDING_PASS" : "BINDING_REJECTED";
  }

  requestMerge(input: ExactCandidateIdentity) {
    const pull = this.candidatePullRequest(input.candidateRef, input.candidateSha);
    this.gh(["pr", "merge", String(pull.number), "--repo", this.repository, "--merge"]);
    const main = this.protectedMain();
    return main.treeSha === input.candidateTreeSha ? { mergeSha: main.sha, treeSha: main.treeSha } : null;
  }

  cancelRun(input: { runId: string }) {
    this.gh(["run", "cancel", input.runId, "--repo", this.repository]);
  }

  protectedMain() {
    const ref = this.api<{ object: { sha: string } }>(`repos/${this.repository}/git/ref/heads/${this.branch}`);
    if (!sha(ref.object.sha)) throw new Error("NIGHTWATCH_PROTECTED_MAIN_SHA_INVALID");
    const commit = this.api<{ tree: { sha: string } }>(`repos/${this.repository}/git/commits/${ref.object.sha}`);
    return { sha: ref.object.sha, treeSha: commit.tree.sha };
  }
}
