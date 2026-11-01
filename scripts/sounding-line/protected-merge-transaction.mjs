// A client-side transaction guard supplements, and never bypasses, GitHub's
// strict server-side protection. No status or release authority is minted here.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const exec = promisify(execFile);
const repo = "Kgray44/treasurehuntSoT";
const context = "Sounding Line / Mainline Decision";
const workflow = ".github/workflows/sounding-line-ordinary.yml";
const oid = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
const need = (value, code) => {
  if (!value) throw new Error(`SOUNDING_LINE_MERGE_TRANSACTION_${code}`);
};
const stamp = (value) => {
  const parsed = Date.parse(value);
  need(Number.isFinite(parsed), "TIME_INVALID");
  return parsed;
};
export function requireMergeProtection(protection, rulesets) {
  need(
    protection?.required_status_checks?.strict === true &&
      protection.required_status_checks.checks?.some((check) => check.context === context && check.app_id === 15368),
    "REQUIRED_CHECK_INVALID",
  );
  need(protection.enforce_admins?.enabled === true, "ADMINISTRATOR_BYPASS_ENABLED");
  // Unknown ruleset and bypass semantics require a fresh explicit audit.
  need(Array.isArray(rulesets) && rulesets.length === 0, "RULESET_AUDIT_REQUIRED");
  need(
    protection.allow_force_pushes?.enabled === false && protection.allow_deletions?.enabled === false,
    "HISTORY_PROTECTION_INVALID",
  );
}
export function requireQualificationBoundary({ pull, run, timeline, head, base, pr, trustedDispatchEvent }) {
  need(oid(head) && oid(base) && Number.isSafeInteger(pr) && pr > 0, "IDENTITY_INVALID");
  need(pull?.number === pr && pull.state === "open" && pull.merged === false && pull.draft === false, "NOT_READY");
  need(
    pull.head?.sha === head &&
      pull.base?.sha === base &&
      pull.base.ref === "main" &&
      pull.head.repo?.full_name === repo &&
      pull.base.repo?.full_name === repo,
    "SOURCE_MOVED",
  );
  need(
    run?.path === workflow && run.repository?.full_name === repo && run.head_repository?.full_name === repo,
    "UNTRUSTED_WORKFLOW",
  );
  if (run.event === "workflow_dispatch" && trustedDispatchEvent) {
    // Only the protected gate supplies its actual GitHub event. The standalone
    // merge client never accepts candidate-supplied dispatch claims.
    const inputs = trustedDispatchEvent.inputs;
    need(
      run.head_sha === base &&
        run.head_branch === "main" &&
        inputs?.base_sha === base &&
        inputs.candidate_sha === head &&
        Number(inputs.pr_number) === pr &&
        inputs.experience_mode === "ordinary" &&
        ![true, "true"].includes(inputs.experience_diagnostic),
      "RUN_SOURCE_MISMATCH",
    );
  } else {
    need(run.event === "pull_request_target" && run.head_sha === head, "UNTRUSTED_WORKFLOW");
    need(
      run.pull_requests?.length === 1 &&
        run.pull_requests[0].number === pr &&
        run.pull_requests[0].head?.sha === head &&
        run.pull_requests[0].base?.sha === base,
      "RUN_SOURCE_MISMATCH",
    );
  }
  need(Array.isArray(timeline), "READINESS_HISTORY_MISSING");
  const transitions = timeline.filter((event) => ["ready_for_review", "convert_to_draft"].includes(event.event));
  const latest = transitions.at(-1);
  need(!latest || latest.event === "ready_for_review", "READINESS_HISTORY_INVALID");
  const readyAt = latest?.created_at ?? pull.created_at;
  need(stamp(run.created_at) >= stamp(readyAt), "PRE_READY_QUALIFICATION");
  return { head, base, pr, runId: run.id, attempt: run.run_attempt, readyAt };
}
export function requireSuccessfulMergeDecision(snapshot) {
  const identity = requireQualificationBoundary(snapshot);
  requireMergeProtection(snapshot.protection, snapshot.rulesets);
  const { check, job, run } = snapshot;
  need(run.status === "completed" && run.conclusion === "success", "RUN_NOT_SUCCESSFUL");
  need(
    check?.name === context &&
      check.app?.id === 15368 &&
      check.head_sha === identity.head &&
      check.status === "completed" &&
      check.conclusion === "success",
    "CHECK_NOT_SUCCESSFUL",
  );
  need(
    check.details_url === `https://github.com/${repo}/actions/runs/${run.id}/job/${check.id}` &&
      job?.id === check.id &&
      job.run_id === run.id &&
      job.name === context &&
      job.run_attempt === run.run_attempt &&
      job.status === "completed" &&
      job.conclusion === "success",
    "CHECK_PROVENANCE_INVALID",
  );
  need(
    stamp(check.completed_at) >= stamp(identity.readyAt) && stamp(job.started_at) >= stamp(identity.readyAt),
    "PRE_READY_CHECK",
  );
  return { ...identity, checkId: check.id, qualification: false };
}

const github = async (endpoint, options = []) => {
  const result = await exec("gh", ["api", endpoint, ...options], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  return JSON.parse(result.stdout);
};
async function pages(api, endpoint) {
  const values = [];
  for (let page = 1; page <= 20; page++) {
    const data = await api(`${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const rows = Array.isArray(data) ? data : data.check_runs;
    need(Array.isArray(rows), "PAGINATION_INVALID");
    values.push(...rows);
    if (rows.length < 100) return values;
  }
  throw new Error("SOUNDING_LINE_MERGE_TRANSACTION_PAGINATION_LIMIT");
}
export async function loadTransaction({ pr, head, base, runId, successful = true, api = github }) {
  need(
    oid(head) && oid(base) && Number.isSafeInteger(pr) && pr > 0 && Number.isSafeInteger(runId) && runId > 0,
    "IDENTITY_INVALID",
  );
  const prefix = `repos/${repo}`;
  const [pull, run, timeline, protection, rulesets] = await Promise.all([
    api(`${prefix}/pulls/${pr}`),
    api(`${prefix}/actions/runs/${runId}`),
    pages(api, `${prefix}/issues/${pr}/timeline`),
    successful ? api(`${prefix}/branches/main/protection`) : null,
    successful ? pages(api, `${prefix}/rulesets?includes_parents=true`) : null,
  ]);
  const snapshot = { pull, run, timeline, protection, rulesets, pr, head, base };
  if (successful) {
    const checks = await pages(api, `${prefix}/commits/${head}/check-runs?filter=latest`);
    const matches = checks.filter(
      (check) =>
        check.name === context &&
        check.app?.id === 15368 &&
        check.details_url?.startsWith(`https://github.com/${repo}/actions/runs/${runId}/job/`),
    );
    need(matches.length === 1, "DECISION_MISSING_OR_AMBIGUOUS");
    snapshot.check = matches[0];
    snapshot.job = await api(`${prefix}/actions/jobs/${snapshot.check.id}`);
  }
  return snapshot;
}
export async function protectedMergeTransaction({ pr, head, base, runId, api = github, record = async () => {} }) {
  need(Number.isSafeInteger(runId) && runId > 0, "RUN_INVALID");
  let mergeRequested = false,
    observedMerge = null;
  try {
    const before = await loadTransaction({ pr, head, base, runId, api });
    const identity = requireSuccessfulMergeDecision(before);
    const actor = await api("user");
    need(actor.login === "Kgray44", "OWNER_REQUIRED");
    const permission = await api(`repos/${repo}/collaborators/${actor.login}/permission`);
    need(permission.permission === "admin", "OWNER_PERMISSION_CHANGED");
    const observed = {
      identity,
      actor: actor.login,
      permission: permission.permission,
      protection: before.protection,
      rulesets: before.rulesets,
    };
    await record({ event: "MERGE_PREFLIGHT", ...observed });
    // Re-read after receipt publication and immediately before the server's CAS.
    const current = await loadTransaction({ pr, head, base, runId, api });
    const currentIdentity = requireSuccessfulMergeDecision(current);
    need(JSON.stringify(currentIdentity) === JSON.stringify(identity), "TRANSACTION_CHANGED");
    need(
      JSON.stringify(current.protection) === JSON.stringify(before.protection) &&
        JSON.stringify(current.rulesets) === JSON.stringify(before.rulesets),
      "PROTECTION_CHANGED",
    );
    mergeRequested = true;
    const result = await api(`repos/${repo}/pulls/${pr}/merge`, [
      "--method",
      "PUT",
      "-f",
      `sha=${head}`,
      "-f",
      "merge_method=merge",
    ]);
    observedMerge = result.merged === true ? result.sha : null;
    need(result.merged === true && oid(result.sha), "SERVER_REFUSED");
    const after = await api(`repos/${repo}/pulls/${pr}`);
    need(
      after.merged === true && after.head.sha === head && after.merge_commit_sha === result.sha,
      "MERGE_OBSERVATION_MISMATCH",
    );
    const commit = await api(`repos/${repo}/git/commits/${result.sha}`);
    need(
      commit.parents?.length === 2 && commit.parents[0].sha === base && commit.parents[1].sha === head,
      "MERGE_PARENT_MISMATCH",
    );
    await record({
      event: "MERGE_OBSERVED",
      ...observed,
      merge: result.sha,
      parents: commit.parents.map((p) => p.sha),
    });
    return { ...identity, merge: result.sha };
  } catch (error) {
    const reason = /^SOUNDING_LINE_MERGE_TRANSACTION_[A-Z_]+$/u.test(error?.message ?? "")
      ? error.message
      : "SOUNDING_LINE_MERGE_TRANSACTION_SERVER_OR_TRANSPORT_FAILURE";
    await Promise.resolve()
      .then(() =>
        record({
          event: "MERGE_FAILURE",
          pr,
          head,
          base,
          runId,
          reason,
          mergeRequested,
          observedMerge,
          qualification: false,
        }),
      )
      .catch(() => {});
    throw error;
  }
}
async function main() {
  const args = process.argv.slice(2),
    options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2);
    need(
      args[index]?.startsWith("--") &&
        ["operation", "pr", "head", "base", "run", "receipt"].includes(key) &&
        !Object.hasOwn(options, key) &&
        typeof args[index + 1] === "string",
      "ARGUMENTS_INVALID",
    );
    options[key] = args[index + 1];
  }
  const input = { pr: Number(options.pr), head: options.head, base: options.base, runId: Number(options.run) };
  need(Number.isSafeInteger(input.runId) && input.runId > 0, "RUN_INVALID");
  if (options.operation === "gate") {
    need(
      process.env.GITHUB_SHA === input.base &&
        process.env.GITHUB_REF === "refs/heads/main" &&
        process.env.GITHUB_WORKFLOW_REF === `${repo}/${workflow}@refs/heads/main` &&
        process.env.GITHUB_RUN_ID === options.run,
      "UNTRUSTED_GATE",
    );
    const snapshot = await loadTransaction({ ...input, successful: false });
    const trustedDispatchEvent =
      process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
        ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"))
        : undefined;
    requireQualificationBoundary({ ...snapshot, trustedDispatchEvent });
  } else if (options.operation === "merge") {
    need(typeof options.receipt === "string", "RECEIPT_REQUIRED");
    const records = [];
    const record = async (value) => {
      records.push(value);
      const name = `${options.receipt}.${records.length}.json`;
      const bytes = JSON.stringify(value, null, 2) + "\n";
      await writeFile(name, bytes, { flag: "wx" });
      console.log(JSON.stringify({ receipt: name, sha256: createHash("sha256").update(bytes).digest("hex") }));
    };
    console.log(JSON.stringify(await protectedMergeTransaction({ ...input, record })));
  } else need(false, "OPERATION_INVALID");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
