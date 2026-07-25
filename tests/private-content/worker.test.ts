import { beforeEach, describe, expect, it, vi } from "vitest";

const operations = vi.hoisted(() => ({
  claimPrivateJobs: vi.fn(),
  finishPrivateJob: vi.fn(),
  retryPrivateJob: vi.fn(),
  renewPrivateJobLease: vi.fn(),
  cancelClaimedPrivateJob: vi.fn(),
}));

vi.mock("@/private-content/operations", () => operations);

import { dispatchPrivateJobBatch } from "@/private-content/worker";

const job = {
  id: "job-1",
  type: "PRIVATE_ASSET_SCAN",
  payload: '{"schemaVersion":1}',
  operationId: "operation-1",
  correlationId: "correlation-1",
};

describe("private durable worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operations.claimPrivateJobs.mockResolvedValue([job]);
    operations.finishPrivateJob.mockResolvedValue({ count: 1 });
    operations.renewPrivateJobLease.mockResolvedValue({ count: 1 });
    operations.cancelClaimedPrivateJob.mockResolvedValue({ count: 1 });
    operations.retryPrivateJob.mockResolvedValue(true);
  });

  it("routes only typed registered jobs and records completion", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await expect(dispatchPrivateJobBatch("worker", { PRIVATE_ASSET_SCAN: handler })).resolves.toEqual({
      claimed: 1,
      processed: 1,
      cancelled: 0,
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PRIVATE_ASSET_SCAN" }),
      expect.any(AbortSignal),
    );
    expect(operations.finishPrivateJob).toHaveBeenCalledWith("job-1", "worker");
  });

  it("retries an unregistered type without executing arbitrary work", async () => {
    operations.claimPrivateJobs.mockResolvedValue([{ ...job, type: "PRIVATE_STAGING_CLEANUP" }]);
    await expect(dispatchPrivateJobBatch("worker", {})).resolves.toMatchObject({ processed: 0 });
    expect(operations.retryPrivateJob).toHaveBeenCalledWith("job-1", "worker", "HANDLER_NOT_CONFIGURED");
  });

  it("cancels claimed work on graceful shutdown before handler execution", async () => {
    const controller = new AbortController();
    controller.abort();
    const handler = vi.fn();
    await expect(
      dispatchPrivateJobBatch("worker", { PRIVATE_ASSET_SCAN: handler }, { signal: controller.signal }),
    ).resolves.toMatchObject({
      cancelled: 1,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(operations.cancelClaimedPrivateJob).toHaveBeenCalledWith("job-1", "worker");
  });

  it("aborts the active cooperative handler when its durable lease is lost", async () => {
    operations.renewPrivateJobLease.mockResolvedValue({ count: 0 });
    const handler = vi.fn(
      (_job: unknown, signal: AbortSignal) =>
        new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true })),
    );
    const result = dispatchPrivateJobBatch("worker", { PRIVATE_ASSET_SCAN: handler }, { leaseMs: 1_000 });
    await new Promise((resolve) => setTimeout(resolve, 1_050));
    await expect(result).resolves.toMatchObject({ cancelled: 1, processed: 0 });
    expect(operations.finishPrivateJob).not.toHaveBeenCalled();
    expect(operations.cancelClaimedPrivateJob).toHaveBeenCalledWith("job-1", "worker");
  }, 3_000);
});
