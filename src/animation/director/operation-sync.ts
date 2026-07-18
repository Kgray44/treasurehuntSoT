export type OperationSyncState =
  | "opening"
  | "await-server"
  | "success-ready"
  | "failure-ready"
  | "success"
  | "failure"
  | "cancelled"
  | "complete";

export class OperationSynchronizer {
  private state: OperationSyncState = "opening";
  private operation: "pending" | "success" | "failure" = "pending";
  private skipRequested = false;

  get snapshot() {
    return { state: this.state, operation: this.operation, skipRequested: this.skipRequested } as const;
  }

  requestSkip() {
    this.skipRequested = true;
    if (this.state === "opening") this.state = "await-server";
  }

  finishOpening() {
    if (this.state === "cancelled") return;
    if (this.operation === "success") this.state = "success-ready";
    else if (this.operation === "failure") this.state = "failure-ready";
    else this.state = "await-server";
  }

  settleSuccess() {
    if (this.state === "cancelled") return;
    this.operation = "success";
    if (this.state === "await-server") this.state = "success-ready";
  }

  settleFailure() {
    if (this.state === "cancelled") return;
    this.operation = "failure";
    if (this.state === "await-server") this.state = "failure-ready";
  }

  beginBranch() {
    if (this.state === "success-ready") this.state = "success";
    else if (this.state === "failure-ready") this.state = "failure";
    else throw new Error(`No truthful branch is ready from ${this.state}.`);
    return this.state;
  }

  finish() {
    if (!["success", "failure"].includes(this.state)) throw new Error("Cannot complete before a truthful branch runs.");
    this.state = "complete";
  }

  cancel() {
    this.state = "cancelled";
  }
}
