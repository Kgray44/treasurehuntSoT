import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  csrf: vi.fn(),
  projection: vi.fn(),
  action: vi.fn(),
}));

vi.mock("@/chronicle/captain-authorization", () => ({ requireCaptainSession: mocks.authorization }));
vi.mock("@/wayfarer/http", () => ({ verifyWayfarerCsrf: mocks.csrf }));
vi.mock("@/helm/operations", () => ({ getCaptainVoyageProjection: mocks.projection }));
vi.mock("@/chronicle/api", () => ({ apiError: (cause: unknown) => new Response(String(cause), { status: 400 }) }));
vi.mock("@/chronicle/progression", () => ({
  captainSessionAction: mocks.action,
  CaptainCommandConflictError: class CaptainCommandConflictError extends Error {
    constructor() {
      super("Voyage changed while this command was being prepared. Refresh current state before continuing.");
    }
  },
}));

import { CaptainCommandConflictError } from "@/chronicle/progression";
import { POST } from "./route";

const context = { params: Promise.resolve({ voyageId: "voyage-1" }) };
const authorization = {
  session: { accountId: "captain-account", csrfToken: "csrf" },
  actor: { accountId: "captain-account", legacyGameMasterId: null },
};
const command = {
  id: "PAUSE_VOYAGE",
  action: "pause",
  label: "Pause Voyage",
  description: "Pause",
  risk: "HIGH",
  reversible: true,
  playersSeeResult: true,
  consequence: "Paused",
  warning: null,
  requiresConfirmation: true,
  requiresReason: false,
  target: "NONE",
};
const projection = {
  voyage: { voyageName: "Synthetic Voyage" },
  progress: { currentSequence: 7 },
  commandConsole: { commands: [command], progressMap: [{ id: "block-current", state: "CURRENT" }] },
};

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/captain/voyages/voyage-1/commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const body = {
  commandId: "PAUSE_VOYAGE",
  expectedSequence: 7,
  idempotencyKey: "captain-command-key-123",
  confirmed: true,
};

describe("Helm Phase 3 Captain command route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue(authorization);
    mocks.csrf.mockReturnValue(true);
    mocks.projection.mockResolvedValue(projection);
    mocks.action.mockResolvedValue({ accepted: true });
  });

  it("denies an ordinary Player before loading the Captain projection", async () => {
    mocks.authorization.mockResolvedValue(null);
    expect((await POST(request(body), context)).status).toBe(403);
    expect(mocks.projection).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("rejects a command no longer available from the current authoritative projection", async () => {
    mocks.projection.mockResolvedValue({
      ...projection,
      commandConsole: { ...projection.commandConsole, commands: [] },
    });
    expect((await POST(request(body), context)).status).toBe(409);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("executes a confirmed contextual command with sequence and idempotency evidence", async () => {
    const response = await POST(request(body), context);
    expect(response.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith("voyage-1", "captain-account", {
      action: "pause",
      reason: undefined,
      targetBlockId: undefined,
      idempotencyKey: "captain-command-key-123",
      expectedSequence: 7,
    });
  });

  it("returns the Captain-safe stale state when a concurrent command wins", async () => {
    mocks.action.mockRejectedValue(new CaptainCommandConflictError());
    const response = await POST(request(body), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "STALE_SEQUENCE",
      error: expect.stringMatching(/Voyage changed/),
    });
  });
});
