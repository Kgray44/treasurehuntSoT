import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  csrf: vi.fn(),
  configuration: vi.fn(),
  runtime: vi.fn(),
  health: vi.fn(),
  backupRuns: vi.fn(),
  repairs: vi.fn(),
  drills: vi.fn(),
}));
vi.mock("@/lib/security", () => ({ requireGmCapability: mocks.session, verifyCsrf: mocks.csrf }));
vi.mock("@/private-content/config", () => ({ parsePrivateContentConfiguration: mocks.configuration }));
vi.mock("@/private-content/providers", () => ({
  createPrivateProviderRuntime: mocks.runtime,
  collectPrivateProviderHealth: mocks.health,
}));
vi.mock("@/lib/db", () => ({
  db: {
    privateBackupRun: { findMany: mocks.backupRuns },
    privateRepairPlan: { findMany: mocks.repairs },
    privateRestoreDrill: { findMany: mocks.drills },
  },
}));

import { GET, POST } from "./route";

describe("private operational status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ csrfToken: "csrf" });
    mocks.csrf.mockResolvedValue(true);
    mocks.configuration.mockReturnValue({});
    mocks.runtime.mockReturnValue({});
    mocks.health.mockResolvedValue([{ kind: "STORAGE", configurationState: "HEALTHY", safeCode: "LOCAL" }]);
    mocks.backupRuns.mockResolvedValue([
      { backupId: "private-backup-id", state: "VERIFIED", verifiedAt: null, createdAt: new Date() },
    ]);
    mocks.repairs.mockResolvedValue([
      {
        digest: "a".repeat(64),
        state: "DRAFT",
        dryRun: true,
        expiresAt: new Date(),
        createdAt: new Date(),
        _count: { actions: 1 },
      },
    ]);
    mocks.drills.mockResolvedValue([
      { targetIdentity: "C:/private/root", state: "VERIFIED", resultCode: null, createdAt: new Date() },
    ]);
  });

  it("denies unauthenticated access without querying operational state", async () => {
    mocks.session.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.backupRuns).not.toHaveBeenCalled();
  });

  it("returns only sanitized operational identifiers to an Administrator", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("private-backup-id");
    expect(JSON.stringify(body)).not.toContain("C:/private/root");
    expect(body.backupRuns[0].backupId).toMatch(/^backup-[a-f0-9]{16}$/);
    expect(body.drills[0].targetIdentity).toMatch(/^restore-[a-f0-9]{16}$/);
  });

  it("requires a valid CSRF token for mutations", async () => {
    mocks.csrf.mockResolvedValueOnce(false);
    const response = await POST(
      new Request("http://local/operations", { method: "POST", body: JSON.stringify({ action: "provider-check" }) }),
    );
    expect(response.status).toBe(403);
    expect(mocks.health).not.toHaveBeenCalled();
  });

  it("keeps invalid, unavailable, and repeated readiness checks non-mutating and sanitized", async () => {
    const invalid = await POST(
      new Request("http://local/operations", { method: "POST", body: JSON.stringify({ action: "repair-now" }) }),
    );
    expect(invalid.status).toBe(400);
    expect(mocks.health).not.toHaveBeenCalled();

    mocks.health.mockRejectedValueOnce(new Error("https://private.example/internal-root"));
    const unavailable = await POST(
      new Request("http://local/operations", { method: "POST", body: JSON.stringify({ action: "provider-check" }) }),
    );
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(await unavailable.json())).not.toContain("private.example");

    const first = await POST(
      new Request("http://local/operations", { method: "POST", body: JSON.stringify({ action: "provider-check" }) }),
    );
    const second = await POST(
      new Request("http://local/operations", { method: "POST", body: JSON.stringify({ action: "provider-check" }) }),
    );
    expect(first.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    // This route exposes a read-only readiness probe: repeated POSTs create no
    // receipt or durable operation, so an idempotency key is intentionally not accepted.
    expect(mocks.backupRuns).not.toHaveBeenCalled();
  });

  it("does not disclose configuration failures through GET", async () => {
    mocks.configuration.mockImplementationOnce(() => {
      throw new Error("C:/private/root");
    });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("C:/private/root");
  });
});
