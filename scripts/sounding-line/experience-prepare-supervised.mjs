import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PREPARATION_JOB_MS,
  PREPARATION_ROOT,
  PREPARATION_TAIL_MS,
  validPreparationBinding,
} from "./preparation-phases.mjs";
import {
  createPreparationSession,
  createPreparationStatusPublisher,
  supervisePreparation,
} from "./preparation-supervisor.mjs";

export async function preparationJobBudget({ binding, token, now = Date.now, request = fetch }) {
  const response = await request(
    "https://api.github.com/repos/" +
      binding.repository +
      "/actions/runs/" +
      binding.runId +
      "/attempts/" +
      binding.attempt +
      "/jobs?per_page=100",
    {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error("SOUNDING_LINE_PREPARATION_JOB_BINDING_INVALID");
  }
  const data = await response.json();
  const matches = data.jobs?.filter(
    (job) =>
      job.name === "Sounding Line / Experience preparation (no mainline decision)" && job.status === "in_progress",
  );
  if (matches?.length !== 1) throw new Error("SOUNDING_LINE_PREPARATION_JOB_BINDING_INVALID");
  const started = Date.parse(matches[0].started_at);
  const elapsed = now() - started;
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error("SOUNDING_LINE_PREPARATION_JOB_BINDING_INVALID");
  const remaining = Math.min(
    PREPARATION_JOB_MS - PREPARATION_TAIL_MS,
    PREPARATION_JOB_MS - elapsed - PREPARATION_TAIL_MS,
  );
  if (remaining <= 0) throw new Error("SOUNDING_LINE_PREPARATION_JOB_BUDGET_EXHAUSTED");
  return remaining;
}

async function main() {
  const argv = process.argv.slice(2);
  const allowed = new Set(["workspace", "base", "candidate", "mode", "diagnostic", "evidence"]);
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.slice(2);
    if (
      !argv[index]?.startsWith("--") ||
      !allowed.has(key) ||
      Object.hasOwn(options, key) ||
      typeof argv[index + 1] !== "string"
    )
      throw new Error("SOUNDING_LINE_PREPARATION_ARGUMENTS_INVALID");
    options[key] = argv[index + 1];
  }
  if (
    options.mode !== "capture" ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/main" ||
    process.env.GITHUB_SHA !== options.base
  )
    throw new Error("SOUNDING_LINE_PREPARATION_REQUIRES_PROTECTED_BASE_CAPTURE");
  const binding = {
    repository: process.env.GITHUB_REPOSITORY,
    base: options.base,
    candidate: options.candidate,
    runId: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
  };
  if (!validPreparationBinding({ version: 1, ...binding, nonce: "00000000-0000-0000-0000-000000000000" }))
    throw new Error("SOUNDING_LINE_PREPARATION_BINDING_INVALID");
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("SOUNDING_LINE_PREPARATION_PROGRESS_CREDENTIAL_MISSING");
  const budget = await preparationJobBudget({ binding, token });
  const budgetStarted = performance.now();
  const session = await createPreparationSession({ authorityRoot: PREPARATION_ROOT, binding });
  const progressPath = path.relative(process.cwd(), session.publicDirectory).split(path.sep).join("/");
  if (
    !/^authority\/artifacts\/sounding-line\/preparation-supervision\/session-[A-Za-z0-9_-]+\/public$/u.test(
      progressPath,
    )
  )
    throw new Error("SOUNDING_LINE_PREPARATION_OUTPUT_INVALID");
  await appendFile(process.env.GITHUB_OUTPUT, "preparation_progress_path=" + progressPath + "\n");
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const receipt = await supervisePreparation({
      session,
      root: process.cwd(),
      command: process.execPath,
      args: [path.join(PREPARATION_ROOT, "scripts/sounding-line/experience-prepare.mjs"), ...argv],
      environment: process.env,
      signal: cancellation.signal,
      absoluteMs: budget - (performance.now() - budgetStarted),
      publish: createPreparationStatusPublisher({ binding: session.binding, token }),
    });
    process.exitCode =
      receipt.status === "PASS"
        ? 0
        : Number.isInteger(receipt.child?.code) && receipt.child.code > 0
          ? receipt.child.code
          : 1;
  } catch {
    await writeFile(
      path.join(session.publicDirectory, "startup-failure.json"),
      JSON.stringify({
        version: 1,
        binding: session.binding,
        status: "FAIL",
        reason: "SUPERVISOR_INCOMPLETE",
        cleanup: "UNAVAILABLE",
        qualification: false,
      }) + "\n",
      { flag: "wx" },
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch {
    console.error("SOUNDING_LINE_PREPARATION_SUPERVISION_FAILED");
    process.exitCode = 1;
  }
}
