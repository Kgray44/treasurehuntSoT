// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { aiQuotaOverrides } from "./ai-quota-projections";

it("paginates current exception records, retains expiry/reason, and omits reset policies and private request data", async () => {
  const policy = {
    monthlyRequests: 50,
    monthlySpendNano: null,
    advancedEnabled: null,
    requestsPerMinute: null,
    suspended: false,
    expiresAt: "2026-10-01T00:00:00Z",
    roomModel: "gpt-6-luna",
  };
  const rows = Array.from({ length: 51 }, (_, index) => ({
    accountId: `synthetic-${String(index).padStart(3, "0")}`,
    policy: JSON.stringify(policy),
    revision: 2,
    updatedAt: new Date("2026-09-30"),
  }));
  const findMany = vi.fn(async () => rows);
  const store = {
    aIQuotaUserPolicy: { findMany, count: vi.fn(async () => 70) },
    userAccount: { findUnique: vi.fn(async () => ({ profile: { displayName: "Synthetic Creator" } })) },
    aIQuotaPolicyRevision: { findFirst: vi.fn(async () => ({ reason: "Temporary evaluation allowance" })) },
  } as unknown as PrismaClient;
  const result = await aiQuotaOverrides("synthetic-before", store, new Date("2026-10-14"));
  expect(result.items).toHaveLength(50);
  expect(result.total).toBe(70);
  expect(result.nextCursor).toBe("synthetic-049");
  expect(result.items[0]).toMatchObject({
    expired: true,
    reason: "Temporary evaluation allowance",
    fields: expect.arrayContaining(["monthlyRequests", "roomModel"]),
  });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { policy: { not: "null" }, accountId: { gt: "synthetic-before" } }, take: 51 }),
  );
  expect(JSON.stringify(result)).not.toMatch(/fingerprint|prompt|OPENAI_API_KEY|providerResponse|sceneDigest/);
  expect(store.aIQuotaPolicyRevision.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { targetAccountId: "synthetic-000", resultingRevision: 2 } }),
  );
});
