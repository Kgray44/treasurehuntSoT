// Preparation producers are distinct from browser/server producers. Private bytes
// remain in this host's memory; a serialized receipt cannot recreate their token.
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { processExit, spawnOwnedProcess, stopOwnedProcess } from "./owned-process.mjs";

export const PREPARATION_LIMITS = Object.freeze({
  producers: 8,
  streamBytes: 16 * 1024 * 1024,
  aggregateBytes: 32 * 1024 * 1024,
  receiptBytes: 1024 * 1024,
  errorBytes: 64 * 1024,
});
const captures = new WeakMap();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (value) => {
  if (!value) throw Error("DEVELOPMENT_PREPARATION_EVIDENCE_INVALID");
};
const hostPhases = new Set([
  "PREFLIGHT",
  "LOCK",
  "SOURCE_FINGERPRINT",
  "CONTEXT",
  "DEPENDENCIES",
  "SETUP",
  "PRODUCTION_BUILD",
  "VERIFY_SOURCE",
  "FREEZE_BUILD",
  "SNAPSHOT_DATABASE",
  "MANIFEST",
  "FINALIZATION",
]);
function producerPhase(label) {
  if (label === "next-build") return "PRODUCTION_BUILD";
  if (label === "prisma-generate") return "PRISMA_GENERATE";
  if (label === "sqlite-bootstrap") return "SQLITE_BOOTSTRAP";
  if (label === "generic-seed") return "GENERIC_SEED";
  need(/^scripts\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.[cm]?[jt]s$/u.test(label ?? ""));
  return "PREPARER";
}
function boundedText(value, maximum) {
  const text = String(value ?? "");
  // Bound the allocation before UTF-8 encoding, then retain a byte prefix.
  const bytes = Buffer.from(text.slice(0, maximum));
  return {
    text: bytes.subarray(0, maximum).toString("utf8"),
    truncated: text.length > maximum || bytes.length > maximum,
  };
}
export function preparationPrivateError(error) {
  return {
    name: boundedText(error?.name, 256),
    message: boundedText(error?.message ?? error, PREPARATION_LIMITS.errorBytes),
    stack: boundedText(error?.stack, PREPARATION_LIMITS.errorBytes),
    code: boundedText(error?.code, 256),
  };
}
function closed(cleanup) {
  return (
    cleanup?.status === "PASS" &&
    cleanup.directExitObserved === true &&
    cleanup.treeReaped === true &&
    cleanup.streamsClosed === true &&
    ["WINDOWS_JOB_OBJECT", "LINUX_SUBREAPER_AND_PIDFD"].includes(cleanup.ownership)
  );
}
// This launcher owns setup/build children and records the attempt before spawn.
// No externally supplied cleanup flag can make streams eligible for publication.
export function createPreparationCapture(binding, privateDirectory) {
  need(binding && typeof binding === "object");
  const context = JSON.parse(JSON.stringify(binding));
  const attempts = [];
  let retained = 0,
    phase = "PREFLIGHT",
    source = null,
    completed = false,
    active = false;
  let runtimeSecret;
  return Object.freeze({
    phase(value) {
      need(!completed && hostPhases.has(value));
      phase = value;
    },
    source(value) {
      need(!completed && value?.head === context.candidateSha && /^[a-f0-9]{64}$/u.test(value?.digest ?? ""));
      source = { head: value.head, digest: value.digest };
    },
    async runPreparationStep(plan, env, step, receipts) {
      need(!completed && !active && attempts.length < PREPARATION_LIMITS.producers);
      const producer = producerPhase(step.label);
      need(
        Array.isArray(step.args) &&
          step.args.length <= 64 &&
          step.args.every((arg) => typeof arg === "string" && Buffer.byteLength(arg) <= 8192),
      );
      phase = producer === "PRODUCTION_BUILD" ? producer : "SETUP";
      const item = {
        ordinal: attempts.length + 1,
        producer,
        label: step.label,
        producerId: randomUUID(),
        spawned: false,
        exit: null,
        cleanup: null,
        streams: {},
      };
      attempts.push(item);
      active = true;
      runtimeSecret = env.PHASE2_LEGACY_ACCESS_CODE;
      let child, timer, failure;
      try {
        const args = step.args.map((arg) => (arg === "<owned-database-url>" ? env.DATABASE_URL : arg));
        item.argvSHA256 = digest(JSON.stringify(args));
        child = spawnOwnedProcess(process.execPath, args, { root: plan.workspace, env });
        item.spawned = true;
        child.stdout.unpipe(process.stdout);
        child.stderr.unpipe(process.stderr);
        for (const [kind, stream] of [
          ["stdout", child.stdout],
          ["stderr", child.stderr],
        ]) {
          const state = {
            chunks: [],
            observedBytes: 0,
            retainedBytes: 0,
            truncated: false,
            digest: createHash("sha256"),
          };
          item.streams[kind] = state;
          stream.on("data", (chunk) => {
            state.observedBytes += chunk.length;
            state.digest.update(chunk);
            const count = Math.max(
              0,
              Math.min(
                chunk.length,
                PREPARATION_LIMITS.streamBytes - state.retainedBytes,
                PREPARATION_LIMITS.aggregateBytes - retained,
              ),
            );
            if (count) {
              state.chunks.push(Buffer.from(chunk.subarray(0, count)));
              state.retainedBytes += count;
              retained += count;
            }
            if (count !== chunk.length) state.truncated = true;
          });
          stream.resume();
        }
        item.exit = await Promise.race([
          processExit(child),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error("DEVELOPMENT_SETUP_TIMEOUT")), 20 * 60_000);
          }),
        ]);
      } catch (error) {
        failure = error;
        item.error = preparationPrivateError(error);
      } finally {
        clearTimeout(timer);
        if (child) {
          try {
            item.cleanup = await stopOwnedProcess(child);
          } catch (error) {
            item.cleanup = { status: "FAIL" };
            item.cleanupError = preparationPrivateError(error);
          }
        }
        receipts.push({
          label: step.label,
          ordinal: item.ordinal,
          producer,
          spawned: item.spawned,
          exit: item.exit,
          cleanup: item.cleanup ?? { status: "NOT_STARTED" },
        });
        active = false;
      }
      if (failure) throw failure;
      if (item.exit?.code !== 0 || item.exit.supervisionFailure || !closed(item.cleanup))
        throw Error(`DEVELOPMENT_SETUP_FAILED:${step.label}`);
      if (Object.values(item.streams).some((stream) => stream.truncated)) throw Error("DEVELOPMENT_LOG_LIMIT_EXCEEDED");
    },
    async close() {
      need(!completed && !active);
      const logs = [];
      if (!privateDirectory || attempts.length === 0) return logs;
      // Preserve local redacted preparation logs as well as encrypted raw bytes.
      need(typeof runtimeSecret === "string" && /^synthetic-[A-Za-z0-9_-]{32}$/u.test(runtimeSecret));
      for (const item of attempts) {
        if (!item.spawned) continue;
        need(closed(item.cleanup));
        for (const [kind, state] of Object.entries(item.streams)) {
          const original = Buffer.concat(state.chunks),
            token = Buffer.from(runtimeSecret),
            pieces = [];
          let offset = 0,
            found;
          while ((found = original.indexOf(token, offset)) !== -1) {
            pieces.push(original.subarray(offset, found), Buffer.from("[REDACTED_GENERATED_RUNTIME_CREDENTIAL]"));
            offset = found + token.length;
          }
          pieces.push(original.subarray(offset));
          const bytes = Buffer.concat(pieces),
            file = path.join(
              privateDirectory,
              `producer-${item.ordinal}-${item.producer.toLowerCase()}.${kind}.redacted.log`,
            );
          const handle = await open(
            file,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
          );
          try {
            await handle.writeFile(bytes);
            await handle.sync();
          } finally {
            await handle.close();
          }
          logs.push({
            ordinal: item.ordinal,
            producer: item.producer,
            kind,
            file,
            sha256: digest(bytes),
            originalBytes: state.observedBytes,
            originalStreamSHA256: state.digest.copy().digest("hex"),
            complete: !state.truncated,
          });
        }
      }
      need(attempts.every((item) => Object.values(item.streams).every((stream) => !stream.truncated)));
      return logs;
    },
    complete(receipt, error) {
      need(!completed && !active);
      completed = true;
      const issues = [];
      if (receipt.logEvidenceIncomplete) issues.push("LOG_FINALIZATION_FAILED");
      if (receipt.privateReceiptPersistence?.status === "FAIL") issues.push("PRIVATE_RECEIPT_PERSISTENCE_FAILED");
      if (receipt.lockRelease?.status === "FAIL") issues.push("LOCK_RELEASE_FAILED");
      const allClosed = attempts.every((item) => !item.spawned || closed(item.cleanup));
      if (!allClosed) issues.push("PRODUCER_CLOSURE_UNPROVEN");
      const files = [];
      const producers = attempts.map((item) => {
        const streams = Object.entries(item.streams).map(([kind, state]) => {
          if (state.truncated && !issues.includes("STREAM_TRUNCATED")) issues.push("STREAM_TRUNCATED");
          const name = `preparation/producer-${item.ordinal}-${item.producer.toLowerCase()}.${kind}.retained.bin`;
          // If any producer's closure is unproved, publish only the private receipt.
          if (allClosed) files.push({ name, bytes: Buffer.concat(state.chunks) });
          return {
            kind,
            name: allClosed ? name : null,
            observedBytes: state.observedBytes,
            retainedBytes: allClosed ? state.retainedBytes : 0,
            observedStreamSHA256: closed(item.cleanup) ? state.digest.copy().digest("hex") : null,
            complete: allClosed && !state.truncated,
          };
        });
        return { ...item, streams };
      });
      const privateError = error ? preparationPrivateError(error) : null;
      if (privateError && Object.values(privateError).some((value) => value.truncated)) issues.push("ERROR_TRUNCATED");
      let bytes = Buffer.from(
        JSON.stringify({
          version: 1,
          role: "DEVELOPMENT_ONLY",
          qualification: false,
          binding: context,
          source,
          sourceUnavailable: source === null,
          phase,
          originalResult: receipt,
          error: privateError,
          producers,
          issues,
        }) + "\n",
      );
      if (bytes.length > PREPARATION_LIMITS.receiptBytes) {
        issues.push("RECEIPT_TRUNCATED");
        bytes = Buffer.from(
          JSON.stringify({
            version: 1,
            role: "DEVELOPMENT_ONLY",
            qualification: false,
            binding: context,
            source,
            sourceUnavailable: source === null,
            phase,
            status: receipt.status,
            error: privateError,
            producers,
            issues,
            originalReceiptOmitted: true,
          }) + "\n",
        );
      }
      need(bytes.length <= PREPARATION_LIMITS.receiptBytes);
      files.unshift({ name: "preparation/result.private.json", bytes });
      const token = Object.freeze({ version: 1, role: "DEVELOPMENT_ONLY", qualification: false });
      captures.set(token, { context, files, issues, failed: !receipt.status.startsWith("PASS_") });
      return token;
    },
  });
}
export function preparationFailureEvidenceFiles(token, binding) {
  const captured = captures.get(token);
  need(captured && JSON.stringify(captured.context) === JSON.stringify(binding));
  return {
    files: captured.files.map(({ name, bytes }) => ({ name, bytes: Buffer.from(bytes) })),
    issues: [...captured.issues],
    failed: captured.failed,
  };
}
