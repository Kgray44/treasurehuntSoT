// In-process shadow comparison only. Persisted JSON, encrypted bytes, and these
// handles do not authenticate a provider or authorize ordinary browser reuse.
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { canonicalJson } from "./evidence.mjs";
import { shadowCaptureContextSchedule } from "./experience-browser.mjs";
import { inspectOwnedBrowserAuthorityReceipt } from "./browser-authority.mjs";
import { inspectOwnedRuntimeStateCut, fingerprintOwnedRuntimeEntrypoint } from "./owned-runtime-state-retention.mjs";
import { restoreRuntimeSnapshotRetention } from "./runtime-snapshot-retention.mjs";
import { rawCaptureBinding, readBoundedRawCaptureFile } from "./experience-raw-output.mjs";
const handles = new WeakMap(),
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_CONTEXT_RESUME_SHADOW_${code}`);
};
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const parse = (bytes) => {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Error("SOUNDING_LINE_CONTEXT_RESUME_SHADOW_JSON");
  }
};
export async function createClosedContextResumeShadow({
  root,
  plan,
  runtimeDigest,
  fixtureStateDigest,
  workerEntrypoint = fileURLToPath(new URL("./shadow-context-worker.mjs", import.meta.url)),
  applicationEntrypoint = path.resolve(root, "node_modules/next/dist/bin/next"),
}) {
  const planBytes = Buffer.from(JSON.stringify(plan));
  need(planBytes.length <= 2 * 1024 * 1024, "PLAN_BOUND");
  plan = parse(planBytes);
  const contexts = shadowCaptureContextSchedule(plan),
    captureBinding = rawCaptureBinding(plan);
  need(
    [runtimeDigest, fixtureStateDigest].every((value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)),
    "BINDING",
  );
  root = await realpath(root);
  const worker = await fingerprintOwnedRuntimeEntrypoint({ root, entrypoint: workerEntrypoint });
  const application = await fingerprintOwnedRuntimeEntrypoint({ root, entrypoint: applicationEntrypoint });
  const sourceKey = hash(canonicalJson({ plan, runtimeDigest, fixtureStateDigest, worker, application })),
    owner = {};
  const records = [];
  let queue = Promise.resolve(),
    mediaBytes = 0,
    metadataBytes = 0;
  const expectedBinding = (contextId) => ({
    prNumber: Number(plan.prNumber),
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    sourceDigest: plan.sourceDigest,
    runtimeDigest,
    contextId,
  });
  async function journal(record, totals, ids, paths) {
    const bytes = await readBoundedRawCaptureFile({
      root,
      rawDirectory: record.rawDirectory,
      file: record.journal.path,
      maximumBytes: 2 * 1024 * 1024,
    });
    need(bytes.length === record.journal.bytes && hash(bytes) === record.journal.sha256, "JOURNAL_CHANGED");
    totals.metadata += bytes.length;
    need(totals.metadata <= 64 * 1024 * 1024, "BOUND");
    const value = parse(bytes),
      target = contexts[record.ordinal - 1];
    need(
      value.classification === "CLOSED_BROWSER_CONTEXT_OBSERVATION_NOT_RUNTIME_CLEANUP" &&
        equal(value.binding, captureBinding) &&
        equal(value.context, target.context) &&
        value.journey?.status === "PASS" &&
        value.journey.id === target.context.journeyId &&
        value.qualification === false &&
        value.reuseAuthorized === false,
      "JOURNAL_BINDING",
    );
    need(
      Array.isArray(value.artifacts) &&
        value.artifacts.length > 0 &&
        value.artifacts.length <= 512 &&
        Array.isArray(value.rawFiles) &&
        value.rawFiles.length === value.artifacts.length,
      "MEDIA",
    );
    const original = new Map();
    for (const artifact of value.artifacts) {
      need(
        typeof artifact.id === "string" &&
          !ids.has(artifact.id) &&
          typeof artifact.path === "string" &&
          !paths.has(artifact.path) &&
          !original.has(artifact.path),
        "MEDIA_IDENTITY",
      );
      ids.add(artifact.id);
      paths.add(artifact.path);
      original.set(artifact.path, artifact);
    }
    need(ids.size <= 8192, "BOUND");
    for (const file of value.rawFiles) {
      const artifact = original.get(file.originalPath);
      need(
        artifact &&
          artifact.sha256 === file.sha256 &&
          Number.isSafeInteger(file.bytes) &&
          file.bytes > 0 &&
          file.bytes <= 64 * 1024 * 1024,
        "MEDIA",
      );
      totals.media += file.bytes;
      need(totals.media <= 256 * 1024 * 1024, "BOUND");
      const retained = await readBoundedRawCaptureFile({
        root,
        rawDirectory: record.rawDirectory,
        file: file.path,
        maximumBytes: file.bytes,
      });
      need(retained.length === file.bytes && hash(retained) === file.sha256, "MEDIA_CHANGED");
      original.delete(file.originalPath);
    }
    need(original.size === 0, "MEDIA");
    return value;
  }
  async function append({ stateCut, runtimeReceipt, workerInputPath, workerInputSha256 }) {
    need(records.length < contexts.length, "PREFIX_COMPLETE");
    const target = contexts[records.length],
      binding = expectedBinding(target.contextId);
    const runtime = inspectOwnedBrowserAuthorityReceipt(runtimeReceipt, { root });
    need(runtime, "RUNTIME_PROOF");
    const view = inspectOwnedRuntimeStateCut(stateCut, {
      root,
      expectedOriginalBinding: binding,
      runtimeReferences: runtime.references,
    });
    need(view, "STATE_PROOF");
    const capture = view.receipt.launches.find((value) => value.role === "capture");
    const app = view.receipt.launches.find((value) => value.role === "application");
    need(
      app?.entrypoint === application.entrypoint && app.entrypointSha256 === application.sha256,
      "APPLICATION_PROOF",
    );
    need(
      capture?.entrypoint === worker.entrypoint &&
        capture.entrypointSha256 === worker.sha256 &&
        view.receipt.cleanup.capture.payloadExitCode === 0,
      "WORKER_PROOF",
    );
    need(typeof workerInputSha256 === "string" && /^[a-f0-9]{64}$/u.test(workerInputSha256), "INPUT");
    need(
      capture.argumentsSha256 ===
        hash(
          JSON.stringify([
            "--raw-directory",
            view.rawDirectory,
            "--input",
            workerInputPath,
            "--input-sha256",
            workerInputSha256,
          ]),
        ),
      "INPUT_BINDING",
    );
    const inputBytes = await readBoundedRawCaptureFile({
      root,
      rawDirectory: view.rawDirectory,
      file: workerInputPath,
      maximumBytes: 32768,
    });
    need(hash(inputBytes) === workerInputSha256, "INPUT_CHANGED");
    const input = parse(inputBytes);
    need(input.version === 1 && input.contextId === target.contextId, "CONTEXT_ORDER");
    const originalPlan = await readBoundedRawCaptureFile({
      root,
      rawDirectory: view.rawDirectory,
      file: input.planPath,
      maximumBytes: 2 * 1024 * 1024,
    });
    need(hash(originalPlan) === input.planSha256 && equal(parse(originalPlan), plan), "PLAN_CHANGED");
    const outputBytes = await readBoundedRawCaptureFile({
        root,
        rawDirectory: view.rawDirectory,
        file: input.resultPath,
        maximumBytes: 32768,
      }),
      output = parse(outputBytes);
    need(
      output.kind === "PARTIAL_SHADOW_CONTEXT_RESULT" &&
        output.contextId === target.contextId &&
        output.qualification === false &&
        output.reuseAuthorized === false &&
        output.closedContextJournal,
      "RESULT",
    );
    const record = {
      ordinal: target.ordinal,
      contextId: target.contextId,
      rawDirectory: view.rawDirectory,
      journal: output.closedContextJournal,
      stateCut,
      runtimeReceipt,
      workerInputPath,
      workerInputSha256,
      planPath: input.planPath,
      planSha256: input.planSha256,
      resultPath: input.resultPath,
      resultSha256: hash(outputBytes),
      retainedId: view.receipt.retained.id,
      binding,
    };
    const totals = { media: mediaBytes, metadata: metadataBytes },
      ids = new Set(),
      paths = new Set();
    for (const old of records)
      for (const artifact of old.artifacts) {
        ids.add(artifact.id);
        paths.add(artifact.path);
      }
    const observed = await journal(record, totals, ids, paths);
    const restored = await restoreRuntimeSnapshotRetention({
      root,
      rawDirectory: view.rawDirectory,
      id: record.retainedId,
      expectedOriginalBinding: binding,
    });
    const cache = await readBoundedRawCaptureFile({
      root,
      rawDirectory: view.rawDirectory,
      file: output.privateAuthenticationCache.path,
      maximumBytes: 2 * 1024 * 1024,
    });
    need(
      hash(cache) === output.privateAuthenticationCache.sha256 &&
        cache.equals(restored.files.get("browser-authentication-cache")) &&
        hash(restored.files.get("sqlite-backup")) === view.receipt.snapshot.sha256 &&
        hash(restored.files.get("fixture-state")) === fixtureStateDigest,
      "STATE_CHANGED",
    );
    record.artifacts = observed.artifacts;
    records.push(record);
    mediaBytes = totals.media;
    metadataBytes = totals.metadata;
    return Object.freeze({ completedContexts: records.length, qualification: false, reuseAuthorized: false });
  }
  return Object.freeze({
    append(input) {
      const result = queue.then(() => append(input));
      queue = result.catch(() => {});
      return result;
    },
    snapshot() {
      need(records.length > 0, "EMPTY_PREFIX");
      const handle = Object.freeze({
        kind: "CLOSED_CONTEXT_PREFIX_SHADOW_NOT_PROVIDER_AUTHENTICATED",
        completedContexts: records.length,
        qualification: false,
        reuseAuthorized: false,
      });
      handles.set(handle, { owner, records: [...records], sourceKey });
      return handle;
    },
    async restore(handle, { plan: currentPlan, runtimeDigest: currentRuntimeDigest }) {
      const value = handles.get(handle);
      need(
        value?.owner === owner &&
          value.sourceKey === sourceKey &&
          currentRuntimeDigest === runtimeDigest &&
          equal(currentPlan, plan),
        "PREFIX_PROOF",
      );
      need(
        equal(await fingerprintOwnedRuntimeEntrypoint({ root, entrypoint: workerEntrypoint }), worker),
        "WORKER_CHANGED",
      );
      need(
        equal(await fingerprintOwnedRuntimeEntrypoint({ root, entrypoint: applicationEntrypoint }), application),
        "APPLICATION_CHANGED",
      );
      const totals = { media: 0, metadata: 0 },
        ids = new Set(),
        paths = new Set(),
        originalArtifacts = [];
      for (const record of value.records) {
        const runtime = inspectOwnedBrowserAuthorityReceipt(record.runtimeReceipt, { root });
        need(runtime, "RUNTIME_PROOF");
        need(
          inspectOwnedRuntimeStateCut(record.stateCut, {
            root,
            expectedOriginalBinding: record.binding,
            runtimeReferences: runtime.references,
          }),
          "STATE_PROOF",
        );
        const input = await readBoundedRawCaptureFile({
          root,
          rawDirectory: record.rawDirectory,
          file: record.workerInputPath,
          maximumBytes: 32768,
        });
        need(hash(input) === record.workerInputSha256, "INPUT_CHANGED");
        const planInput = await readBoundedRawCaptureFile({
          root,
          rawDirectory: record.rawDirectory,
          file: record.planPath,
          maximumBytes: 2 * 1024 * 1024,
        });
        need(hash(planInput) === record.planSha256, "PLAN_CHANGED");
        const resultInput = await readBoundedRawCaptureFile({
          root,
          rawDirectory: record.rawDirectory,
          file: record.resultPath,
          maximumBytes: 32768,
        });
        need(hash(resultInput) === record.resultSha256, "RESULT_CHANGED");
        const observed = await journal(record, totals, ids, paths);
        originalArtifacts.push(...observed.artifacts);
      }
      const last = value.records.at(-1),
        state = await restoreRuntimeSnapshotRetention({
          root,
          rawDirectory: last.rawDirectory,
          id: last.retainedId,
          expectedOriginalBinding: last.binding,
        });
      return Object.freeze({
        kind: "RESTORED_SHADOW_COMPARISON_STATE_NOT_RESUME_AUTHORITY",
        qualification: false,
        reuseAuthorized: false,
        completedContexts: value.records.length,
        nextContext: contexts[value.records.length] ?? null,
        originalArtifacts,
        originalBinding: state.originalBinding,
        files: state.files,
        runtimeIsolation: "EXTERNAL_DEPENDENCY_CLOSURE_NOT_CERTIFIED",
        reviewDisposition: "INDEPENDENT_REVIEW_STILL_REQUIRED",
      });
    },
  });
}
