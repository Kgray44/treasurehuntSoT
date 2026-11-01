import { appendFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verificationBudgetFromElapsed, verificationJobLimit } from "./verification-budget.mjs";
import { readNativeVerificationClock } from "./verification-job-clock.mjs";
import { verificationCapacity820 } from "./verification-capacity-820.mjs";
import { verificationPreflight } from "./verification-preflight.mjs";
import { superviseVerification } from "./verification-supervisor.mjs";

const fail = (code) => {
  throw new Error(`SOUNDING_LINE_VERIFICATION_${code}`);
};
export function ordinaryVerificationInvocation({
  workspace,
  baseSha,
  candidateSha,
  authorityRoot = fileURLToPath(new URL("../../", import.meta.url)),
  workingDirectory = process.cwd(),
}) {
  if (
    typeof workspace !== "string" ||
    !workspace ||
    workspace.includes("\0") ||
    !/^[a-f0-9]{40}$/u.test(baseSha ?? "") ||
    !/^[a-f0-9]{40}$/u.test(candidateSha ?? "")
  )
    fail("ARGUMENTS_INVALID");
  const root = path.resolve(workingDirectory, workspace);
  return {
    root,
    command: process.execPath,
    args: [
      path.join(authorityRoot, "scripts/sounding-line/ordinary.mjs"),
      "--mode",
      "ordinary",
      "--workspace",
      root,
      "--base",
      baseSha,
      "--candidate",
      candidateSha,
    ],
  };
}
export async function currentVerificationJob({
  env = process.env,
  request = fetch,
  now = Date.now,
  candidateSha,
  root,
  clock = readNativeVerificationClock,
  monotonic = () => performance.now(),
}) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_JOB !== "final-check" ||
    env.GITHUB_REPOSITORY !== "Kgray44/treasurehuntSoT" ||
    !/^[1-9]\d*$/u.test(env.GITHUB_RUN_ID ?? "") ||
    !/^[1-9]\d*$/u.test(env.GITHUB_RUN_ATTEMPT ?? "") ||
    !/^[a-f0-9]{40}$/u.test(candidateSha ?? "") ||
    env.GITHUB_REF !== "refs/heads/main" ||
    !env.GH_TOKEN ||
    env.GITHUB_WORKFLOW_REF !== "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/main"
  )
    fail("JOB_BINDING_INVALID");
  const observation = {
    runId: env.GITHUB_RUN_ID,
    attempt: env.GITHUB_RUN_ATTEMPT,
    candidateSha,
    providerJob: null,
    providerHttpDate: null,
  };
  try {
    const capacityGrant = await verificationCapacity820({ root, baseSha: env.GITHUB_SHA, candidateSha, env });
    const lookupBegan = monotonic();
    const response = await request(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT}/jobs?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    observation.httpStatus = response.status;
    observation.providerHttpDate = response.headers?.get?.("date") ?? null;
    if (response.status !== 200) {
      await response.body?.cancel();
      fail("JOB_BINDING_INVALID");
    }
    const data = await response.json();
    const lookupMs = monotonic() - lookupBegan;
    // A truncated page or an ambiguous job is not a fresh clock.
    if (
      !Number.isSafeInteger(data.total_count) ||
      data.total_count < 1 ||
      data.total_count > 100 ||
      !Array.isArray(data.jobs) ||
      data.jobs.length !== data.total_count
    )
      fail("JOB_BINDING_INVALID");
    const matches = data.jobs.filter(
      (job) =>
        job.name === "Sounding Line / Focused verification" &&
        job.status === "in_progress" &&
        String(job.run_id) === env.GITHUB_RUN_ID,
    );
    if (matches.length !== 1) fail("JOB_BINDING_INVALID");
    const job = matches[0];
    observation.providerJob = {
      id: job.id,
      name: job.name,
      runId: job.run_id,
      attempt: job.run_attempt,
      candidateSha: job.head_sha,
      started_at: job.started_at,
    };
    if (
      !Number.isSafeInteger(job.id) ||
      job.id <= 0 ||
      String(job.run_attempt) !== env.GITHUB_RUN_ATTEMPT ||
      job.head_sha !== candidateSha ||
      !Number.isFinite(Date.parse(job.started_at))
    )
      fail("JOB_BINDING_INVALID");
    const localNow = now();
    if (!Number.isSafeInteger(localNow)) fail("JOB_BINDING_INVALID");
    const providerSetupMs = localNow - Date.parse(job.started_at);
    Object.assign(observation, { localNow, providerSetupMs });
    const setupSteps = Array.isArray(job.steps)
      ? job.steps.filter((step) => step.number === 1 && step.name === "Set up job")
      : [];
    const first = setupSteps[0],
      httpNow = Date.parse(observation.providerHttpDate);
    observation.setupStep = first
      ? { number: first.number, name: first.name, started_at: first.started_at, status: first.status }
      : null;
    const firstStarted = Date.parse(first?.started_at);
    const fraction = typeof first?.started_at === "string" ? /\.(\d{1,3})Z$/u.exec(first.started_at)?.[1] : undefined;
    const timestampQuantumMs = fraction ? 10 ** (3 - fraction.length) : 1000;
    if (
      !Number.isFinite(lookupMs) ||
      lookupMs < 0 ||
      setupSteps.length !== 1 ||
      !["completed", "in_progress"].includes(first.status) ||
      !Number.isFinite(firstStarted) ||
      !Number.isFinite(httpNow) ||
      httpNow > localNow + 1000 ||
      localNow - httpNow > lookupMs + 1000 ||
      firstStarted > localNow
    )
      fail("NATIVE_CLOCK_UNAVAILABLE");
    observation.setupStepElapsedMs = localNow - firstStarted;
    observation.timestampRoundingDebitMs = timestampQuantumMs;
    const began = monotonic(),
      native = clock(),
      captureMs = monotonic() - began;
    if (
      !Number.isFinite(captureMs) ||
      captureMs < 0 ||
      native?.kind !== "ANCESTRAL_HOSTED_LISTENER_EXECUTION_UPPER_BOUND" ||
      native.originPid !== process.pid ||
      !Number.isSafeInteger(native.setupMs) ||
      native.setupMs < 0
    )
      fail("NATIVE_CLOCK_UNAVAILABLE");
    // The complete Listener execution age is always debited. A coherent provider
    // age can only increase the debit. A future header is retained, not clamped,
    // corrected by a timezone offset, or used as a fresh execution allowance.
    const nativeSetupMs = native.setupMs + Math.ceil(captureMs) + timestampQuantumMs;
    // The step clock is only a runtime ordering check. It is never substituted
    // for the complete pre-worker execution debit from the older Listener.
    if (observation.setupStepElapsedMs > nativeSetupMs) fail("NATIVE_CLOCK_UNAVAILABLE");
    const setupMs = providerSetupMs >= 0 ? Math.max(nativeSetupMs, providerSetupMs) : nativeSetupMs;
    observation.nativeClock = native;
    observation.clockDisposition =
      providerSetupMs >= 0 ? "MAX_PROVIDER_AND_NATIVE_DEBIT" : "INCONSISTENT_PROVIDER_HEADER_NATIVE_EXECUTION_BOUND";
    const budget = verificationBudgetFromElapsed({
      setupMs,
      limitMs: capacityGrant ? capacityGrant.minutes * 60000 : verificationJobLimit(env.SOUNDING_LINE_PR_NUMBER),
    });
    return Object.freeze({ ...budget, clockObservation: observation, ...(capacityGrant ? { capacityGrant } : {}) });
  } catch (error) {
    error.verificationJobObservation = observation;
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2),
    options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2);
    if (
      !args[index]?.startsWith("--") ||
      !["mode", "workspace", "base", "candidate"].includes(key) ||
      Object.hasOwn(options, key) ||
      typeof args[index + 1] !== "string"
    )
      fail("ARGUMENTS_INVALID");
    options[key] = args[index + 1];
  }
  if (options.mode !== "ordinary" || process.env.GITHUB_SHA !== options.base) fail("UNTRUSTED_BASE");
  const authorityRoot = fileURLToPath(new URL("../../", import.meta.url));
  const invocation = ordinaryVerificationInvocation({
    workspace: options.workspace,
    baseSha: options.base,
    candidateSha: options.candidate,
    authorityRoot,
  });
  const parent = path.join(authorityRoot, "artifacts/sounding-line/verification-supervision");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "session-"));
  const output = path.relative(process.cwd(), directory).split(path.sep).join("/");
  if (!/^authority\/artifacts\/sounding-line\/verification-supervision\/session-[A-Za-z0-9_-]+$/u.test(output))
    fail("OUTPUT_INVALID");
  await appendFile(process.env.GITHUB_OUTPUT, `verification_supervision_path=${output}\n`);
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  try {
    const budget = await currentVerificationJob({ candidateSha: options.candidate, root: invocation.root });
    const began = performance.now();
    const identity = await verificationPreflight({
      root: invocation.root,
      authorityRoot,
      baseSha: options.base,
      candidateSha: options.candidate,
    });
    identity.producer = {
      repository: process.env.GITHUB_REPOSITORY,
      runId: process.env.GITHUB_RUN_ID,
      attempt: process.env.GITHUB_RUN_ATTEMPT,
      workflowSource: process.env.GITHUB_SHA,
    };
    identity.jobLookupCalls = 1;
    await writeFile(path.join(directory, "preflight.json"), JSON.stringify({ ...identity, budget }) + "\n", {
      flag: "wx",
    });
    const executionMs = Math.floor(budget.executionMs - (performance.now() - began));
    if (executionMs < 1) fail("JOB_BUDGET_EXHAUSTED");
    const receipt = await superviseVerification({
      ...invocation,
      identity,
      directory,
      executionMs,
      tailMs: budget.tailMs,
      signal: cancellation.signal,
    });
    if (receipt.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    await writeFile(
      path.join(directory, "controller-failure.json"),
      JSON.stringify({
        status: "FAIL",
        qualification: false,
        originalFailure: error.supervisionReceipt?.originalFailure ?? null,
        cleanupFailure: error.supervisionReceipt?.cleanupFailure ?? null,
        childExitCode: error.supervisionReceipt?.child?.code ?? null,
        reason: /^SOUNDING_LINE_VERIFICATION_[A-Z_]+$/u.test(error?.message ?? "")
          ? error.message
          : "SOUNDING_LINE_VERIFICATION_PREFLIGHT_UNKNOWN",
        jobClockObservation: error.verificationJobObservation ?? null,
      }) + "\n",
      { flag: "wx" },
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
