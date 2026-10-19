// Current-source observation; the historical R14 implementation remains byte-for-byte unchanged.
import { isCurrentAdmissionPlan } from "./experience-current-admission.mjs";
// Private observations for a separately admitted current-source whole qualification.
// Capturing an error supplies neither execution permission nor product evidence.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  constants as F,
  appendFileSync,
  closeSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const CURRENT_OBSERVATION = Object.freeze({
  repository: "Kgray44/treasurehuntSoT",
  keyId: "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc",
  maximumBytes: 16 * 1024 * 1024,
  maximumErrors: 128,
});
const publicKey =
  "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAqhR0X1gnk0ll9753ViDR\nia9R8pIDEYZDydLXSaSg9lRNd6kYNdkyeb7Bqt8z/A/MAJP5ngCPUaH0xvq4n+OQ\nXkF0v9XqdD/xkaZX4Cv4xiLyJkTU2lOdMEKI96o9dsHN428BTZ7nbW7sZ5Uh19L7\n8wYIw/mm+A44+3T5Tp0SCcoUcT9HqTZgk3r1CGu33WvNjeqyid22nYVSsPipQga+\ncTpcDQve9MePaFCPsi/KrRrsK2yxkgUwFY20SWu26ZjklAlQ0+isLE06f3MmsH0s\nimq0PLjcRbDG99iCJ/TiwEpZQJNJQT3n1rN7HzSYef0WZFKKkb+vF/vwihOP1AoF\nOwlHPHj3tiy5TR7ZXoqRSYC43NFDRVHp2WP8mDdJT2TInGhrwCuW/l0bpds+p7wQ\nUC2OIfq1p/FivQtp0X+4UDs8YjpSnrhl8cgqz9ipzr72TrB95I60ygrHIAfqKh47\nHKu5BOb2GG1c5KLTH9oJiZ4hsf620/dZ1Y0JjJAYAmmjAgMBAAE=\n-----END PUBLIC KEY-----\n";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (value) => {
  if (!value) throw Error("SOUNDING_LINE_CURRENT_OBSERVATION_INVALID");
};
const sha = (value, length) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);
const runtime = () => ({
  node: process.version,
  pid: process.pid,
  at: new Date().toISOString(),
  memory: process.memoryUsage(),
  resource: process.resourceUsage(),
});
const contextKeys = [
  "version",
  "observationId",
  "repository",
  "exceptionId",
  "recordDigest",
  "contractDigest",
  "publicationNonceDigest",
  "baseSha",
  "candidateSha",
  "sourceDigest",
  "runId",
  "runAttempt",
  "job",
  "keyId",
];
function exactKeys(value, keys) {
  need(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key)),
  );
}
function base64(value, maximum) {
  need(typeof value === "string" && value.length <= Math.ceil(maximum / 3) * 4);
  const bytes = Buffer.from(value, "base64");
  need(bytes.length <= maximum && bytes.toString("base64") === value);
  return bytes;
}
function privateDirectory(directory) {
  const stat = lstatSync(directory);
  need(
    stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      stat.uid === process.getuid() &&
      realpathSync(directory) === directory,
  );
}
function outputDirectory(root) {
  privateDirectory(root);
  let current = root;
  for (const name of ["artifacts", "sounding-line"]) {
    current = path.join(current, name);
    try {
      lstatSync(current);
    } catch (error) {
      need(error.code === "ENOENT");
      mkdirSync(current, { mode: 0o700 });
    }
    privateDirectory(current);
  }
  return current;
}
export function validateCurrentAdmissionObservationCiphertext({ file, observation }) {
  need(
    typeof file === "string" &&
      path.isAbsolute(file) &&
      path.normalize(file) === file &&
      path.basename(file) === "current-admission-observation.encrypted" &&
      realpathSync(path.dirname(file)) === path.dirname(file),
  );
  need(
    observation?.format === "VW-POSTTECHNICAL-EVIDENCE-1" &&
      sha(observation.ciphertextDigest, 64) &&
      Number.isSafeInteger(observation.ciphertextBytes) &&
      observation.ciphertextBytes > 0 &&
      observation.ciphertextBytes <= 64 * 1024 * 1024,
  );
  let descriptor;
  try {
    descriptor = openSync(file, F.O_RDONLY | F.O_NOFOLLOW);
    const stat = fstatSync(descriptor),
      named = lstatSync(file);
    need(
      stat.isFile() &&
        stat.nlink === 1 &&
        stat.uid === process.getuid() &&
        !named.isSymbolicLink() &&
        stat.dev === named.dev &&
        stat.ino === named.ino &&
        stat.size === observation.ciphertextBytes,
    );
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      need(count > 0);
      offset += count;
    }
    const after = fstatSync(descriptor),
      afterNamed = lstatSync(file);
    need(
      after.size === stat.size &&
        after.dev === stat.dev &&
        after.ino === stat.ino &&
        after.nlink === 1 &&
        after.mtimeMs === stat.mtimeMs &&
        after.ctimeMs === stat.ctimeMs &&
        !afterNamed.isSymbolicLink() &&
        afterNamed.dev === stat.dev &&
        afterNamed.ino === stat.ino &&
        hash(bytes) === observation.ciphertextDigest,
    );
    const envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    exactKeys(envelope, ["format", "aad", "ciphertext", "tag"]);
    need(Buffer.from(JSON.stringify(envelope)).equals(bytes) && envelope.format === observation.format);
    const headerBytes = base64(envelope.aad, 8192);
    const header = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(headerBytes));
    exactKeys(header, [...contextKeys, "format", "algorithms", "plaintextBytes", "nonce", "wrappedKey"]);
    need(
      Buffer.from(JSON.stringify(header)).equals(headerBytes) &&
        contextKeys.every((key) => header[key] === observation[key]) &&
        header.format === observation.format &&
        JSON.stringify(header.algorithms) === '{"content":"AES-256-GCM","keyWrap":"RSA-OAEP-SHA256"}' &&
        Number.isSafeInteger(header.plaintextBytes) &&
        header.plaintextBytes > 0 &&
        base64(envelope.ciphertext, 48 * 1024 * 1024).length === header.plaintextBytes &&
        base64(envelope.tag, 16).length === 16 &&
        base64(header.nonce, 12).length === 12 &&
        base64(header.wrappedKey, 384).length === 384,
    );
    return {
      status: "CIPHERTEXT_FILE_AND_CONTEXT_BOUND_NOT_PRIVATE_AUTHENTICATION",
      ciphertextDigest: hash(bytes),
      ciphertextBytes: bytes.length,
    };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
function output(value) {
  if (!Buffer.isBuffer(value) && typeof value !== "string") return { available: false };
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  need(bytes.length <= CURRENT_OBSERVATION.maximumBytes);
  return { available: true, bytes: bytes.length, sha256: hash(bytes), content: bytes.toString("base64") };
}
function errorRecord(error, depth = 0, seen = new Map()) {
  // Never enumerate an error, process environment, request, lease or credentials.
  if (error === null || typeof error !== "object") {
    need(["undefined", "string", "number", "boolean"].includes(typeof error) || error === null);
    return error === undefined ? null : error;
  }
  if (seen.has(error)) return { reference: seen.get(error) };
  need(depth < 4);
  seen.set(error, depth);
  const text = (key) => (typeof error?.[key] === "string" ? error[key] : null);
  const spawnargs = error.spawnargs;
  need(
    spawnargs === undefined ||
      (Array.isArray(spawnargs) && spawnargs.length <= 2048 && spawnargs.every((value) => typeof value === "string")),
  );
  return {
    name: text("name"),
    message: text("message"),
    stack: text("stack"),
    code: text("code"),
    signal: text("signal"),
    status: Number.isInteger(error?.status) ? error.status : null,
    errno: Number.isSafeInteger(error.errno) ? error.errno : text("errno"),
    syscall: text("syscall"),
    path: text("path"),
    dest: text("dest"),
    spawnfile: text("spawnfile"),
    spawnargs: spawnargs ?? null,
    stdout: output(error?.stdout),
    stderr: output(error?.stderr),
    cause: error.cause === undefined ? null : errorRecord(error.cause, depth + 1, seen),
  };
}
export function createCurrentAdmissionObservation({ root, plan, environment = process.env }) {
  if (!isCurrentAdmissionPlan(plan)) return null;
  const publicationNonce = environment.SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE;
  need(
    sha(plan.baseSha, 40) &&
      sha(plan.candidateSha, 40) &&
      sha(plan.sourceDigest, 64) &&
      sha(plan.contractDigest, 64) &&
      sha(plan.exception.recordDigest, 64) &&
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(publicationNonce ?? "") &&
      /^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ID ?? "") &&
      Number.isSafeInteger(Number(environment.GITHUB_RUN_ID)) &&
      environment.GITHUB_RUN_ATTEMPT === "1" &&
      environment.GITHUB_REPOSITORY === CURRENT_OBSERVATION.repository &&
      environment.GITHUB_JOB === "final-check",
  );
  need(hash(publicKey) === CURRENT_OBSERVATION.keyId);
  root = realpathSync(root);
  privateDirectory(root);
  const directory = mkdtempSync(path.join(tmpdir(), "vw-current-admission-observation-"));
  privateDirectory(directory);
  need((lstatSync(directory).mode & 0o077) === 0);
  const state = {
    supportedGitReads: 0,
    observedGitThrows: 0,
    retainedGitThrows: 0,
    evidenceLoss: false,
    cleanup: false,
    sourceUnchanged: false,
  };
  const started = runtime(),
    records = [];
  let bytes = 0,
    finished = false,
    finalFailure = null;
  const append = (record) => {
    const line = Buffer.from(JSON.stringify(record) + "\n");
    need(records.length < CURRENT_OBSERVATION.maximumErrors && bytes + line.length <= CURRENT_OBSERVATION.maximumBytes);
    records.push(line);
    bytes += line.length;
  };
  return {
    executeGitRead(execute, args, options) {
      state.supportedGitReads++;
      // Only replace the exact historical stderr-discarding tuple. Other options
      // retain their original transport; standard default pipe already retains it.
      const replace = JSON.stringify(options.stdio) === '["ignore","pipe","ignore"]';
      let descriptor,
        filename,
        selected = options,
        created = false;
      if (replace) {
        filename = path.join(directory, `stderr-${state.supportedGitReads}`);
        try {
          descriptor = openSync(filename, F.O_RDWR | F.O_CREAT | F.O_EXCL | F.O_NOFOLLOW, 0o600);
          created = true;
          const stat = fstatSync(descriptor),
            named = lstatSync(filename);
          need(
            stat.isFile() &&
              stat.nlink === 1 &&
              stat.uid === process.getuid() &&
              (stat.mode & 0o077) === 0 &&
              stat.ino === named.ino &&
              stat.dev === named.dev &&
              !named.isSymbolicLink() &&
              realpathSync(filename) === filename,
          );
          selected = { ...options, stdio: ["ignore", "pipe", descriptor] };
        } catch {
          state.evidenceLoss = true;
        }
      }
      try {
        return execute("git", args, selected);
      } catch (error) {
        state.observedGitThrows++;
        try {
          let stderr = error?.stderr;
          if (descriptor !== undefined) {
            const stat = fstatSync(descriptor);
            need(stat.size <= CURRENT_OBSERVATION.maximumBytes && stat.nlink === 1);
            // fd writes can grow while Git executes; this is a retained-data cap,
            // not a new hard disk/RSS bound or child-process supervisor.
            stderr = Buffer.alloc(stat.size);
            let offset = 0;
            while (offset < stderr.length) {
              const count = readSync(descriptor, stderr, offset, stderr.length - offset, offset);
              need(count > 0);
              offset += count;
            }
            const after = fstatSync(descriptor),
              named = lstatSync(filename);
            need(
              after.size === stat.size &&
                after.ino === stat.ino &&
                after.dev === stat.dev &&
                named.ino === stat.ino &&
                named.dev === stat.dev &&
                !named.isSymbolicLink(),
            );
          }
          append({
            version: 1,
            ordinal: state.observedGitThrows,
            argv: args,
            cwd: options.cwd,
            error: errorRecord(error),
            capturedStderr: output(stderr),
            runtime: runtime(),
          });
          state.retainedGitThrows++;
        } catch {
          state.evidenceLoss = true;
        }
        throw error;
      } finally {
        try {
          if (descriptor !== undefined) closeSync(descriptor);
        } catch {
          state.evidenceLoss = true;
        }
        try {
          if (created) unlinkSync(filename);
        } catch {
          state.evidenceLoss = true;
        }
      }
    },
    rememberFinalFailure(error) {
      try {
        finalFailure = errorRecord(error);
        need(Buffer.byteLength(JSON.stringify(finalFailure)) <= CURRENT_OBSERVATION.maximumBytes);
      } catch {
        finalFailure = null;
        state.evidenceLoss = true;
      }
    },
    async finish() {
      need(!finished);
      finished = true;
      try {
        rmdirSync(directory);
        state.cleanup = true;
      } catch {
        state.evidenceLoss = true;
      }
      try {
        state.sourceUnchanged =
          execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim() === plan.candidateSha;
        execFileSync("git", ["diff", "--quiet", plan.candidateSha, "--"], {
          cwd: root,
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        state.sourceUnchanged = false;
        state.evidenceLoss = true;
      }
      const context = {
        version: 1,
        observationId: plan.exception.currentSourceAdmission.observation.id,
        repository: CURRENT_OBSERVATION.repository,
        exceptionId: plan.exception.id,
        recordDigest: plan.exception.recordDigest,
        contractDigest: plan.contractDigest,
        publicationNonceDigest: hash(Buffer.from(publicationNonce)),
        baseSha: plan.baseSha,
        candidateSha: plan.candidateSha,
        sourceDigest: plan.sourceDigest,
        runId: Number(environment.GITHUB_RUN_ID),
        runAttempt: 1,
        job: "final-check",
        keyId: CURRENT_OBSERVATION.keyId,
      };
      const summary = {
        ...context,
        classification: "PRIVATE_OBSERVATIONS_NOT_ACCEPTANCE",
        ...state,
        coverage: "SUPPORTED_REPLAY_ADMISSION_GIT_READS_AND_FINAL_PROPAGATED_ERROR",
        publicationReady: false,
        status: "EVIDENCE_LOSS",
      };
      try {
        const files = [
          { name: "private/git-exceptions.original.jsonl", bytes: Buffer.concat(records) },
          {
            name: "private/runtime.original.json",
            bytes: Buffer.from(
              JSON.stringify({ version: 1, context, started, completed: runtime(), state, finalFailure }) + "\n",
            ),
          },
        ];
        const { sealPosttechnicalEvidence } = await import("./replay-posttechnical-diagnostic.mjs");
        const encrypted = sealPosttechnicalEvidence({ files, aad: context, publicKey });
        const destination = path.join(outputDirectory(root), "current-admission-observation.encrypted");
        writeFileSync(destination, encrypted, { flag: "wx", mode: 0o600 });
        Object.assign(summary, {
          format: "VW-POSTTECHNICAL-EVIDENCE-1",
          ciphertextDigest: hash(encrypted),
          ciphertextBytes: encrypted.length,
          memberCount: files.length,
          rawBytes: files.reduce((total, file) => total + file.bytes.length, 0),
        });
        validateCurrentAdmissionObservationCiphertext({ file: destination, observation: summary });
        if (environment.GITHUB_ACTIONS === "true") {
          need(typeof environment.GITHUB_OUTPUT === "string" && environment.GITHUB_OUTPUT.length > 0);
          appendFileSync(
            environment.GITHUB_OUTPUT,
            `current_admission_observation_publish=${publicationNonce}\n`,
            "utf8",
          );
          summary.publicationReady = true;
        }
        summary.status = state.evidenceLoss || !state.cleanup || !state.sourceUnchanged ? "EVIDENCE_LOSS" : "COMPLETE";
      } catch {
        summary.evidenceLoss = true;
      }
      return summary;
    },
  };
}
