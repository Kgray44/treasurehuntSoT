import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCaptainWorkspace: vi.fn(),
  requireCaptainSession: vi.fn(),
  verifyWayfarerCsrf: vi.fn(),
  acknowledgeRelinquishedCaptaincy: vi.fn(),
  relinquishCaptaincy: vi.fn(),
}));

vi.mock("@/chronicle/captain-authorization", () => ({
  requireCaptainWorkspace: mocks.requireCaptainWorkspace,
  requireCaptainSession: mocks.requireCaptainSession,
}));
vi.mock("@/wayfarer/http", () => ({ verifyWayfarerCsrf: mocks.verifyWayfarerCsrf }));
vi.mock("@/helm/authority-lifecycle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helm/authority-lifecycle")>()),
  acknowledgeRelinquishedCaptaincy: mocks.acknowledgeRelinquishedCaptaincy,
  relinquishCaptaincy: mocks.relinquishCaptaincy,
}));

import { POST } from "./route";

const workspace = {
  accountId: "captain-account",
  account: { legacyGameMasterId: "captain-legacy" },
};
const context = { params: Promise.resolve({ playthroughId: "voyage-1" }) };

function relinquishRequest(body: unknown) {
  return new Request("https://example.test/api/captain/playthroughs/voyage-1/captain/relinquish", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "csrf-token" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/captain/playthroughs/[playthroughId]/captain/relinquish", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCaptainWorkspace.mockResolvedValue(workspace);
    mocks.verifyWayfarerCsrf.mockReturnValue(true);
    mocks.acknowledgeRelinquishedCaptaincy.mockResolvedValue(null);
  });

  it("returns only the authenticated Captain's exact committed relinquishment acknowledgement", async () => {
    const acknowledgement = {
      voyageId: "voyage-1",
      action: "CAPTAIN_RELINQUISHED",
      previousCaptainAccountId: "captain-account",
      nextCaptainAccountId: null,
      authorityState: "VACANT",
      sourceConcurrencyVersion: 7,
      sourceSequence: 21,
      correlationId: "receipt-correlation",
      committedAt: "2026-08-27T08:18:22.931Z",
      idempotent: true,
    };
    mocks.acknowledgeRelinquishedCaptaincy.mockResolvedValue(acknowledgement);

    const response = await POST(relinquishRequest({ expectedVersion: 7, idempotencyKey: "relinquish-key-1" }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(acknowledgement);
    expect(mocks.acknowledgeRelinquishedCaptaincy).toHaveBeenCalledWith(
      "voyage-1",
      { accountId: "captain-account", legacyGameMasterId: "captain-legacy" },
      { expectedVersion: 7, idempotencyKey: "relinquish-key-1" },
    );
    expect(mocks.requireCaptainSession).not.toHaveBeenCalled();
    expect(mocks.relinquishCaptaincy).not.toHaveBeenCalled();
  });

  it("does not read a receipt or mutate when the command payload is invalid", async () => {
    const response = await POST(relinquishRequest({ expectedVersion: -1, idempotencyKey: "relinquish-key-1" }), context);

    expect(response.status).toBe(400);
    expect(mocks.acknowledgeRelinquishedCaptaincy).not.toHaveBeenCalled();
    expect(mocks.requireCaptainSession).not.toHaveBeenCalled();
    expect(mocks.relinquishCaptaincy).not.toHaveBeenCalled();
  });

  it("fails closed when no exact acknowledgement exists and the caller no longer has current authority", async () => {
    mocks.requireCaptainSession.mockResolvedValue(null);

    const response = await POST(relinquishRequest({ expectedVersion: 7, idempotencyKey: "foreign-key-1" }), context);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "This Voyage is unavailable." });
    expect(mocks.relinquishCaptaincy).not.toHaveBeenCalled();
  });
});
