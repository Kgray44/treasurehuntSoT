import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAssurance: vi.fn(),
  findCredential: vi.fn(),
  compare: vi.fn(),
  transaction: vi.fn(),
  updateAssurance: vi.fn(),
  createAssurance: vi.fn(),
  createAudit: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/db", () => ({
  db: {
    privilegedAssurance: { findFirst: mocks.findAssurance },
    accountCredential: { findUnique: mocks.findCredential },
    $transaction: mocks.transaction,
  },
}));

import {
  privilegedAssuranceState,
  reauthenticatePrivilegedOperator,
  requireRecentPrivilegedAssurance,
} from "./assurance";

const now = new Date("2026-08-09T12:00:00.000Z");
const operator = {
  accountId: "account-a",
  accountSessionId: "session-a",
  displayName: "Synthetic Operator",
  roles: ["ADMINISTRATOR"],
  capabilities: ["PLATFORM_OBSERVE"],
  csrfToken: "csrf",
  sessionExpiresAt: new Date(now.getTime() + 60 * 60_000),
  authorizationBasis: "ROLE_CAPABILITY:ADMINISTRATOR",
} as const;

describe("privileged assurance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (work) =>
      work({
        privilegedAssurance: { updateMany: mocks.updateAssurance, create: mocks.createAssurance },
        platformAuditEvent: { create: mocks.createAudit },
      }),
    );
    mocks.findCredential.mockResolvedValue({ passwordHash: "synthetic-hash" });
    mocks.compare.mockResolvedValue(true);
    mocks.createAssurance.mockResolvedValue({
      id: "assurance-new",
      assuranceLevel: "ADMIN_REAUTHENTICATED",
      method: "PASSWORD",
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60_000),
    });
    mocks.createAudit.mockResolvedValue({ id: "audit-a" });
  });

  it("accepts a fresh assurance tied to the exact account and session", async () => {
    mocks.findAssurance.mockResolvedValue({
      id: "assurance-a",
      method: "PASSWORD",
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    await expect(privilegedAssuranceState(operator as never, now)).resolves.toMatchObject({
      level: "ADMIN_REAUTHENTICATED",
      assuranceId: "assurance-a",
      recent: true,
    });
    expect(mocks.findAssurance).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "account-a", accountSessionId: "session-a" }),
      }),
    );
  });

  it("distinguishes expired assurance and requires a new reauthentication", async () => {
    mocks.findAssurance.mockResolvedValue({
      id: "assurance-a",
      method: "PASSWORD",
      issuedAt: now,
      expiresAt: new Date(now.getTime() - 1),
    });
    await expect(privilegedAssuranceState(operator as never, now)).resolves.toMatchObject({
      level: "ADMIN_BASE",
      recent: false,
    });
    await expect(requireRecentPrivilegedAssurance(operator as never, now)).rejects.toMatchObject({
      code: "ADMIRALTY_ASSURANCE_EXPIRED",
    });
  });

  it("does not replay assurance from a different session", async () => {
    mocks.findAssurance.mockResolvedValue(null);
    await expect(
      privilegedAssuranceState({ ...operator, accountSessionId: "session-b" } as never, now),
    ).resolves.toMatchObject({ level: "ADMIN_BASE", recent: false });
    expect(mocks.findAssurance).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountSessionId: "session-b" }) }),
    );
  });

  it("rejects a failed password without creating assurance", async () => {
    mocks.compare.mockResolvedValue(false);
    await expect(reauthenticatePrivilegedOperator(operator as never, "wrong", now)).rejects.toMatchObject({
      code: "ADMIRALTY_REAUTH_FAILED",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("writes assurance and audit in one transaction and fails closed if audit fails", async () => {
    mocks.createAudit.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(reauthenticatePrivilegedOperator(operator as never, "correct", now)).rejects.toThrow(
      "audit unavailable",
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createAssurance).toHaveBeenCalledTimes(1);
    expect(mocks.createAudit).toHaveBeenCalledTimes(1);
  });
});
