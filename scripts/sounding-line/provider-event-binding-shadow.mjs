// Data-only inspection. A copy of a provider log does not authenticate transport,
// installed workflow source, a completed receipt, or eligibility for reuse.
import { createHash } from "node:crypto";
const repository = "Kgray44/treasurehuntSoT";
const workflow = ".github/workflows/sounding-line-ordinary.yml";
const jobName = "Sounding Line / Focused verification";
const stepName = "Bind the event to exact source identities";
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_EVENT_BINDING_SHADOW_${code}`);
};
function data(bytes, maximum) {
  need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximum, "BYTES_BOUND");
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Error("SOUNDING_LINE_EVENT_BINDING_SHADOW_JSON");
  }
  need(object(parsed), "JSON_ROOT");
  let count = 0;
  const pending = [[parsed, 0]];
  while (pending.length) {
    const [value, depth] = pending.pop();
    need(++count <= 20000 && depth <= 32, "STRUCTURE_BOUND");
    if (value && typeof value === "object") {
      const children = Object.values(value);
      need(children.length <= 10000, "STRUCTURE_BOUND");
      for (const child of children) pending.push([child, depth + 1]);
    }
  }
  return parsed;
}
const time = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) ? Date.parse(value) : NaN;

export function observeOriginalEventBinding({ runBytes, jobsBytes, nativeStepLogBytes, runId, attempt, prNumber }) {
  need([runId, attempt, prNumber].every(positive) && ![721, 776, 805].includes(prNumber), "ORDINARY_SCOPE");
  const run = data(runBytes, 2 * 1024 * 1024),
    jobs = data(jobsBytes, 2 * 1024 * 1024);
  need(
    run.id === runId &&
      run.run_attempt === attempt &&
      run.status === "completed" &&
      ["success", "failure", "cancelled"].includes(run.conclusion) &&
      run.event === "pull_request_target" &&
      run.path === workflow &&
      positive(run.workflow_id) &&
      sha(run.head_sha) &&
      positive(run.repository?.id) &&
      run.repository.full_name === repository &&
      run.head_repository?.id === run.repository.id &&
      run.head_repository.full_name === repository &&
      Array.isArray(run.referenced_workflows) &&
      run.referenced_workflows.length === 0,
    "RUN",
  );
  need(
    run.actor?.login === "Kgray44" &&
      positive(run.actor.id) &&
      run.triggering_actor?.id === run.actor.id &&
      run.triggering_actor.login === run.actor.login &&
      run.repository.owner?.id === run.actor.id &&
      run.repository.owner.login === run.actor.login,
    "OWNER",
  );
  need(run.display_title === `Sounding Line finite 1 ordinary ${prNumber} ${run.head_sha} active`, "RUN_SCOPE");
  need(Array.isArray(run.pull_requests) && run.pull_requests.length <= 1, "PULL_REQUEST");
  const pr = run.pull_requests[0];
  if (run.pull_requests.length)
    need(
      object(pr) &&
        pr.number === prNumber &&
        pr.base?.ref === "main" &&
        pr.base.repo?.id === run.repository.id &&
        pr.head?.repo?.id === run.repository.id &&
        pr.head.ref === run.head_branch &&
        sha(pr.base.sha) &&
        sha(pr.head.sha),
      "PULL_REQUEST",
    );
  // Association SHAs are mutable provider observations, never original source
  // authority. Return them as observations alongside the separately parsed log.
  need(
    Array.isArray(jobs.jobs) &&
      jobs.total_count === jobs.jobs.length &&
      jobs.jobs.length > 0 &&
      jobs.jobs.length <= 100,
    "JOBS",
  );
  need(jobs.jobs.every(object), "JOBS");
  const matching = jobs.jobs.filter((job) => job.name === jobName);
  need(matching.length === 1, "JOB_AMBIGUOUS");
  const job = matching[0];
  need(
    positive(job.id) &&
      job.run_id === runId &&
      job.run_attempt === attempt &&
      job.head_sha === run.head_sha &&
      job.status === "completed" &&
      ["success", "failure", "cancelled"].includes(job.conclusion) &&
      Array.isArray(job.steps) &&
      job.steps.length >= 3 &&
      job.steps.length <= 100,
    "JOB",
  );
  need(
    job.steps.every(
      (step, index) =>
        object(step) && positive(step.number) && (index === 0 || step.number > job.steps[index - 1].number),
    ),
    "STEP_ORDER",
  );
  const setup = job.steps[0],
    bound = job.steps[1];
  need(
    setup.number === 1 &&
      setup.name === "Set up job" &&
      setup.status === "completed" &&
      setup.conclusion === "success" &&
      bound.number === 2 &&
      bound.name === stepName &&
      bound.status === "completed" &&
      bound.conclusion === "success" &&
      job.steps.filter((step) => step.name === stepName).length === 1,
    "PRE_EXECUTION_STEP",
  );
  const start = time(bound.started_at),
    end = time(bound.completed_at);
  need(
    Number.isFinite(start) &&
      Number.isFinite(end) &&
      end >= start &&
      end - start <= 60000 &&
      Number.isFinite(time(setup.completed_at)) &&
      time(setup.completed_at) <= start &&
      Number.isFinite(time(job.steps[2].started_at)) &&
      time(job.steps[2].started_at) >= end,
    "STEP_TIME",
  );
  need(
    Buffer.isBuffer(nativeStepLogBytes) && nativeStepLogBytes.length > 0 && nativeStepLogBytes.length <= 16384,
    "LOG_BOUND",
  );
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(nativeStepLogBytes);
  } catch {
    throw Error("SOUNDING_LINE_EVENT_BINDING_SHADOW_LOG_UTF8");
  }
  need(text.endsWith("\n") && !text.includes("\0"), "LOG_FRAMING");
  const lines = text.replaceAll("\r\n", "\n").slice(0, -1).split("\n");
  need(lines.length === 12, "LOG_FRAMING");
  let previous = start;
  const rendered = lines.map((line) => {
    const frame = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z) (.*)$/u.exec(line);
    need(frame, "LOG_FRAMING");
    const timestamp = Date.parse(frame[1]);
    need(
      Number.isFinite(timestamp) && timestamp >= previous && timestamp >= start && timestamp < end + 1000,
      "LOG_TIME",
    );
    previous = timestamp;
    return frame[2];
  });
  const base = /^\u001b\[36;1m  echo "base=([a-f0-9]{40})" >> "\$GITHUB_OUTPUT"\u001b\[0m$/u.exec(rendered[2]);
  need(base, "ORIGINAL_BASE");
  const source = [
    '##[group]Run if [ "pull_request_target" = "pull_request_target" ]; then',
    '\u001b[36;1mif [ "pull_request_target" = "pull_request_target" ]; then\u001b[0m',
    `\u001b[36;1m  echo "base=${base[1]}" >> "$GITHUB_OUTPUT"\u001b[0m`,
    `\u001b[36;1m  echo "candidate=${run.head_sha}" >> "$GITHUB_OUTPUT"\u001b[0m`,
    `\u001b[36;1m  echo "repository=${repository}" >> "$GITHUB_OUTPUT"\u001b[0m`,
    "\u001b[36;1melse\u001b[0m",
    '\u001b[36;1m  echo "base=" >> "$GITHUB_OUTPUT"\u001b[0m',
    '\u001b[36;1m  echo "candidate=" >> "$GITHUB_OUTPUT"\u001b[0m',
    `\u001b[36;1m  echo "repository=${repository}" >> "$GITHUB_OUTPUT"\u001b[0m`,
    "\u001b[36;1mfi\u001b[0m",
    "shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}",
    "##[endgroup]",
  ];
  // The native sample is twelve lines; reject any unrecognized runner layout.
  need(rendered.length === source.length && rendered.every((line, index) => line === source[index]), "SOURCE_LAYOUT");
  return Object.freeze({
    classification: "ORIGINAL_EVENT_STEP_OBSERVATION_NOT_PROVIDER_AUTHENTICATION",
    runId,
    attempt,
    prNumber,
    jobId: job.id,
    stepNumber: bound.number,
    originalBaseSha: base[1],
    originalCandidateSha: run.head_sha,
    currentAssociation: pr ? Object.freeze({ baseSha: pr.base.sha, candidateSha: pr.head.sha }) : null,
    logSha256: createHash("sha256").update(nativeStepLogBytes).digest("hex"),
    qualification: false,
    reuseAuthorized: false,
  });
}
