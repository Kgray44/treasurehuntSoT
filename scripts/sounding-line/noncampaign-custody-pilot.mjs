// Manual source-checked experiments only. They never change the installed
// ordinary switch, reserve a campaign or write a Mainline result.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { spawnOwnedProcess, processExit, stopOwnedProcess } from "./owned-process.mjs";
import { ordinaryCheckoutProfile } from "./ordinary-checkout.mjs";
import { custodyProbeEnvironment } from "./ordinary-custody-probe.mjs";
import { readAttestationArchiveShadow } from "./attestation-archive-shadow.mjs";
import { readSourceSnapshotBatches } from "./source-snapshot-batches.mjs";
import { runMatchedCustodyAdapter } from "./noncampaign-custody-matched-pilot.mjs";
import { EXPERIENCE_READER_OBJECTS } from "./experience-checkout-roots.mjs";

export const CUSTODY_PILOT_WORKFLOW = ".github/workflows/sounding-line-custody-shadow.yml";
const repository = "Kgray44/treasurehuntSoT",
  repositoryId = 1303074266,
  ownerId = 64373011;
const root = fileURLToPath(new URL("../../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const oid = (value) => typeof value === "string" && value.length === 40 && /^[a-f0-9]+$/u.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_CUSTODY_PILOT_${code}`);
};
const singleLink = (stat) => stat.isFile() && stat.nlink === 1n;
const signature = (stat) =>
  [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
export const CUSTODY_ORDINARY_WORKFLOW_SHA256 = "b020542e205810dac90c86384ffc02e7bcc538d3bbb24c2a1ec9f6e2f88f0217";

export function custodyPilotSourceFiles() {
  const policy = JSON.parse(
    readCustodyPilotSource(
      fileURLToPath(new URL("../../testing/noncampaign-custody-shadow-readers.json", import.meta.url)),
    ),
  );
  need(
    hash(Buffer.from(JSON.stringify(policy.readers))) ===
      "7e05ee464306c0a7757f891273a2ca7101cd516085f9c4843ba4225b134f8179",
    "FIXED_READER_MAP_CHANGED",
  );
  return [
    ...new Set([
      ...policy.readers.map((row) => row.path),
      ...[
        "attestation-archive-shadow.mjs",
        "experience-checkout-hydration.mjs",
        "experience-checkout-roots.mjs",
        "experience-pr776-checkout-profile.mjs",
        "experience-selected-checkout.mjs",
        "noncampaign-custody-pilot.mjs",
        "noncampaign-custody-shadow.mjs",
        "noncampaign-custody-read-set.mjs",
        "noncampaign-custody-matched-pilot.mjs",
        "noncampaign-custody-negative-probe.mjs",
        "noncampaign-custody-proof-files.mjs",
        "ordinary-checkout.mjs",
        "ordinary-custody-probe.mjs",
        "ordinary-documentation-checkout-profile.mjs",
        "owned-process.mjs",
        "owned-process-linux.py",
        "owned-process-windows.ps1",
        "source-snapshot-batches.mjs",
      ].map((name) => `scripts/sounding-line/${name}`),
      "testing/noncampaign-custody-shadow-readers.json",
      CUSTODY_PILOT_WORKFLOW,
      ".github/workflows/sounding-line-ordinary.yml",
      "package.json",
      ".nvmrc",
      ".gitattributes",
    ]),
  ].sort();
}
export function custodyShadowPreload(filename, gitPath) {
  need(path.isAbsolute(filename) && path.isAbsolute(gitPath), "PRELOAD_PATH");
  return [
    "const fs=require('node:fs'), cp=require('node:child_process');",
    "const counts={fetchAttempts:0,networkAttempts:0,nonGitProcessAttempts:0,gitCalls:0};",
    "globalThis.fetch=()=>{counts.fetchAttempts++;throw Error('CUSTODY_SHADOW_NETWORK_FORBIDDEN')};",
    "const deny=()=>{counts.networkAttempts++;throw Error('CUSTODY_SHADOW_NETWORK_FORBIDDEN')};",
    "for(const [name,methods]of[['node:net',['connect','createConnection']],['node:tls',['connect']],['node:http',['request','get']],['node:https',['request','get']],['node:dgram',['createSocket']]]){const value=require(name);for(const method of methods)value[method]=deny;}",
    "require('node:net').Socket.prototype.connect=deny;",
    "require('node:net').Server.prototype.listen=deny;",
    "for(const dns of[require('node:dns'),require('node:dns').promises]){for(const name of Object.keys(dns))if(/^(?:lookup|resolve|reverse)/.test(name)&&typeof dns[name]==='function')dns[name]=deny;const Resolver=dns.Resolver;if(Resolver)for(const name of Object.getOwnPropertyNames(Resolver.prototype))if(/^(?:lookup|resolve|reverse)/.test(name))Resolver.prototype[name]=deny;}",
    `const git=${JSON.stringify(gitPath)};`,
    "const allowed=new Set(['ls-tree','show','merge-base','rev-parse','diff','diff-tree','log','cat-file','status']);",
    "for(const method of ['execFileSync','spawnSync','execFile','spawn']){const original=cp[method];cp[method]=function(command,args,...rest){if((command!==git&&command!=='git')||!Array.isArray(args)||!allowed.has(args[0])){counts.nonGitProcessAttempts++;throw Error('CUSTODY_SHADOW_PROCESS_FORBIDDEN')}counts.gitCalls++;return original.call(this,command,args,...rest)}}",
    "for(const method of ['exec','execSync','fork'])cp[method]=()=>{counts.nonGitProcessAttempts++;throw Error('CUSTODY_SHADOW_PROCESS_FORBIDDEN')};",
    "require('node:module').syncBuiltinESMExports();",
    `process.on('exit',()=>fs.writeFileSync(${JSON.stringify(filename)},JSON.stringify(counts),{flag:'wx'}));`,
  ].join("\n");
}
export function readCustodyPilotSource(filename) {
  need(fs.realpathSync.native(filename) === path.resolve(filename), "SOURCE_ALIAS");
  let fd, failure, bytes;
  try {
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const before = fs.fstatSync(fd, { bigint: true });
    need(
      singleLink(before) &&
        before.size <= 16n * 1024n ** 2n &&
        signature(before) === signature(fs.lstatSync(filename, { bigint: true })),
      "SOURCE_FILE",
    );
    bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, Math.min(65536, bytes.length - offset), offset);
      need(count > 0, "SOURCE_TRUNCATED");
      offset += count;
    }
    need(
      signature(fs.fstatSync(fd, { bigint: true })) === signature(before) &&
        signature(fs.lstatSync(filename, { bigint: true })) === signature(before) &&
        fs.realpathSync.native(filename) === path.resolve(filename),
      "SOURCE_CHANGED",
    );
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "CUSTODY_SOURCE_READ_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return bytes;
}

// Bounded metadata/original-frame lane, distinct from the larger media lane.
export function retainCustodyPilotFrame(filename, bytes) {
  need(path.isAbsolute(filename) && Buffer.isBuffer(bytes) && bytes.length <= 16 * 1024 ** 2, "FRAME_BOUND");
  const parent = path.dirname(filename),
    directory = fs.lstatSync(parent, { bigint: true });
  need(
    fs.realpathSync.native(parent) === path.resolve(parent) && directory.isDirectory() && !directory.isSymbolicLink(),
    "FRAME_PARENT",
  );
  const sameParent = () => {
    const current = fs.lstatSync(parent, { bigint: true });
    need(
      current.dev === directory.dev &&
        current.ino === directory.ino &&
        fs.realpathSync.native(parent) === path.resolve(parent),
      "FRAME_PARENT_CHANGED",
    );
  };
  let fd, failure, pinned;
  try {
    sameParent();
    fd = fs.openSync(
      filename,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0),
      0o600,
    );
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(fd, bytes, offset, Math.min(65536, bytes.length - offset));
      need(count > 0, "FRAME_SHORT_WRITE");
      offset += count;
    }
    fs.fsyncSync(fd);
    const stat = fs.fstatSync(fd, { bigint: true });
    need(
      singleLink(stat) &&
        stat.size === BigInt(bytes.length) &&
        signature(stat) === signature(fs.lstatSync(filename, { bigint: true })),
      "FRAME_WRITE_CHANGED",
    );
    pinned = signature(stat);
    sameParent();
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "CUSTODY_FRAME_WRITE_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  fd = undefined;
  try {
    sameParent();
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    need(signature(fs.fstatSync(fd, { bigint: true })) === pinned, "FRAME_READ_CHANGED");
    const actual = createHash("sha256"),
      buffer = Buffer.alloc(65536);
    let total = 0,
      count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      total += count;
      need(total <= bytes.length, "FRAME_READ_BOUND");
      actual.update(buffer.subarray(0, count));
    }
    need(
      total === bytes.length &&
        actual.digest("hex") === hash(bytes) &&
        signature(fs.fstatSync(fd, { bigint: true })) === pinned &&
        signature(fs.lstatSync(filename, { bigint: true })) === pinned,
      "FRAME_READBACK_CHANGED",
    );
    sameParent();
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "CUSTODY_FRAME_READ_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return Object.freeze({ bytes: bytes.length, sha256: hash(bytes), completeReadback: true });
}

function validateQualifiedCustodyBaseline({ run, jobs, checks, artifacts, source, baseSha, candidateSha }) {
  need(oid(source) && oid(baseSha) && oid(candidateSha) && baseSha !== candidateSha, "BOUND_BASELINE_SOURCE");
  need(
    positive(run.id) &&
      run.run_attempt === 1 &&
      run.event === "pull_request_target" &&
      run.path === ".github/workflows/sounding-line-ordinary.yml" &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.head_sha === candidateSha &&
      run.repository?.id === repositoryId &&
      run.repository.full_name === repository &&
      run.repository.owner?.id === ownerId &&
      run.head_repository?.id === repositoryId &&
      run.head_repository.full_name === repository &&
      run.actor?.id === ownerId &&
      run.actor.login === "Kgray44" &&
      run.triggering_actor?.id === ownerId &&
      run.triggering_actor.login === "Kgray44",
    "QUALIFIED_RUN",
  );
  need(jobs.total_count === 4 && Array.isArray(jobs.jobs) && jobs.jobs.length === 4, "COMPLETE_JOBS");
  const requiredNames = [
    "Sounding Line / Finite campaign custody",
    "Sounding Line / Focused verification",
    "Sounding Line / Mainline Decision",
  ];
  const selected = requiredNames.map((name) => {
    const found = jobs.jobs.filter((job) => job.name === name);
    need(
      found.length === 1 &&
        found[0].conclusion === "success" &&
        found[0].status === "completed" &&
        found[0].run_id === run.id &&
        found[0].run_attempt === 1 &&
        found[0].head_sha === run.head_sha &&
        positive(found[0].runner_id) &&
        found[0].labels?.includes("ubuntu-latest") &&
        !found[0].labels.includes("self-hosted"),
      "QUALIFIED_JOB",
    );
    return found[0];
  });
  need(
    Array.isArray(checks.check_runs) && checks.total_count === checks.check_runs.length && checks.total_count <= 100,
    "COMPLETE_CHECKS",
  );
  const decisions = checks.check_runs?.filter(
    (check) =>
      check.name === requiredNames[2] &&
      check.head_sha === run.head_sha &&
      check.app?.id === 15368 &&
      check.conclusion === "success" &&
      check.status === "completed" &&
      check.details_url === `https://github.com/${repository}/actions/runs/${run.id}/job/${selected[2].id}`,
  );
  need(decisions?.length === 1, "REQUIRED_DECISION");
  const name = `sounding-line-checkout-campaign-custody-${run.id}-1`;
  const matches = artifacts.artifacts?.filter((artifact) => artifact.name === name);
  need(matches?.length === 1 && artifacts.total_count === artifacts.artifacts.length, "ORIGINAL_ARTIFACT");
  const artifact = matches[0];
  need(
    positive(artifact.id) &&
      artifact.expired === false &&
      Date.parse(artifact.expires_at) > Date.now() &&
      artifact.workflow_run?.id === run.id &&
      artifact.workflow_run.head_sha === run.head_sha &&
      artifact.workflow_run.repository_id === repositoryId &&
      artifact.workflow_run.head_repository_id === repositoryId &&
      Number.isSafeInteger(artifact.size_in_bytes) &&
      artifact.size_in_bytes > 0 &&
      artifact.size_in_bytes <= 65536 &&
      typeof artifact.digest === "string" &&
      artifact.digest.length === 71 &&
      /^sha256:[a-f0-9]{64}$/u.test(artifact.digest),
    "ARTIFACT_IDENTITY",
  );
  return Object.freeze({
    runId: run.id,
    checkId: decisions[0].id,
    custodyJobId: selected[0].id,
    artifactId: artifact.id,
    artifactBytes: artifact.size_in_bytes,
    artifactSha256: artifact.digest.slice(7),
    baseSha,
    candidateSha,
    installedSource: source,
    qualification: false,
    certificate: "NOT_ISSUED",
  });
}

export function validateCustodyPilotBaseline(input) {
  const { source, parents } = input;
  need(
    oid(source) && Array.isArray(parents) && parents.length === 2 && parents.every(oid) && parents[0] !== parents[1],
    "NORMAL_LANDED_SOURCE",
  );
  return validateQualifiedCustodyBaseline({ ...input, baseSha: parents[0], candidateSha: parents[1] });
}
export function validatePreparedCustodyBaseline(input) {
  const { source, pull } = input;
  need(
    pull?.state === "open" &&
      pull.draft === false &&
      pull.merged_at === null &&
      positive(pull.number) &&
      ![721, 776, 805, 820].includes(pull.number) &&
      pull.base?.ref === "main" &&
      pull.base.sha === source &&
      pull.base.repo?.id === repositoryId &&
      pull.head?.repo?.id === repositoryId &&
      oid(pull.head.sha),
    "OPEN_PREPARED_CANDIDATE",
  );
  const pullBinding = validateCustodyRunPull(input.run, pull, source, pull.head.sha);
  return Object.freeze({
    ...validateQualifiedCustodyBaseline({ ...input, baseSha: source, candidateSha: pull.head.sha }),
    pullBinding,
  });
}
export function validateCustodyRunPull(run, pull, baseSha, candidateSha) {
  const rows = run.pull_requests;
  need(
    Array.isArray(rows) &&
      positive(pull.id) &&
      positive(pull.number) &&
      oid(baseSha) &&
      oid(candidateSha) &&
      run.head_sha === candidateSha &&
      typeof pull.head?.ref === "string" &&
      run.head_branch === pull.head.ref,
    "ORIGINAL_PR_BINDING",
  );
  if (rows.length === 0) {
    // GitHub omits this mutable array for valid completed/merged runs. Join the
    // actual provider facts using the protected workflow's exact run-name schema;
    // no caller digest or invented pull-request row can supply this witness.
    const workflow = readCustodyPilotSource(path.join(root, ".github/workflows/sounding-line-ordinary.yml"));
    const workflowSha256 = hash(workflow);
    need(
      workflowSha256 === CUSTODY_ORDINARY_WORKFLOW_SHA256 &&
        run.workflow_id === 341545080 &&
        run.path === ".github/workflows/sounding-line-ordinary.yml" &&
        run.event === "pull_request_target" &&
        run.run_attempt === 1 &&
        run.display_title === `Sounding Line finite 1 ordinary ${pull.number} ${candidateSha} active`,
      "SOURCE_PINNED_PR_RUN_NAME",
    );
    return Object.freeze({
      kind: "SOURCE_PINNED_RUN_NAME_WITH_EMPTY_PROVIDER_ARRAY",
      observedPullRequestRows: 0,
      prId: pull.id,
      prNumber: pull.number,
      baseSha,
      candidateSha,
      headRef: pull.head.ref,
      workflowSha256,
    });
  }
  need(
    Array.isArray(rows) &&
      rows.length === 1 &&
      positive(pull.id) &&
      rows[0].id === pull.id &&
      rows[0].number === pull.number &&
      rows[0].base?.sha === baseSha &&
      rows[0].head?.sha === candidateSha &&
      rows[0].base?.ref === "main" &&
      rows[0].head?.ref === pull.head?.ref &&
      rows[0].base?.repo?.id === repositoryId &&
      rows[0].head?.repo?.id === repositoryId,
    "ORIGINAL_PR_BINDING",
  );
  return Object.freeze({
    kind: "ORIGINAL_PROVIDER_PULL_ROW",
    observedPullRequestRows: 1,
    prId: pull.id,
    prNumber: pull.number,
    baseSha,
    candidateSha,
    headRef: pull.head.ref,
  });
}

function context() {
  const e = process.env;
  need(
    process.platform === "linux" &&
      process.arch === "x64" &&
      process.versions.node.startsWith("24.") &&
      fs.realpathSync.native(root) === "/home/runner/work/treasurehuntSoT/treasurehuntSoT/authority",
    "NATIVE_NAMESPACE",
  );
  need(
    e.GITHUB_REPOSITORY === repository &&
      e.GITHUB_REPOSITORY_ID === String(repositoryId) &&
      e.GITHUB_ACTOR === "Kgray44" &&
      e.GITHUB_ACTOR_ID === String(ownerId) &&
      e.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      e.GITHUB_REF === "refs/heads/main" &&
      e.GITHUB_RUN_ATTEMPT === "1" &&
      e.GITHUB_WORKFLOW_REF === `${repository}/${CUSTODY_PILOT_WORKFLOW}@refs/heads/main` &&
      oid(e.GITHUB_SHA) &&
      e.INPUT_BASE_SHA === e.GITHUB_SHA &&
      /^[1-9][0-9]{4,19}$/u.test(e.INPUT_BASELINE_RUN_ID ?? ""),
    "DECLARED_CONTEXT",
  );
  const runId = Number(e.GITHUB_RUN_ID),
    baselineRunId = Number(e.INPUT_BASELINE_RUN_ID);
  need(positive(runId) && positive(baselineRunId) && baselineRunId !== runId, "RUN_IDENTITY");
  const preparedPrNumber = e.INPUT_PREPARED_PR_NUMBER ? Number(e.INPUT_PREPARED_PR_NUMBER) : null;
  need(
    preparedPrNumber === null ||
      (positive(preparedPrNumber) &&
        String(preparedPrNumber) === e.INPUT_PREPARED_PR_NUMBER &&
        ![721, 776, 805, 820].includes(preparedPrNumber)),
    "PREPARED_PR_SELECTOR",
  );
  return {
    preparedPrNumber,
    source: e.GITHUB_SHA,
    runId,
    attempt: 1,
    baselineRunId,
    repository,
    qualification: false,
    certificate: "NOT_ISSUED",
  };
}
function usage(directory) {
  let bytes = 0,
    entries = 0;
  const pending = [directory];
  while (pending.length)
    for (const item of fs.readdirSync(pending.pop(), { withFileTypes: true })) {
      // Dirent.parentPath is supplied by the pinned Node 24 runtime.
      const filename = path.join(item.parentPath, item.name),
        stat = fs.lstatSync(filename);
      need(++entries <= 32768 && !stat.isSymbolicLink(), "ALLOCATION_INVENTORY");
      if (stat.isDirectory()) pending.push(filename);
      else {
        need(stat.isFile() && stat.nlink === 1, "ALLOCATION_FILE");
        bytes += stat.size;
      }
      need(bytes <= 512 * 1024 ** 2, "ALLOCATION_BOUND");
    }
  return { bytes, entries };
}
async function controller(directory) {
  const current = context(),
    originals = path.join(directory, "originals"),
    rows = [];
  need(
    directory === path.join(root, "artifacts/custody-shadow", `run-${current.runId}-${current.attempt}`) &&
      fs.realpathSync.native(directory) === directory,
    "OWNED_CONTROLLER_DIRECTORY",
  );
  let ordinal = 0,
    retainedBytes = 0;
  const retain = (label, bytes) => {
    retainedBytes += bytes.length;
    need(retainedBytes <= 64 * 1024 ** 2, "ORIGINAL_AGGREGATE_BOUND");
    const name = `${String(++ordinal).padStart(4, "0")}-${label}.original.bin`;
    const result = retainCustodyPilotFrame(path.join(originals, name), bytes);
    const row = { ordinal, path: `originals/${name}`, ...result };
    rows.push(row);
    return row;
  };
  const record = (name, value) => {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
    return retainCustodyPilotFrame(path.join(directory, name), bytes);
  };
  const empty = path.join(directory, "empty-git-config");
  fs.writeFileSync(empty, "", { flag: "wx" });
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key))),
    GIT_CONFIG_GLOBAL: empty,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
  };
  const execute = (
    command,
    args,
    { cwd = root, input, environment = env, maximumBytes = 16 * 1024 ** 2, timeout = 45000 } = {},
  ) => {
    let output,
      stderr = Buffer.alloc(0),
      originalError;
    const result = spawnSync(command, args, {
      cwd,
      input,
      env: environment,
      encoding: null,
      maxBuffer: maximumBytes,
      timeout,
      windowsHide: true,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    output = result.stdout ?? Buffer.alloc(0);
    stderr = result.stderr ?? Buffer.alloc(0);
    if (result.error) originalError = result.error;
    else if (result.status !== 0 || result.signal)
      originalError = Object.assign(Error("CUSTODY_CHILD_COMMAND_FAILED"), {
        status: result.status,
        signal: result.signal,
        stdout: output,
        stderr,
      });
    const failures = [];
    let stdoutFrame, stderrFrame;
    try {
      stdoutFrame = retain("stdout", output);
    } catch (error) {
      failures.push(error);
    }
    try {
      stderrFrame = retain("stderr", stderr);
    } catch (error) {
      failures.push(error);
    }
    record(`command-${String(rows.length).padStart(4, "0")}.json`, {
      command: path.basename(command),
      args,
      inputBytes: input?.length ?? 0,
      inputSha256: input ? hash(input) : null,
      stdoutFrame,
      stderrFrame,
      exitCode: result.status,
      signal: result.signal,
      succeeded: !originalError,
      qualification: false,
    });
    if (originalError) {
      if (failures.length)
        throw new AggregateError([originalError, ...failures], "CUSTODY_COMMAND_AND_RETENTION_FAILED", {
          cause: originalError,
        });
      throw originalError;
    }
    if (failures.length) throw new AggregateError(failures, "CUSTODY_FRAME_RETENTION_FAILED");
    return output;
  };
  const gitPath = "/usr/bin/git";
  const git = (cwd, args, input) =>
    execute(
      gitPath,
      [
        "-c",
        "gc.auto=0",
        "-c",
        "maintenance.auto=false",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "protocol.allow=never",
        ...(args[0] === "fetch" ? ["-c", "protocol.https.allow=always"] : []),
        ...args,
      ],
      { cwd, input, timeout: args[0] === "fetch" ? 120000 : 45000 },
    );
  const provider = (endpoint, maximumBytes = 2 * 1024 ** 2) =>
    execute(
      "gh",
      [
        "api",
        ...(/^actions\/jobs\/[1-9][0-9]*\/logs(?![\s\S])/u.test(endpoint) ? ["--allow-escape-sequences"] : []),
        "--hostname",
        "github.com",
        `repos/${repository}/${endpoint}`,
      ],
      {
        maximumBytes,
        timeout: 15000,
        environment: { ...env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" },
      },
    );
  const json = (endpoint) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(provider(endpoint)));
  const liveMain = () => {
    const value = json("git/ref/heads/main");
    need(
      value.ref === "refs/heads/main" && value.object?.type === "commit" && value.object.sha === current.source,
      "MAIN_ADVANCED",
    );
  };
  try {
    liveMain();
    const local = git(root, ["rev-parse", "HEAD", "HEAD^{tree}"]).toString().trim().split(/\r?\n/u);
    need(local[0] === current.source && oid(local[1]), "INSTALLED_SOURCE");
    git(root, ["diff", "--quiet", "HEAD", "--"]);
    const commit = json(`git/commits/${current.source}`);
    need(commit.sha === current.source && commit.tree?.sha === local[1], "INSTALLED_TREE");
    const run = json(`actions/runs/${current.baselineRunId}/attempts/1`);
    need(run.id === current.baselineRunId && run.run_attempt === 1 && oid(run.head_sha), "BASELINE_RUN_SELECTOR");
    const baselineInput = {
      run,
      jobs: json(`actions/runs/${current.baselineRunId}/attempts/1/jobs?per_page=100`),
      checks: json(`commits/${run.head_sha}/check-runs?per_page=100`),
      artifacts: json(`actions/runs/${current.baselineRunId}/artifacts?per_page=100`),
      source: current.source,
    };
    let binding, prNumber, subjectPull;
    if (current.preparedPrNumber !== null) {
      const pull = json(`pulls/${current.preparedPrNumber}`);
      need(pull.number === current.preparedPrNumber, "PR_SELECTOR_IDENTITY");
      binding = validatePreparedCustodyBaseline({ ...baselineInput, pull });
      subjectPull = pull;
      prNumber = pull.number;
    } else {
      binding = validateCustodyPilotBaseline({ ...baselineInput, parents: commit.parents.map((value) => value.sha) });
      const pulls = json(`commits/${binding.candidateSha}/pulls?per_page=100`);
      const matches = pulls.filter(
        (pull) =>
          pull.merge_commit_sha === current.source &&
          pull.merged_at &&
          pull.head?.sha === binding.candidateSha &&
          pull.base?.repo?.id === repositoryId,
      );
      need(
        matches.length === 1 && positive(matches[0].number) && ![721, 776, 805, 820].includes(matches[0].number),
        "BASELINE_OWNER_SCOPE",
      );
      prNumber = matches[0].number;
      subjectPull = matches[0];
    }
    binding = Object.freeze({
      ...binding,
      pullBinding: validateCustodyRunPull(run, subjectPull, binding.baseSha, binding.candidateSha),
    });
    const archiveBytes = provider(`actions/artifacts/${binding.artifactId}/zip`, 65536);
    need(
      archiveBytes.length === binding.artifactBytes && hash(archiveBytes) === binding.artifactSha256,
      "BASELINE_ARCHIVE_BYTES",
    );
    const archive = path.join(directory, "baseline-checkout.original.zip");
    retainCustodyPilotFrame(archive, archiveBytes);
    const baselineMember = readAttestationArchiveShadow({
      filename: archive,
      expectedBytes: archiveBytes.length,
      expectedSha256: binding.artifactSha256,
      memberNames: ["candidate.checkout.json"],
      deadlineMs: 10000,
    });
    need(
      baselineMember.members.length === 1 &&
        baselineMember.members[0].path === "candidate.checkout.json" &&
        baselineMember.members[0].type === "file",
      "BASELINE_ARCHIVE_INVENTORY",
    );
    const baseline = JSON.parse(baselineMember.bytes);
    need(
      baseline.status === "PASS" &&
        baseline.baseSha === binding.baseSha &&
        baseline.candidateSha === binding.candidateSha &&
        baseline.readSet?.profile === "FULL_SNAPSHOT" &&
        baseline.nonshallow === true &&
        baseline.lateGitTransport === "DISABLED" &&
        baseline.compiled?.snapshots === 2 &&
        baseline.verified?.completeCommitTreeAncestry === true &&
        baseline.verified.blobStore === "FULL_BASE_CANDIDATE_AND_EXPLICIT_READER_CLOSURE" &&
        positive(baseline.verified.requiredBlobs) &&
        positive(baseline.verified.requiredBlobBytes) &&
        Number.isFinite(baseline.elapsedMs) &&
        baseline.elapsedMs > 0,
      "FULL_BASELINE_REQUIRED",
    );
    retainCustodyPilotFrame(path.join(directory, "baseline-checkout.extracted.original.json"), baselineMember.bytes);
    const policy = JSON.parse(
      fs.readFileSync(new URL("../../testing/noncampaign-custody-shadow-readers.json", import.meta.url), "utf8"),
    );
    const sourceFiles = custodyPilotSourceFiles();
    need(sourceFiles.length <= 128, "INSTALLED_READER_BOUND");
    const sourceInventory = new Map(
      git(root, ["ls-tree", "-rz", current.source, "--", ...sourceFiles])
        .toString()
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/u.exec(row);
          need(match, "INSTALLED_READER_TYPE");
          return [match[3], { mode: match[1], blob: match[2] }];
        }),
    );
    need(sourceInventory.size === sourceFiles.length, "INSTALLED_READER_CLOSURE");
    const legacyBegan = performance.now(),
      legacy = new Map();
    let sourceBytes = 0;
    for (const file of sourceFiles) {
      const bytes = git(root, ["show", `${current.source}:${file}`]);
      sourceBytes += bytes.length;
      need(bytes.length <= 8 * 1024 ** 2 && sourceBytes <= 16 * 1024 ** 2, "INSTALLED_BYTE_BOUND");
      legacy.set(file, bytes);
    }
    const legacyMs = performance.now() - legacyBegan,
      batchBegan = performance.now();
    let batchCalls = 0;
    const bodies = readSourceSnapshotBatches(
      sourceFiles.map((file) => ({ path: file, blob: sourceInventory.get(file).blob })),
      (args, options) => {
        batchCalls++;
        return git(root, args, options.input);
      },
      { encoding: null, maxBuffer: 16 * 1024 ** 2, maxTotalBytes: 16 * 1024 ** 2 },
    );
    const sourceRows = sourceFiles.map((file) => {
      const filename = path.join(root, file),
        stat = fs.lstatSync(filename, { bigint: true });
      need(fs.realpathSync.native(filename) === filename && singleLink(stat), "INSTALLED_FILE_ALIAS");
      const physical = readCustodyPilotSource(filename),
        bytes = bodies.get(file);
      need(
        bytes.equals(legacy.get(file)) &&
          bytes.equals(physical) &&
          signature(stat) === signature(fs.lstatSync(filename, { bigint: true })) &&
          Number(stat.mode & 0o777n) === (sourceInventory.get(file).mode === "100755" ? 0o755 : 0o644),
        "INSTALLED_BYTE_EQUIVALENCE",
      );
      return { path: file, ...sourceInventory.get(file), bytes: bytes.length, sha256: hash(bytes) };
    });
    for (const pin of policy.readers)
      need(sourceRows.find((row) => row.path === pin.path)?.sha256 === pin.sha256, "NEGATIVE_READER_DRIFT");
    record("installed-source-batching.json", {
      source: current.source,
      rows: sourceRows,
      legacyBodyCalls: sourceFiles.length,
      batchCalls,
      legacyMs,
      batchMs: performance.now() - batchBegan,
      originalFailuresRetried: 0,
      productionReadsReplaced: 0,
      qualification: false,
    });
    if (current.preparedPrNumber !== null) {
      const baselineJobLog = provider(`actions/jobs/${binding.custodyJobId}/logs`, 8 * 1024 ** 2);
      retainCustodyPilotFrame(path.join(directory, "baseline-custody-job.original.log"), baselineJobLog);
      const observed = await runMatchedCustodyAdapter({
        directory,
        current,
        binding,
        baseline,
        prNumber,
        git,
        execute,
        record,
        environment: env,
        baselineJobLog,
      });
      liveMain();
      const pull = json(`pulls/${prNumber}`);
      validatePreparedCustodyBaseline({ ...baselineInput, pull });
      record("original-frame-ledger.json", { rows, retainedBytes, qualification: false });
      record("terminal.json", observed);
      return;
    }
    const selected = path.join(directory, "selected"),
      checkoutBegan = performance.now();
    fs.mkdirSync(selected);
    git(selected, ["init", "--quiet", "--template="]);
    git(selected, ["remote", "add", "origin", `https://github.com/${repository}.git`]);
    git(selected, ["config", "--local", "remote.origin.promisor", "true"]);
    git(selected, ["config", "--local", "remote.origin.partialclonefilter", "blob:none"]);
    git(selected, ["config", "--local", "core.autocrlf", "false"]);
    const fixtureEvent = {
      pull_request: {
        number: prNumber,
        base: { sha: binding.baseSha, repo: { full_name: repository } },
        head: { sha: binding.candidateSha, repo: { full_name: repository } },
      },
    };
    const profile = ordinaryCheckoutProfile({
      baseSha: binding.baseSha,
      candidateSha: binding.candidateSha,
      purpose: "campaign-custody",
      event: fixtureEvent,
      env: {
        GITHUB_REPOSITORY: repository,
        GITHUB_SHA: binding.baseSha,
        GITHUB_REF: "refs/heads/main",
        GITHUB_EVENT_NAME: "pull_request_target",
        GITHUB_JOB: "campaign-custody",
      },
    });
    const roots = [...new Set([binding.baseSha, binding.candidateSha, ...profile.roots])];
    need(JSON.stringify(roots) === JSON.stringify(baseline.roots), "ORIGINAL_ROOTS_CHANGED");
    git(selected, [
      "fetch",
      "--filter=blob:none",
      "--no-tags",
      "--no-recurse-submodules",
      "origin",
      ...roots.map((sha) => `+${sha}:refs/sounding-line/custody-shadow/${sha}`),
    ]);
    need(git(selected, ["rev-parse", "--is-shallow-repository"]).toString().trim() === "false", "SHALLOW_HISTORY");
    git(selected, ["rev-list", "--objects", "--filter=blob:none", "--missing=error", ...roots]);
    const historicalCommits = [
      ...new Set([
        ...roots,
        ...profile.readerRevisions,
        ...EXPERIENCE_READER_OBJECTS.filter((row) => row.type === "commit").map((row) => row.sha),
      ]),
    ];
    need(historicalCommits.length <= 256 && historicalCommits.every(oid), "HISTORICAL_COMMIT_BOUND");
    const checkedCommits = git(
      selected,
      ["cat-file", "--batch-check"],
      Buffer.from(historicalCommits.join("\n") + "\n"),
    )
      .toString()
      .trim()
      .split("\n");
    need(
      checkedCommits.length === historicalCommits.length &&
        checkedCommits.every((row, index) => row.startsWith(historicalCommits[index] + " commit ")),
      "HISTORICAL_COMMIT_METADATA_MISSING",
    );
    const legacyTransportPaths = [
      "ordinary-checkout.mjs",
      "ordinary-documentation-checkout-profile.mjs",
      "ordinary-custody-probe.mjs",
      "experience-selected-checkout.mjs",
      "experience-checkout-roots.mjs",
      "experience-checkout-hydration.mjs",
      "owned-process.mjs",
      "owned-process-linux.py",
      "owned-process-windows.ps1",
      "source-snapshot-batches.mjs",
      "attestation-archive-shadow.mjs",
    ].map((name) => `scripts/sounding-line/${name}`);
    const oldTransport = new Map(
      git(selected, ["ls-tree", "-rz", binding.baseSha, "--", ...legacyTransportPaths])
        .toString()
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/u.exec(row);
          need(match, "BASELINE_TRANSPORT_TYPE");
          return [match[3], { mode: match[1], blob: match[2] }];
        }),
    );
    need(
      oldTransport.size === legacyTransportPaths.length &&
        legacyTransportPaths.every(
          (file) =>
            oldTransport.get(file).mode === sourceInventory.get(file).mode &&
            oldTransport.get(file).blob === sourceInventory.get(file).blob,
        ),
      "BASELINE_TRANSPORT_DRIFT",
    );
    const historicalPathMetadata = profile.readerPaths.map(({ revision, path: file }) => ({
      revision,
      path: file,
      originalMetadata: git(selected, ["ls-tree", revision, "--", file]).toString().trim(),
    }));
    need(
      historicalPathMetadata.every((row) => /^(100644|100755) blob [a-f0-9]{40}\t/u.test(row.originalMetadata)),
      "HISTORICAL_PATH_METADATA_MISSING",
    );
    record("historical-reader-identities.json", {
      historicalCommits,
      historicalPathMetadata,
      originalReaderObjects: EXPERIENCE_READER_OBJECTS,
      byteMaterialization: "OMITTED_ONLY_IN_THIS_NEGATIVE_ROUTE_EXPERIMENT",
      qualification: false,
      certificate: "NOT_ISSUED",
    });
    const { observeNoncampaignCustodyShadow, inspectNoncampaignCustodyShadow } = await import(
      "./noncampaign-custody-shadow.mjs"
    );
    const sandbox = custodyProbeEnvironment({ ...env, GIT_CONFIG_GLOBAL: empty }, gitPath);
    const observed = await observeNoncampaignCustodyShadow({
      root: selected,
      git: gitPath,
      ...binding,
      prNumber,
      command: async (args) => git(selected, args),
      readOnlyCommand: async (args, executable) => execute(executable, args, { environment: sandbox, timeout: 45000 }),
    });
    need(
      observed.applied === false &&
        observed.observed === true &&
        observed.shadowOnly === true &&
        observed.proposal.sourceCertificate === "NOT_ISSUED",
      "SHADOW_OBSERVATION_REQUIRED",
    );
    const inspected = inspectNoncampaignCustodyShadow(observed.shadowObservation, {
      root: selected,
      baseSha: binding.baseSha,
      candidateSha: binding.candidateSha,
    });
    need(
      inspected &&
        inspected.proposal === observed.proposal &&
        inspected.prNumber === prNumber &&
        inspected.custodyProbe.campaign === false,
      "OPAQUE_SHADOW_OBSERVATION_REQUIRED",
    );
    const proposal = observed.proposal,
      closure = path.join(selected, ".git/custody-shadow-closure.json"),
      worker = fileURLToPath(new URL("./experience-checkout-hydration.mjs", import.meta.url));
    const operation = (name, data) => {
      const input = path.join(directory, `worker-${name}.json`);
      record(`worker-${name}.json`, { operation: name, root: selected, git: gitPath, ...data });
      return JSON.parse(execute(process.execPath, [worker, input]).toString());
    };
    const compiled = operation("compile", {
      snapshots: [],
      readerSnapshots: [binding.baseSha, binding.candidateSha],
      objects: [],
      readerPaths: [binding.baseSha, binding.candidateSha].flatMap((revision) =>
        proposal.metadataPaths.map((file) => ({ revision, path: file })),
      ),
      exactReaderOnly: true,
      output: closure,
    });
    const hydration = operation("hydrate", { closure });
    const verified = operation("verify", {
      closure,
      roots,
      baseSha: binding.baseSha,
      candidateSha: binding.candidateSha,
      lockTransport: true,
    });
    git(selected, ["config", "--local", "core.sparseCheckout", "true"]);
    git(selected, ["config", "--local", "core.sparseCheckoutCone", "false"]);
    fs.mkdirSync(path.join(selected, ".git/info"), { recursive: true });
    const escape = (file) => file.replace(/[\\*?\[\] !#]/gu, "\\$&");
    fs.writeFileSync(
      path.join(selected, ".git/info/sparse-checkout"),
      "/*\n" + proposal.omissions.map((row) => "!/" + escape(row.path)).join("\n") + "\n",
      { flag: "wx" },
    );
    git(selected, ["checkout", "--detach", binding.candidateSha]);
    need(
      git(selected, ["rev-parse", "HEAD"]).toString().trim() === binding.candidateSha &&
        git(selected, ["status", "--porcelain", "--untracked-files=no"]).length === 0,
      "SELECTED_SOURCE_CHANGED",
    );
    const skipped = git(selected, ["ls-files", "-t", "-z"])
      .toString()
      .split("\0")
      .filter((row) => row.startsWith("S "))
      .map((row) => row.slice(2))
      .sort();
    need(
      JSON.stringify(skipped) === JSON.stringify(proposal.omissions.map((row) => row.path).sort()),
      "EXACT_OMISSIONS_CHANGED",
    );
    const checkoutMs = performance.now() - checkoutBegan;
    const objectsBefore = git(selected, [
        "cat-file",
        "--batch-all-objects",
        "--batch-check=%(objectname) %(objecttype) %(objectsize)",
      ]),
      refsBefore = git(selected, ["for-each-ref"]);
    const filesystemSnapshot = () => {
      const pending = [selected],
        entries = [];
      let bytes = 0;
      while (pending.length) {
        const parent = pending.pop();
        for (const name of fs.readdirSync(parent)) {
          const filename = path.join(parent, name),
            stat = fs.lstatSync(filename),
            relative = path.relative(selected, filename);
          need(entries.length < 32768 && !stat.isSymbolicLink(), "SELECTED_FILESYSTEM_BOUND");
          if (stat.isDirectory()) {
            entries.push({ path: relative, type: "directory", mode: stat.mode & 0o777 });
            pending.push(filename);
          } else {
            need(stat.isFile(), "SELECTED_FILESYSTEM_TYPE");
            const body = readCustodyPilotSource(filename);
            bytes += body.length;
            need(bytes <= 64 * 1024 ** 2, "SELECTED_FILESYSTEM_BYTES");
            entries.push({
              path: relative,
              type: "file",
              mode: stat.mode & 0o777,
              bytes: body.length,
              sha256: hash(body),
            });
          }
        }
      }
      return hash(
        Buffer.from(JSON.stringify(entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))))),
      );
    };
    const filesystemBefore = filesystemSnapshot();
    const expectedBlobs = new Set(
      JSON.parse(fs.readFileSync(closure))
        .objects.filter((row) => row.type === "blob")
        .map((row) => row.sha),
    );
    const storedBlobs = objectsBefore
      .toString()
      .split(/\r?\n/u)
      .filter((row) => row.includes(" blob "))
      .map((row) => row.split(" ")[0]);
    need(
      storedBlobs.length === expectedBlobs.size &&
        storedBlobs.every((blob) => expectedBlobs.has(blob)) &&
        !fs.existsSync(path.join(selected, ".git/objects/info/alternates")),
      "EXTRA_OR_ALTERNATE_BLOBS",
    );
    const event = path.join(directory, "reserve-event.original.json"),
      output = path.join(directory, "reserve-output.original.txt"),
      network = path.join(directory, "reserve-network.original.json"),
      preload = path.join(directory, "deny-reserve-network.cjs");
    record("reserve-event.original.json", fixtureEvent);
    fs.writeFileSync(preload, custodyShadowPreload(network, gitPath), { flag: "wx" });
    const reserveEnvironment = {
      ...sandbox,
      GITHUB_EVENT_PATH: event,
      GITHUB_SHA: binding.baseSha,
      GITHUB_OUTPUT: output,
    };
    need(
      !Object.keys(reserveEnvironment).some((key) => /TOKEN|SECRET|PASSWORD|^GH_|^ACTIONS_/iu.test(key)),
      "RESERVE_CREDENTIALS_PRESENT",
    );
    const reserveBegan = performance.now();
    execute(
      process.execPath,
      [
        "--require",
        preload,
        fileURLToPath(new URL("./experience-exception.mjs", import.meta.url)),
        "--operation",
        "reserve",
        "--workspace",
        selected,
        "--base",
        binding.baseSha,
        "--candidate",
        binding.candidateSha,
        "--evidence",
        path.join(directory, "absent-evidence"),
      ],
      { environment: reserveEnvironment, timeout: 45000 },
    );
    const reserveMs = performance.now() - reserveBegan,
      outputBytes = fs.readFileSync(output),
      networkObservation = JSON.parse(fs.readFileSync(network));
    need(
      outputBytes.equals(Buffer.from("campaign=false\n")) &&
        networkObservation.fetchAttempts === 0 &&
        networkObservation.networkAttempts === 0 &&
        networkObservation.nonGitProcessAttempts === 0 &&
        filesystemSnapshot() === filesystemBefore,
      "NEGATIVE_ROUTE_NOT_CLOSED",
    );
    need(
      git(selected, [
        "cat-file",
        "--batch-all-objects",
        "--batch-check=%(objectname) %(objecttype) %(objectsize)",
      ]).equals(objectsBefore) && git(selected, ["for-each-ref"]).equals(refsBefore),
      "RESERVE_MUTATED_SOURCE_STORE",
    );
    git(root, ["diff", "--quiet", "HEAD", "--"]);
    const gitVersion = git(root, ["--version"]).toString().trim();
    liveMain();
    record("original-frame-ledger.json", { rows, retainedBytes, qualification: false });
    record("terminal.json", {
      status: "PASS_SHADOW_NEGATIVE_ROUTE",
      context: current,
      binding,
      prNumber,
      roots,
      compiled,
      hydration,
      verified,
      proposal: {
        profile: proposal.profile,
        metadataPaths: proposal.metadataPaths,
        changedPaths: proposal.changedPaths,
        omissions: proposal.omissions.length,
        omittedInventoryDigest: proposal.omittedInventoryDigest,
        readerDigest: proposal.readerDigest,
      },
      baseline: {
        elapsedMs: baseline.elapsedMs,
        requiredBlobs: baseline.verified.requiredBlobs,
        requiredBlobBytes: baseline.verified.requiredBlobBytes,
      },
      checkoutMs,
      reserveMs,
      reserveOutputSha256: hash(outputBytes),
      networkObservation,
      selectedFilesystemDigest: filesystemBefore,
      exactOnlyMetadataBlobs: storedBlobs.length,
      toolchain: {
        node: process.version,
        git: gitVersion,
        os: os.release(),
        imageOS: process.env.ImageOS,
        imageVersion: process.env.ImageVersion,
      },
      performanceScope: "EXACT_BASE_CANDIDATE_ROOTS_AND_PINNED_RESERVE_BYTES_DIFFERENT_HOSTED_INSTANCES",
      ordinaryProductionProfile: "FULL_SNAPSHOT",
      certificate: "NOT_ISSUED",
      qualification: false,
      activation: false,
    });
  } catch (error) {
    try {
      record("original-frame-ledger.failure.json", { rows, retainedBytes, qualification: false });
      record("terminal.failure.json", {
        status: "FAIL_SHADOW",
        context: current,
        completeOriginalExceptionSerialization: false,
        certificate: "NOT_ISSUED",
        qualification: false,
        activation: false,
      });
    } catch (retentionError) {
      throw new AggregateError([error, retentionError], "CUSTODY_PILOT_AND_RETENTION_FAILED", { cause: error });
    }
    throw error;
  }
}

async function main() {
  const current = context(),
    directory = path.join(root, "artifacts/custody-shadow", `run-${current.runId}-${current.attempt}`);
  fs.mkdirSync(path.dirname(directory), { recursive: true, mode: 0o700 });
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.mkdirSync(path.join(directory, "originals"), { mode: 0o700 });
  fs.mkdirSync(path.join(directory, "tmp"), { mode: 0o700 });
  retainCustodyPilotFrame(
    path.join(directory, "initial.json"),
    Buffer.from(JSON.stringify({ status: "INCOMPLETE", ...current, maximumGeneratedBytes: 512 * 1024 ** 2 }) + "\n"),
  );
  need(fs.statfsSync(directory).bavail * fs.statfsSync(directory).bsize >= 1024 ** 3, "FREE_SPACE_PREFLIGHT");
  const stdout = fs.openSync(path.join(directory, "controller.original.stdout"), "wx"),
    stderr = fs.openSync(path.join(directory, "controller.original.stderr"), "wx");
  const child = spawnOwnedProcess(process.execPath, [fileURLToPath(import.meta.url), "--controller", directory], {
    root,
    env: { ...process.env, TEMP: path.join(directory, "tmp"), TMP: path.join(directory, "tmp") },
    cleanupOptions: { gracefulMs: 500, forceMs: 1000 },
  });
  child.stdout.removeAllListeners("data");
  child.stderr.removeAllListeners("data");
  let stdoutBytes = 0,
    stderrBytes = 0,
    stdoutStored = 0,
    stderrStored = 0,
    timer,
    monitor,
    result,
    failure,
    cleanup,
    rejectFailure;
  const capture = (fd, bytes, kind) => {
    if (kind === "stdout") stdoutBytes += bytes.length;
    else stderrBytes += bytes.length;
    try {
      need(stdoutBytes <= 1024 ** 2 && stderrBytes <= 1024 ** 2, "CONTROLLER_OUTPUT_BOUND");
      let offset = 0;
      while (offset < bytes.length) {
        const count = fs.writeSync(fd, bytes, offset, Math.min(65536, bytes.length - offset));
        need(count > 0, "CONTROLLER_SHORT_WRITE");
        offset += count;
        if (kind === "stdout") stdoutStored += count;
        else stderrStored += count;
      }
    } catch (error) {
      failure ??= error;
      rejectFailure?.(error);
    }
  };
  child.stdout.on("data", (bytes) => capture(stdout, bytes, "stdout"));
  child.stderr.on("data", (bytes) => capture(stderr, bytes, "stderr"));
  try {
    result = await Promise.race([
      processExit(child),
      new Promise((_, reject) => {
        rejectFailure = reject;
        timer = setTimeout(() => reject(Error("CUSTODY_PILOT_DEADLINE")), 300000);
        monitor = setInterval(() => {
          try {
            usage(directory);
            need(stdoutBytes <= 1024 ** 2 && stderrBytes <= 1024 ** 2, "CONTROLLER_OUTPUT_BOUND");
          } catch (error) {
            reject(error);
          }
        }, 1000);
      }),
    ]);
  } catch (error) {
    failure = error;
  } finally {
    clearTimeout(timer);
    clearInterval(monitor);
    const finalizationFailures = [];
    let measured;
    try {
      cleanup = await stopOwnedProcess(child);
    } catch (error) {
      finalizationFailures.push(error);
    }
    for (const fd of [stdout, stderr])
      try {
        fs.closeSync(fd);
      } catch (error) {
        finalizationFailures.push(error);
      }
    try {
      measured = usage(directory);
    } catch (error) {
      finalizationFailures.push(error);
    }
    try {
      retainCustodyPilotFrame(
        path.join(directory, "supervision.json"),
        Buffer.from(
          JSON.stringify({
            context: current,
            result,
            cleanup,
            stdoutBytes,
            stderrBytes,
            stdoutStored,
            stderrStored,
            stdoutComplete: stdoutStored === stdoutBytes,
            stderrComplete: stderrStored === stderrBytes,
            usage: measured,
            failed: !!failure || finalizationFailures.length > 0 || result?.code !== 0 || cleanup?.status !== "PASS",
            originalExceptionSerializationComplete: false,
            qualification: false,
            activation: false,
          }) + "\n",
        ),
      );
    } catch (error) {
      finalizationFailures.push(error);
    }
    if (finalizationFailures.length)
      failure = new AggregateError(
        [...(failure ? [failure] : []), ...finalizationFailures],
        "CUSTODY_SUPERVISION_FINALIZATION_FAILED",
        { cause: failure ?? finalizationFailures[0] },
      );
  }
  if (failure) throw failure;
  need(!failure && result?.code === 0 && cleanup.status === "PASS", "CONTROLLER_OR_CLEANUP_FAILED");
  console.log(
    `SOUNDING_LINE_CUSTODY_SHADOW_V1 ${JSON.stringify({ source: current.source, baselineRunId: current.baselineRunId, status: "PASS_SHADOW", qualification: false, activation: false })}`,
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const operation = process.argv[2] === "--controller" ? controller(process.argv[3]) : main();
  operation.catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
