// Forensic retention only. These files grant no qualification or reuse authority.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readCustodyPilotSource, retainCustodyProofFrame } from "./noncampaign-custody-proof-files.mjs";

export const CUSTODY_RETENTION_LIMITS = Object.freeze({
  files: 256,
  fileBytes: 16 * 1024 ** 2,
  totalBytes: 128 * 1024 ** 2,
  manifestBytes: 4 * 1024 ** 2,
});
const hash = (b) => createHash("sha256").update(b).digest("hex");
const oid = (v) => typeof v === "string" && /^[a-f0-9]{40}$/u.test(v);
const nameOK = (v) => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/u.test(v);
const need = (v, code) => {
  if (!v) throw Error(`CUSTODY_RETENTION_${code}`);
};
const signature = (s) => [s.dev, s.ino, s.mode, s.nlink, s.size, s.mtimeNs, s.ctimeNs].map(String).join(":");
function directory(p, create = false) {
  let s;
  try {
    s = fs.lstatSync(p, { bigint: true });
  } catch (e) {
    if (e.code !== "ENOENT" || !create) throw e;
    directory(path.dirname(p), true);
    fs.mkdirSync(p);
    s = fs.lstatSync(p, { bigint: true });
  }
  need(s.isDirectory() && !s.isSymbolicLink() && fs.realpathSync.native(p) === p, "DIRECTORY_ALIAS");
  return s;
}
function sourceDirectory(workspace) {
  for (const p of [workspace, path.join(workspace, ".git"), path.join(workspace, ".git/noncampaign-custody-proof")]) {
    try {
      directory(p);
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  return path.join(workspace, ".git/noncampaign-custody-proof");
}
function inventory(source, limits) {
  const parent = signature(directory(source));
  const entries = fs.readdirSync(source).sort();
  need(entries.length <= limits.files, "FILE_COUNT");
  let total = 0;
  const rows = entries.map((name) => {
    need(nameOK(name), "UNSAFE_PATH");
    const file = path.join(source, name),
      s = fs.lstatSync(file, { bigint: true });
    need(s.isFile() && !s.isSymbolicLink() && s.nlink === 1n && fs.realpathSync.native(file) === file, "SOURCE_ALIAS");
    need(s.size <= BigInt(limits.fileBytes), "FILE_BOUND");
    total += Number(s.size);
    need(total <= limits.totalBytes, "TOTAL_BOUND");
    return { name, bytes: Number(s.size), signature: signature(s), mode: Number(s.mode) };
  });
  need(signature(directory(source)) === parent, "SOURCE_DIRECTORY_CHANGED");
  return { parent, rows, total };
}
export function retainCustodyWorkerProof({ workspace, destination, binding, limits = {} }) {
  need(
    path.isAbsolute(workspace) &&
      path.resolve(workspace) === workspace &&
      path.isAbsolute(destination) &&
      path.resolve(destination) === destination,
    "ABSOLUTE_PATHS",
  );
  need(
    binding?.repository === "Kgray44/treasurehuntSoT" &&
      oid(binding.baseSha) &&
      oid(binding.candidateSha) &&
      /^[1-9][0-9]{0,19}$/u.test(String(binding.runId)) &&
      Number.isSafeInteger(binding.attempt) &&
      binding.attempt > 0 &&
      Number.isSafeInteger(binding.prNumber) &&
      binding.prNumber > 0,
    "BINDING",
  );
  const budget = { ...CUSTODY_RETENTION_LIMITS };
  for (const [k, v] of Object.entries(limits)) {
    need(Object.hasOwn(budget, k) && Number.isSafeInteger(v) && v > 0 && v <= budget[k], "LIMIT");
    budget[k] = v;
  }
  need(
    !destination.startsWith(workspace + path.sep) &&
      !workspace.startsWith(destination + path.sep) &&
      destination !== workspace,
    "OUTPUT_OVERLAP",
  );
  directory(path.dirname(destination), true);
  need(!fs.existsSync(destination), "OUTPUT_ALREADY_EXISTS");
  fs.mkdirSync(destination);
  directory(destination);
  const originals = path.join(destination, "originals");
  fs.mkdirSync(originals);
  const rows = [],
    errors = [],
    integrityErrors = [],
    ledgers = [];
  let source = null,
    before = null;
  const error = (e) => ({
    name: e.name,
    message: String(e.message).slice(0, 4096),
    code: e.code ?? null,
    stack: String(e.stack ?? "").slice(0, 4096),
    exceptionSerializationComplete: String(e.message).length <= 4096 && String(e.stack ?? "").length <= 4096,
  });
  try {
    source = sourceDirectory(workspace);
    if (source) {
      before = inventory(source, budget);
      for (const entry of before.rows) {
        const row = {
          path: entry.name,
          bytes: entry.bytes,
          originalMode: entry.mode,
          status: "UNVERIFIED",
          sha256: null,
        };
        rows.push(row);
        try {
          const file = path.join(source, entry.name);
          need(signature(fs.lstatSync(file, { bigint: true })) === entry.signature, "SOURCE_CHANGED");
          const bytes = readCustodyPilotSource(file);
          need(
            bytes.length === entry.bytes && signature(fs.lstatSync(file, { bigint: true })) === entry.signature,
            "SOURCE_CHANGED",
          );
          row.sha256 = hash(bytes);
          retainCustodyProofFrame(path.join(originals, entry.name), bytes);
          need(readCustodyPilotSource(path.join(originals, entry.name)).equals(bytes), "COPY_READBACK");
          row.status = "BYTE_EXACT_READBACK";
          if (/^original-frame-ledger(?:\.failure)?\.json$/u.test(entry.name))
            ledgers.push({ name: entry.name, bytes });
          if (entry.name === "input.original.json") {
            const input = JSON.parse(bytes);
            need(
              input.baseSha === binding.baseSha &&
                input.candidateSha === binding.candidateSha &&
                input.prNumber === binding.prNumber &&
                input.root === workspace,
              "SOURCE_BINDING_CHANGED",
            );
          }
        } catch (e) {
          errors.push({ path: entry.name, ...error(e) });
        }
      }
      need(JSON.stringify(inventory(source, budget)) === JSON.stringify(before), "SOURCE_PREFIX_CHANGED");
    }
  } catch (e) {
    errors.push(error(e));
  }
  const byName = new Map(rows.map((r) => [r.path, r]));
  for (const ledger of ledgers) {
    try {
      const data = JSON.parse(ledger.bytes);
      need(Array.isArray(data.frames), "LEDGER_SCHEMA");
      const paths = new Set();
      for (let i = 0; i < data.frames.length; i++) {
        const frame = data.frames[i];
        need(frame.ordinal === i + 1 && nameOK(frame.path) && !paths.has(frame.path), "LEDGER_ORDINAL_OR_PATH");
        paths.add(frame.path);
        const row = byName.get(frame.path);
        need(
          row?.status === "BYTE_EXACT_READBACK" &&
            row.bytes === frame.bytes &&
            row.sha256 === frame.sha256 &&
            frame.completeReadback === true,
          "LEDGER_BYTE_JOIN",
        );
        need(
          row.originalOrdinal === undefined || row.originalOrdinal === frame.ordinal,
          "CROSS_LEDGER_ORDINAL_CHANGED",
        );
        row.originalOrdinal = frame.ordinal;
      }
      const frameBytes = data.frames.reduce((sum, frame) => sum + frame.bytes, 0);
      need(Number.isSafeInteger(frameBytes) && frameBytes <= 32 * 1024 ** 2, "PRODUCER_FRAME_BOUND");
      if (data.retainedBytes !== undefined) need(data.retainedBytes === frameBytes, "LEDGER_TOTAL_JOIN");
      if (Array.isArray(data.commands))
        for (const command of data.commands)
          for (const frame of Object.values(command.frames ?? {}))
            need(JSON.stringify(frame) === JSON.stringify(data.frames[frame.ordinal - 1]), "COMMAND_FRAME_JOIN");
    } catch (e) {
      integrityErrors.push({ path: ledger.name, ...error(e) });
    }
  }
  const preservationComplete = errors.length === 0;
  const integrityComplete =
    preservationComplete &&
    source !== null &&
    ledgers.length > 0 &&
    integrityErrors.length === 0 &&
    rows.every((r) => !/^\d{4}-.*\.original\.bin$/u.test(r.path) || r.originalOrdinal !== undefined);
  const manifest = {
    version: 1,
    kind: "ORIGINAL_CUSTODY_WORKER_PREFIX_FORENSIC_RETENTION",
    binding: { ...binding },
    originalPrefix: source,
    sourcePresent: source !== null,
    limits: budget,
    producerFrameLedgerLimitBytes: 32 * 1024 ** 2,
    preservationComplete,
    integrityComplete,
    files: rows,
    sourceBytes: before?.total ?? 0,
    errors,
    integrityErrors,
    qualification: false,
    reuseAuthorized: false,
  };
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  need(bytes.length <= budget.manifestBytes, "MANIFEST_BOUND");
  retainCustodyProofFrame(path.join(destination, "retention-manifest.json"), bytes);
  return {
    status: preservationComplete
      ? source
        ? "ORIGINAL_PREFIX_PRESERVED"
        : "NO_WORKER_PREFIX"
      : "INCOMPLETE_ORIGINAL_RETENTION",
    preservationComplete,
    integrityComplete,
    manifest: path.join(destination, "retention-manifest.json"),
    manifestSha256: hash(bytes),
    files: rows.length,
    sourceBytes: manifest.sourceBytes,
    qualification: false,
    reuseAuthorized: false,
  };
}
export async function retainCustodyWorkerProofCLI(workspaceOption) {
  const env = process.env;
  need(
    env.GITHUB_REPOSITORY === "Kgray44/treasurehuntSoT" &&
      env.GITHUB_REF === "refs/heads/main" &&
      env.GITHUB_JOB === "campaign-custody" &&
      oid(env.GITHUB_SHA),
    "TRUSTED_WORKFLOW_CONTEXT",
  );
  const authority = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  directory(authority);
  const workspace = path.resolve(workspaceOption ?? "candidate");
  need(workspace === path.resolve(authority, "../candidate"), "FIXED_CANDIDATE_ROOT");
  const event = JSON.parse(readCustodyPilotSource(path.resolve(env.GITHUB_EVENT_PATH)));
  let baseSha, candidateSha, prNumber;
  if (env.GITHUB_EVENT_NAME === "pull_request_target") {
    need(
      event.pull_request?.base?.repo?.full_name === env.GITHUB_REPOSITORY &&
        event.pull_request?.head?.repo?.full_name === env.GITHUB_REPOSITORY,
      "SOURCE_REPOSITORY",
    );
    baseSha = event.pull_request.base.sha;
    candidateSha = event.pull_request.head.sha;
    prNumber = event.pull_request.number;
  } else {
    need(env.GITHUB_EVENT_NAME === "workflow_dispatch", "EVENT");
    baseSha = event.inputs?.base_sha;
    candidateSha = event.inputs?.candidate_sha;
    prNumber = Number(event.inputs?.pr_number);
  }
  need(baseSha === env.GITHUB_SHA, "INSTALLED_BASE");
  const safeEnv = Object.fromEntries(Object.entries(env).filter(([k]) => !/^GIT_/iu.test(k)));
  const installed = execFileSync(
    "git",
    ["-c", "core.fsmonitor=false", "-c", "protocol.allow=never", "-C", authority, "rev-parse", "HEAD"],
    {
      env: {
        ...safeEnv,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_CONFIG_SYSTEM: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_NO_LAZY_FETCH: "1",
      },
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 65536,
      windowsHide: true,
    },
  ).trim();
  need(installed === baseSha, "INSTALLED_HEAD");
  const binding = {
    repository: env.GITHUB_REPOSITORY,
    baseSha,
    candidateSha,
    prNumber,
    runId: env.GITHUB_RUN_ID,
    attempt: Number(env.GITHUB_RUN_ATTEMPT),
  };
  const destination = path.join(
    authority,
    "artifacts/sounding-line/custody-worker-proof",
    `run-${binding.runId}-${binding.attempt}`,
  );
  const result = retainCustodyWorkerProof({ workspace, destination, binding });
  let applied = false;
  try {
    const checkout = JSON.parse(readCustodyPilotSource(path.join(path.dirname(authority), "candidate.checkout.json")));
    applied = checkout.readSet?.applied === true;
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  console.log(JSON.stringify(result));
  if (!result.preservationComplete || (applied && !result.integrityComplete)) process.exitCode = 1;
  return result;
}
