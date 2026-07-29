import { describe, expect, it, vi } from "vitest";
import { createLocalPrivateOperationExecutors } from "@/private-content/worker-composition";
import { privateOperationalJobTypes } from "@/private-content/worker-handlers";

const storage = {
  name: "local-test",
  health: vi.fn().mockResolvedValue({ configured: true, healthy: true }),
  put: vi.fn().mockResolvedValue({ key: "normalized/receipt", sha256: "a".repeat(64), byteLength: 1 }),
};
const scanner = { name: "synthetic", health: vi.fn().mockResolvedValue({ configured: true, healthy: true }) };
const runtime = {
  storage,
  scanner,
  keyProvider: { name: "local", health: vi.fn().mockResolvedValue({ configured: true, healthy: true }) },
  configuration: {
    DATABASE_URL: "file:phase3-test.db",
    PRIVATE_CONTENT_WORKER_ENABLED: true,
    PRIVATE_CONTENT_REQUIRE_READY: true,
  },
} as never;

function job(type: (typeof privateOperationalJobTypes)[number]) {
  return {
    id: `job-${type.toLowerCase()}`,
    type,
    operationId: "operation-1",
    correlationId: "correlation-1",
    payload: JSON.stringify({ schemaVersion: 1, aggregateId: "synthetic-aggregate", correlationId: "correlation-1" }),
  } as const;
}

describe("local Phase 3 worker composition", () => {
  it("persists an immutable sanitized receipt for every registered operation", async () => {
    const executors = createLocalPrivateOperationExecutors({ runtime });
    await Promise.all(
      privateOperationalJobTypes.map((type) => executors[type](type, job(type), new AbortController().signal)),
    );
    expect(storage.put).toHaveBeenCalledTimes(privateOperationalJobTypes.length);
    for (const type of privateOperationalJobTypes)
      expect(storage.put).toHaveBeenCalledWith(
        "normalized",
        expect.stringContaining(type.toLowerCase()),
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
  });

  it("does not issue a provider mutation after cancellation or unavailable scanning", async () => {
    const executors = createLocalPrivateOperationExecutors({ runtime });
    const controller = new AbortController();
    controller.abort();
    await expect(
      executors.PRIVATE_BACKUP_BUILD("PRIVATE_BACKUP_BUILD", job("PRIVATE_BACKUP_BUILD"), controller.signal),
    ).rejects.toMatchObject({
      code: "PRIVATE_CONTENT_FORBIDDEN",
    });
    scanner.health.mockResolvedValueOnce({ configured: false, healthy: false });
    await expect(
      executors.PRIVATE_ASSET_SCAN("PRIVATE_ASSET_SCAN", job("PRIVATE_ASSET_SCAN"), new AbortController().signal),
    ).rejects.toMatchObject({
      code: "PRIVATE_CONTENT_CONFIGURATION_INVALID",
    });
  });
});
