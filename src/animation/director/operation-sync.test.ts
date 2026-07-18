import { describe, expect, it } from "vitest";
import { OperationSynchronizer } from "./operation-sync";

describe("OperationSynchronizer", () => {
  it("holds at the safe synchronization point while the server is pending", () => {
    const sync = new OperationSynchronizer();
    sync.finishOpening();
    expect(sync.snapshot).toMatchObject({ state: "await-server", operation: "pending" });
    expect(() => sync.beginBranch()).toThrow(/No truthful branch/);
  });

  it("continues through the truthful success branch", () => {
    const sync = new OperationSynchronizer();
    sync.finishOpening();
    sync.settleSuccess();
    expect(sync.beginBranch()).toBe("success");
    sync.finish();
    expect(sync.snapshot.state).toBe("complete");
  });

  it("selects failure when the operation rejects before opening completes", () => {
    const sync = new OperationSynchronizer();
    sync.settleFailure();
    sync.finishOpening();
    expect(sync.beginBranch()).toBe("failure");
  });

  it("lets skip finish presentation but never changes pending authority", () => {
    const sync = new OperationSynchronizer();
    sync.requestSkip();
    expect(sync.snapshot).toEqual({ state: "await-server", operation: "pending", skipRequested: true });
    expect(() => sync.beginBranch()).toThrow();
  });

  it("prevents a cancelled controller from accepting a late result", () => {
    const sync = new OperationSynchronizer();
    sync.cancel();
    sync.settleSuccess();
    expect(sync.snapshot.state).toBe("cancelled");
  });
});
