import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeAdapter, resolveAdapter } from "./adapters.mjs";
import {
  createEvidenceManifest,
  digest,
  enrollWorker,
  heartbeatWorker,
  sealAssignment,
  transitionWorker,
  verifyAssignment,
  verifyEvidence,
} from "./phase4.mjs";

const initialState = () => ({ version: 1, workers: {}, assignments: {}, evidence: {}, usedNonces: [] });
const signedAssignment = (assignment) => {
  const {
    version,
    workerId,
    bootId,
    planDigest,
    nodeId,
    nodeDigest,
    sourceDigest,
    policyDigest,
    grantNonce,
    digest: value,
  } = assignment;
  return {
    version,
    workerId,
    bootId,
    planDigest,
    nodeId,
    nodeDigest,
    sourceDigest,
    policyDigest,
    grantNonce,
    digest: value,
  };
};

export class DurableController {
  constructor({ statePath, cwd, sourceDigest, policyDigest, dependencyLockDigest, environmentDigest }) {
    if (!statePath || !cwd || !sourceDigest || !policyDigest || !dependencyLockDigest || !environmentDigest)
      throw new Error("CONTROLLER_IDENTITY_REQUIRED");
    this.statePath = path.resolve(statePath);
    this.cwd = path.resolve(cwd);
    this.identity = { sourceDigest, policyDigest, dependencyLockDigest, environmentDigest };
    this.state = initialState();
  }

  async load() {
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await this.persist();
    }
    if (this.state?.version !== 1 || !this.state.workers || !this.state.assignments || !this.state.evidence)
      throw new Error("CONTROLLER_STATE_INVALID");
    return this;
  }

  async persist() {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const temporary = `${this.statePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.statePath);
  }

  async register(input) {
    const worker = enrollWorker(input);
    const previous = this.state.workers[worker.workerId];
    if (previous && previous.bootId !== worker.bootId && ["RESERVED", "EXECUTING"].includes(previous.state))
      previous.state = "OFFLINE";
    this.state.workers[worker.workerId] = worker;
    await this.persist();
    return worker;
  }

  async heartbeat(workerId, sessionNonce, at) {
    const worker = this.requireWorker(workerId);
    this.state.workers[workerId] = heartbeatWorker(worker, { sessionNonce, at });
    await this.persist();
    return this.state.workers[workerId];
  }

  async drain(workerId, reason) {
    const worker = this.requireWorker(workerId);
    this.state.workers[workerId] = transitionWorker(worker, "DRAINING", reason);
    await this.persist();
    return this.state.workers[workerId];
  }

  async revoke(workerId, reason) {
    const worker = this.requireWorker(workerId);
    this.state.workers[workerId] = transitionWorker(worker, "REVOKED", reason);
    for (const assignment of Object.values(this.state.assignments))
      if (assignment.workerId === workerId && ["SEALED", "RUNNING"].includes(assignment.status))
        assignment.status = "REVOKED";
    await this.persist();
    return this.state.workers[workerId];
  }

  async seal({ workerId, node, adapterId }) {
    const worker = this.requireWorker(workerId);
    const adapter = resolveAdapter(adapterId);
    const plan = {
      sourceDigest: this.identity.sourceDigest,
      policyDigest: this.identity.policyDigest,
      digest: digest({
        sourceDigest: this.identity.sourceDigest,
        policyDigest: this.identity.policyDigest,
        node,
        adapterId,
      }),
    };
    const assignment = sealAssignment({ worker, plan, node });
    this.state.workers[workerId] = transitionWorker(worker, "RESERVED", `assignment:${assignment.digest}`);
    this.state.assignments[assignment.digest] = {
      ...assignment,
      adapterId: adapter.id,
      status: "SEALED",
      createdAt: new Date().toISOString(),
    };
    await this.persist();
    return this.state.assignments[assignment.digest];
  }

  async cancel(assignmentDigest, reason) {
    const assignment = this.requireAssignment(assignmentDigest);
    if (assignment.status !== "SEALED") throw new Error("ASSIGNMENT_CANNOT_CANCEL");
    assignment.status = "CANCELLED";
    const worker = this.requireWorker(assignment.workerId);
    if (worker.state === "RESERVED")
      this.state.workers[worker.workerId] = transitionWorker(worker, "AVAILABLE", reason);
    await this.persist();
    return assignment;
  }

  async execute(assignmentDigest) {
    const assignment = this.requireAssignment(assignmentDigest);
    if (assignment.status !== "SEALED") throw new Error("ASSIGNMENT_NOT_SEALED");
    const worker = this.requireWorker(assignment.workerId);
    verifyAssignment(signedAssignment(assignment), worker, new Set(this.state.usedNonces));
    this.state.usedNonces.push(assignment.grantNonce);
    assignment.status = "RUNNING";
    assignment.attemptId = randomUUID();
    this.state.workers[worker.workerId] = transitionWorker(worker, "EXECUTING", `attempt:${assignment.attemptId}`);
    await this.persist();

    const result = await executeAdapter(resolveAdapter(assignment.adapterId), { cwd: this.cwd });
    const currentWorker = this.requireWorker(worker.workerId);
    const evidence = createEvidenceManifest({
      sourceDigest: assignment.sourceDigest,
      policyDigest: assignment.policyDigest,
      planDigest: assignment.planDigest,
      nodeId: assignment.nodeId,
      attemptId: assignment.attemptId,
      workerId: currentWorker.workerId,
      workerBootId: currentWorker.bootId,
      environmentDigest: this.identity.environmentDigest,
      dependencyLockDigest: this.identity.dependencyLockDigest,
      executableDigest: currentWorker.executableDigest,
      artifacts: [{ id: "bounded-adapter-log", digest: digest(result.log) }],
      outcome: result.exitCode === 0 ? "PASS" : "FAIL",
      cleanup: "CLEAN",
      retentionClass: "LOCAL",
    });
    verifyEvidence(evidence, signedAssignment(assignment), currentWorker, new Set(Object.keys(this.state.evidence)));
    this.state.evidence[evidence.digest] = evidence;
    assignment.status = result.exitCode === 0 ? "COMPLETE" : "FAILED";
    assignment.evidenceDigest = evidence.digest;
    this.state.workers[currentWorker.workerId] = transitionWorker(
      currentWorker,
      "AVAILABLE",
      `attempt:${assignment.attemptId}`,
    );
    await this.persist();
    return { assignment: { ...assignment }, evidence, result: { exitCode: result.exitCode, signal: result.signal } };
  }

  async recover({ now = Date.now(), heartbeatAgeMs = 60_000 } = {}) {
    const recovered = [];
    for (const worker of Object.values(this.state.workers)) {
      const age = now - Date.parse(worker.lastHeartbeatAt);
      if (["RESERVED", "EXECUTING"].includes(worker.state) && (!Number.isFinite(age) || age > heartbeatAgeMs)) {
        worker.state = "OFFLINE";
        for (const assignment of Object.values(this.state.assignments))
          if (assignment.workerId === worker.workerId && assignment.status === "RUNNING") {
            assignment.status = "RECOVERY_REQUIRED";
            recovered.push(assignment.digest);
          }
      }
    }
    await this.persist();
    return recovered.sort();
  }

  snapshot() {
    return structuredClone(this.state);
  }

  requireWorker(workerId) {
    const worker = this.state.workers[workerId];
    if (!worker) throw new Error("WORKER_NOT_FOUND");
    return worker;
  }

  requireAssignment(assignmentDigest) {
    const assignment = this.state.assignments[assignmentDigest];
    if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    return assignment;
  }
}
