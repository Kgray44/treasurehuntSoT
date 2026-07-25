import { describe, expect, it } from "vitest";
import { privateOperationalJobTypes, createPrivateOperationalHandlerRegistry } from "@/private-content/worker-handlers";
import { PrivateOperationalMetrics, DeterministicPrivateAlertSink } from "@/private-content/observability";

const runtime = {} as never;
const job = {
  id: "job",
  type: "PRIVATE_BACKUP_BUILD",
  payload: JSON.stringify({ schemaVersion: 1, aggregateId: "a", correlationId: "c" }),
  operationId: "op",
  correlationId: "c",
} as const;
describe("Phase 3 worker handlers and observability", () => {
  it("registers every declared operation and fails closed when a handler is not composed", async () => {
    const metrics = new PrivateOperationalMetrics();
    const alerts = new DeterministicPrivateAlertSink();
    const handlers = createPrivateOperationalHandlerRegistry({ runtime, metrics, alerts });
    expect(Object.keys(handlers).sort()).toEqual([...privateOperationalJobTypes].sort());
    await expect(handlers.PRIVATE_BACKUP_BUILD!(job, new AbortController().signal)).rejects.toMatchObject({
      code: "PRIVATE_CONTENT_CONFIGURATION_INVALID",
    });
    expect(alerts.alerts[0]).toMatchObject({ code: "PRIVATE_HANDLER_NOT_COMPOSED" });
  });
  it("executes an explicitly composed handler and strips unsafe metric labels", async () => {
    const metrics = new PrivateOperationalMetrics();
    const handlers = createPrivateOperationalHandlerRegistry({
      runtime,
      metrics,
      execute: { PRIVATE_BACKUP_BUILD: async () => undefined },
    });
    await expect(handlers.PRIVATE_BACKUP_BUILD!(job, new AbortController().signal)).resolves.toBeUndefined();
    expect(metrics.snapshot()).toContainEqual({
      name: "private_worker_completed_total",
      value: 1,
      labels: { job_type: "PRIVATE_BACKUP_BUILD" },
    });
  });
});
