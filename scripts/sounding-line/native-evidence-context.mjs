// Early protected-workflow observation only. Serialized context never grants
// authentication, capture credit, qualification, or permission to resume.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const REPOSITORY = "Kgray44/treasurehuntSoT";
const REPOSITORY_ID = 1303074266;
const OWNER_ID = 64373011;
const WORKFLOW = `${REPOSITORY}/.github/workflows/sounding-line-ordinary.yml@refs/heads/main`;
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_NATIVE_CONTEXT_${code}`);
};
const oid = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const number = (value) => {
  need(typeof value === "string" && /^[1-9][0-9]{0,15}$/u.test(value) && Number.isSafeInteger(Number(value)), "NUMBER");
  return Number(value);
};
export function observeNativeEvidenceContext({ environment, event }) {
  const e = environment;
  need(
    e?.GITHUB_ACTIONS === "true" &&
      e.GITHUB_REPOSITORY === REPOSITORY &&
      e.GITHUB_REPOSITORY_ID === String(REPOSITORY_ID) &&
      e.GITHUB_REF === "refs/heads/main" &&
      e.GITHUB_WORKFLOW_REF === WORKFLOW &&
      oid(e.GITHUB_SHA) &&
      e.GITHUB_WORKFLOW_SHA === e.GITHUB_SHA,
    "WORKFLOW",
  );
  need(
    e.GITHUB_ACTOR === "Kgray44" &&
      e.GITHUB_TRIGGERING_ACTOR === "Kgray44" &&
      e.GITHUB_ACTOR_ID === String(OWNER_ID) &&
      event?.sender?.id === OWNER_ID &&
      event.sender.login === "Kgray44" &&
      event.repository?.id === REPOSITORY_ID &&
      event.repository.full_name === REPOSITORY &&
      event.repository.owner?.id === OWNER_ID &&
      event.repository.owner.login === "Kgray44",
    "OWNER",
  );
  need(["final-check", "experience-preparation"].includes(e.GITHUB_JOB), "JOB");
  let baseSha, candidateSha, prNumber, mode;
  if (e.GITHUB_EVENT_NAME === "pull_request_target") {
    const pr = event.pull_request;
    need(
      e.GITHUB_JOB === "final-check" &&
        pr &&
        pr.draft === false &&
        Number.isSafeInteger(pr.number) &&
        pr.number > 0 &&
        pr.base?.ref === "main" &&
        pr.base.repo?.id === REPOSITORY_ID &&
        pr.base.repo.full_name === REPOSITORY &&
        pr.head?.repo?.id === REPOSITORY_ID &&
        pr.head.repo.full_name === REPOSITORY,
      "PULL_REQUEST",
    );
    baseSha = pr.base.sha;
    candidateSha = pr.head.sha;
    prNumber = pr.number;
    mode = "ordinary";
  } else {
    need(
      e.GITHUB_EVENT_NAME === "workflow_dispatch" &&
        ["main", "refs/heads/main"].includes(event.ref) &&
        [undefined, false, "false", ""].includes(event.inputs?.experience_diagnostic),
      "DISPATCH",
    );
    mode = event.inputs?.experience_mode;
    need(e.GITHUB_JOB === "final-check" ? mode === "ordinary" : mode === "capture", "MODE");
    baseSha = event.inputs.base_sha;
    candidateSha = event.inputs.candidate_sha;
    prNumber = number(event.inputs.pr_number);
  }
  need(![721, 776].includes(prNumber), "ORDINARY_SCOPE");
  need(oid(baseSha) && oid(candidateSha) && baseSha === e.GITHUB_SHA, "SOURCE");
  return Object.freeze({
    schemaVersion: 2,
    kind: "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_SHADOW",
    authentication: "OBSERVED_EVENT_DATA_NOT_AUTHENTICATED_BY_SERIALIZATION",
    repository: REPOSITORY,
    repositoryId: REPOSITORY_ID,
    actorId: OWNER_ID,
    runId: number(e.GITHUB_RUN_ID),
    attempt: number(e.GITHUB_RUN_ATTEMPT),
    jobKey: e.GITHUB_JOB,
    event: e.GITHUB_EVENT_NAME,
    mode,
    prNumber,
    baseSha,
    candidateSha,
    workflowRef: WORKFLOW,
    workflowSha: e.GITHUB_WORKFLOW_SHA,
    qualification: false,
    reuseAuthorized: false,
  });
}

function commandLineObservation() {
  try {
    const filename = process.env.GITHUB_EVENT_PATH;
    need(typeof filename === "string" && path.isAbsolute(filename), "EVENT_FILE");
    const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    let event;
    try {
      const stat = fs.fstatSync(fd),
        named = fs.lstatSync(filename);
      need(
        stat.isFile() &&
          !named.isSymbolicLink() &&
          stat.dev === named.dev &&
          stat.ino === named.ino &&
          stat.size > 0 &&
          stat.size <= 2 * 1024 * 1024,
        "EVENT_FILE",
      );
      const bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
      let count = 0,
        read;
      while ((read = fs.readSync(fd, bytes, count, bytes.length - count, null)) > 0) {
        count += read;
        need(count <= 2 * 1024 * 1024, "EVENT_FILE");
      }
      need(count === stat.size && fs.fstatSync(fd).size === stat.size, "EVENT_FILE");
      event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, count)));
    } finally {
      fs.closeSync(fd);
    }
    const context = observeNativeEvidenceContext({ environment: process.env, event });
    const installed = fileURLToPath(new URL("../../", import.meta.url));
    const clean = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
    const head = execFileSync("git", ["-c", "core.fsmonitor=false", "rev-parse", "HEAD"], {
      cwd: installed,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
      maxBuffer: 65536,
      windowsHide: true,
      env: {
        ...clean,
        GIT_NO_LAZY_FETCH: "1",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_TERMINAL_PROMPT: "0",
      },
    }).trim();
    need(head === context.baseSha, "INSTALLED_SOURCE");
    const expected = execFileSync(
      "git",
      ["-c", "core.fsmonitor=false", "show", `${head}:scripts/sounding-line/native-evidence-context.mjs`],
      {
        cwd: installed,
        timeout: 10000,
        maxBuffer: 2 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: {
          ...clean,
          GIT_NO_LAZY_FETCH: "1",
          GIT_OPTIONAL_LOCKS: "0",
          GIT_NO_REPLACE_OBJECTS: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
      },
    );
    need(expected.equals(fs.readFileSync(fileURLToPath(import.meta.url))), "INSTALLED_CONTENT");
    return context;
  } catch (error) {
    let code = "SOUNDING_LINE_NATIVE_CONTEXT_UNAVAILABLE";
    try {
      if (/^SOUNDING_LINE_NATIVE_CONTEXT_[A-Z0-9_]+$/u.test(error?.message ?? "")) code = error.message;
    } catch {
      /* No arbitrary error data. */
    }
    return {
      schemaVersion: 2,
      kind: "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_UNAVAILABLE",
      code,
      qualification: false,
      reuseAuthorized: false,
    };
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.stdout.write(`SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 ${JSON.stringify(commandLineObservation())}\n`);
