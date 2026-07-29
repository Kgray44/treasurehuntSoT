/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma durable-repair seam is mocked structurally. */
import { describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const state = {
    plan: {} as any,
    actions: [] as any[],
    leaseOwned: true,
    failReceiptOnce: false,
  };
  const privateRepairPlan = {
    updateMany: vi.fn(async ({ where, data }: any) => {
      const plan = state.plan;
      const owns = state.leaseOwned && (!where.executionLease || plan.executionLease === where.executionLease);
      const stateEligible = where.OR
        ? where.OR.some((candidate: any) => {
            if (candidate.state !== plan.state) return false;
            if (!candidate.executionUntil && !candidate.OR) return true;
            if (candidate.executionUntil?.lt) return plan.executionUntil < candidate.executionUntil.lt;
            return candidate.OR.some((leaseCandidate: any) =>
              leaseCandidate.executionUntil === null
                ? plan.executionUntil === null
                : plan.executionUntil < leaseCandidate.executionUntil.lt,
            );
          })
        : !where.state || plan.state === where.state;
      const eligible =
        plan.digest === where.digest &&
        stateEligible &&
        (!where.dryRun || plan.dryRun === where.dryRun) &&
        (!where.snapshotDigest || plan.snapshotDigest === where.snapshotDigest) &&
        owns;
      if (!eligible) return { count: 0 };
      Object.assign(plan, data);
      return { count: 1 };
    }),
    findUniqueOrThrow: vi.fn(async () => ({ ...state.plan, actions: state.actions })),
    findUnique: vi.fn(async () => ({ ...state.plan, actions: state.actions })),
    count: vi.fn(async ({ where }: any) =>
      state.leaseOwned &&
      state.plan.digest === where.digest &&
      state.plan.state === where.state &&
      state.plan.executionLease === where.executionLease
        ? 1
        : 0,
    ),
  };
  const privateRepairAction = {
    updateMany: vi.fn(async ({ where, data }: any) => {
      if (where.planId) {
        let count = 0;
        for (const action of state.actions)
          if (action.planId === where.planId && action.state === where.state) {
            Object.assign(action, data);
            count += 1;
          }
        return { count };
      }
      const action = state.actions.find((item) => item.id === where.id && item.state === where.state);
      if (!action) return { count: 0 };
      if (where.state === "EXECUTING" && state.failReceiptOnce) {
        state.failReceiptOnce = false;
        throw new Error("synthetic receipt interruption");
      }
      Object.assign(action, data);
      return { count: 1 };
    }),
    findMany: vi.fn(async () => [...state.actions].sort((left, right) => left.ordinal - right.ordinal)),
    findUnique: vi.fn(async ({ where }: any) => state.actions.find((item) => item.id === where.id) ?? null),
  };
  return {
    state,
    db: {
      privateRepairPlan,
      privateRepairAction,
      privateAssetObject: { findFirst: vi.fn() },
      privateAssetReference: { updateMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: fixture.db }));
vi.mock("@/platform/audit", () => ({ writePlatformAudit: vi.fn().mockResolvedValue(undefined) }));

import { executePrivateRepairPlan } from "@/private-content/repair-service";

function reset(actions: Array<{ action?: string; reason?: string; state?: string }> = []) {
  fixture.state.leaseOwned = true;
  fixture.state.failReceiptOnce = false;
  fixture.state.plan = {
    id: "plan-1",
    digest: "d".repeat(64),
    snapshotDigest: "s".repeat(64),
    state: "APPROVED",
    dryRun: false,
    expiresAt: new Date("2030-01-01"),
    executionLease: null,
    executionUntil: null,
  };
  fixture.state.actions = actions.map((input, ordinal) => ({
    id: `action-${ordinal + 1}`,
    planId: "plan-1",
    ordinal,
    action: input.action ?? "REVIEW",
    reason: input.reason ?? "MISSING_OBJECT",
    opaqueTarget: `synthetic-target-${ordinal + 1}`,
    preconditionDigest: "p".repeat(64),
    state: input.state ?? "PENDING",
    resultCode: null,
  }));
}

const invocation = (apply: (action: any) => Promise<void>) =>
  executePrivateRepairPlan({
    digest: "d".repeat(64),
    currentSnapshotDigest: "s".repeat(64),
    owner: "synthetic-worker",
    now: new Date("2029-01-01"),
    apply,
  });

describe("durable Phase 3 repair execution", () => {
  it("preserves completed receipts and safely retries an interrupted idempotent provider mutation", async () => {
    reset([{ state: "COMPLETED" }, {}, {}]);
    fixture.state.failReceiptOnce = true;
    const providerEffects = new Set<string>();
    const apply = vi.fn(async (action) => {
      providerEffects.add(action.opaqueTarget);
    });

    await expect(invocation(apply)).rejects.toThrow("synthetic receipt interruption");
    expect(fixture.state.actions[0].state).toBe("COMPLETED");
    expect(fixture.state.actions[1].state).toBe("EXECUTING");
    await expect(invocation(apply)).resolves.toMatchObject({ state: "COMPLETED", actions: 3 });

    expect(providerEffects).toEqual(new Set(["synthetic-target-2", "synthetic-target-3"]));
    expect(apply.mock.calls.map(([action]) => action.opaqueTarget)).toEqual([
      "synthetic-target-2",
      "synthetic-target-2",
      "synthetic-target-3",
    ]);
    expect(fixture.state.actions.map((action) => action.state)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);
  });

  it("stops before a second action when its lease is lost and rejects stale or blocked plans", async () => {
    reset([{}, {}]);
    const apply = vi.fn(async () => {
      fixture.state.leaseOwned = false;
    });
    await expect(invocation(apply)).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(fixture.state.actions[1].state).toBe("PENDING");
    // A worker that lost its lease must not overwrite the reclaimable
    // EXECUTING state; the replacement owner performs the expiry recovery.
    expect(fixture.state.plan.state).toBe("EXECUTING");

    reset([{ action: "DELETE_AFTER_GRACE", reason: "MISSING_OBJECT" }]);
    await expect(invocation(vi.fn())).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });

    reset([{}]);
    fixture.state.plan.snapshotDigest = "x".repeat(64);
    await expect(invocation(vi.fn())).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
  });

  it("reclaims only an expired crashed worker and repeats just its unreceipted action", async () => {
    reset([{ state: "COMPLETED" }, { state: "EXECUTING" }, {}]);
    fixture.state.plan.state = "EXECUTING";
    fixture.state.plan.executionLease = "dead-worker";
    fixture.state.plan.executionUntil = new Date("2028-12-31");
    const apply = vi.fn(async () => undefined);

    await expect(invocation(apply)).resolves.toMatchObject({ state: "COMPLETED", actions: 3 });
    expect((apply.mock.calls as unknown as Array<[any]>).map(([action]) => action.id)).toEqual([
      "action-2",
      "action-3",
    ]);
    expect(fixture.state.actions.map((action) => action.state)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);

    reset([{ state: "EXECUTING" }]);
    fixture.state.plan.state = "EXECUTING";
    fixture.state.plan.executionLease = "live-worker";
    fixture.state.plan.executionUntil = new Date("2030-01-01");
    await expect(invocation(vi.fn())).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
  });

  it("leaves a provider failure durably retryable without replaying completed actions", async () => {
    reset([{ state: "COMPLETED" }, {}, {}]);
    const apply = vi.fn(async (action) => {
      if (action.id === "action-2") throw new Error("synthetic provider interruption");
    });
    await expect(invocation(apply)).rejects.toThrow("synthetic provider interruption");
    expect(fixture.state.plan.state).toBe("APPROVED");
    expect(fixture.state.actions.map((action) => action.state)).toEqual(["COMPLETED", "EXECUTING", "PENDING"]);

    const recovered = vi.fn(async () => undefined);
    await expect(invocation(recovered)).resolves.toMatchObject({ state: "COMPLETED" });
    expect((recovered.mock.calls as unknown as Array<[any]>).map(([action]) => action.id)).toEqual([
      "action-2",
      "action-3",
    ]);
  });
});
