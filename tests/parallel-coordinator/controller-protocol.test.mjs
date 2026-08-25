import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROLLER_PROTOCOL_VERSION,
  registerWorker,
  validateDispatchEnvelope,
  validateWorkerRegistry,
  validateWorkerReply,
} from "../../scripts/parallel-coordinator/controller-protocol.mjs";

const sha = (character) => character.repeat(40);

function registry() {
  return {
    version: 1,
    workers: [{ project: "Drydock", pr: 198, workerRef: "agent:drydock", status: "IDLE", lastDispatchId: null }],
  };
}

function dispatch(overrides = {}) {
  return {
    protocolVersion: CONTROLLER_PROTOCOL_VERSION,
    dispatchId: "pc-v1-drydock-0001",
    project: "Drydock",
    pr: 198,
    action: "FINALIZE_NEXT",
    expectedCandidateSha: sha("a"),
    protectedMainSha: sha("b"),
    instructions: { scope: "bounded" },
    returnContract: "PARALLEL_WORKER_REPLY_V1",
    ...overrides,
  };
}

test("worker routing is task-local registry state, distinct from the product handoff", () => {
  const normalized = validateWorkerRegistry(registry());
  assert.deepEqual(normalized.workers[0], {
    project: "Drydock",
    pr: 198,
    workerRef: "agent:drydock",
    status: "IDLE",
    lastDispatchId: null,
  });
  assert.throws(
    () => registerWorker(registry(), { project: "Other", pr: 199, workerRef: "agent:drydock", status: "IDLE" }),
    /PARALLEL_CONTROLLER_WORKER_REGISTRY_DUPLICATE/u,
  );
});

test("dispatch validation requires a bounded action, target, candidate, main, and reply contract", () => {
  assert.equal(validateDispatchEnvelope(dispatch()).action, "FINALIZE_NEXT");
  assert.throws(() => validateDispatchEnvelope(dispatch({ action: "MERGE_EVERYTHING" })), /DISPATCH_ACTION_INVALID/u);
  assert.throws(
    () => validateDispatchEnvelope(dispatch({ returnContract: "prose" })),
    /DISPATCH_RETURN_CONTRACT_INVALID/u,
  );
  assert.throws(() => validateDispatchEnvelope(dispatch({ dispatchId: "short" })), /DISPATCH_ID_INVALID/u);
});

test("worker replies use a small result vocabulary and require result-specific evidence", () => {
  const ready = validateWorkerReply({
    protocolVersion: 1,
    dispatchId: "pc-v1-drydock-0001",
    project: "Drydock",
    pr: 198,
    result: "READY",
    candidateSha: sha("c"),
    handoff: { version: 1 },
    mergeSha: null,
    landedPaths: [],
    blocker: null,
  });
  assert.equal(ready.result, "READY");
  assert.throws(
    () => validateWorkerReply({ ...ready, result: "MERGED", mergeSha: null }),
    /PARALLEL_CONTROLLER_REPLY_MERGE_SHA_REQUIRED/u,
  );
  assert.throws(
    () => validateWorkerReply({ ...ready, result: "BLOCKED", handoff: null, blocker: null }),
    /PARALLEL_CONTROLLER_REPLY_BLOCKER_REQUIRED/u,
  );
});
