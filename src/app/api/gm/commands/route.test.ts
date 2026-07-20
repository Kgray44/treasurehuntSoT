import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireGm: vi.fn(),
  requireGmCapability: vi.fn(),
  verifyCsrf: vi.fn(),
  executeAdminCommand: vi.fn(),
  logError: vi.fn(),
  CommandConflict: class CommandConflict extends Error {
    constructor(
      message: string,
      public code = "COMMAND_CONFLICT",
    ) {
      super(message);
    }
  },
  CommandFailure: class CommandFailure extends Error {
    constructor(public correlationId: string) {
      super("The Voyage action could not be completed. No progress has changed.");
    }
  },
}));

vi.mock("@/lib/security", () => ({
  requireGm: dependencies.requireGm,
  requireGmCapability: dependencies.requireGmCapability,
  verifyCsrf: dependencies.verifyCsrf,
}));

vi.mock("@/server/admin-command", () => ({
  CommandConflict: dependencies.CommandConflict,
  CommandFailure: dependencies.CommandFailure,
  executeAdminCommand: dependencies.executeAdminCommand,
}));

vi.mock("@/lib/logger", () => ({ logger: { error: dependencies.logError } }));

import { CommandConflict } from "@/server/admin-command";
import { POST } from "./route";

const validCommand = {
  command: "REVEAL_ROUTE",
  campaignSlug: "test-voyage",
  expectedSequence: 4,
  idempotencyKey: "quartermaster-123456",
  payload: {},
  confirmation: true,
};

function request(body: unknown) {
  return new Request("http://localhost/api/gm/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": "csrf" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/gm/commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireGm.mockResolvedValue(null);
    dependencies.requireGmCapability.mockResolvedValue({ userId: "gm-1" });
    dependencies.verifyCsrf.mockResolvedValue(true);
  });

  it("preserves authentication and CSRF boundaries", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce(null);
    const unauthenticated = await POST(request(validCommand));
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ code: "UNAUTHENTICATED", correlationId: expect.any(String) });
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();

    dependencies.requireGmCapability.mockResolvedValueOnce({ userId: "gm-1" });
    dependencies.verifyCsrf.mockResolvedValueOnce(false);
    const forbidden = await POST(request(validCommand));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ code: "CSRF", correlationId: expect.any(String) });
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated staff without captain authority", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce({ userId: "creator-1", user: { role: "CREATOR" } });

    const response = await POST(request(validCommand));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Captain access is required to continue.",
      code: "FORBIDDEN",
      correlationId: expect.any(String),
    });
    expect(dependencies.verifyCsrf).not.toHaveBeenCalled();
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });

  it("requires sequence, idempotency, and explicit confirmation before execution", async () => {
    const response = await POST(request({ ...validCommand, expectedSequence: undefined, idempotencyKey: undefined }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION", correlationId: expect.any(String) });
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });

  it("passes the validated command to the hardened executor and returns its truthful receipt", async () => {
    const receipt = {
      kind: "PROGRESSION_EVENT",
      event: { id: "event-1", type: "MAP_ROUTE_REVEALED", sequence: 5 },
      playerEvent: { id: "event-1", type: "MAP_ROUTE_REVEALED", sequence: 5 },
      correlationId: "correlation-1",
      persistence: "COMMITTED",
      publication: "PROCESS_PUBLISHED",
      delivery: "PUBLISHED",
      deliveryScope: "PROCESS_SUBSCRIBERS_ONLY",
      playerDelivery: "UNCONFIRMED",
      playerPresentation: "UNCONFIRMED",
      playerAcknowledgment: "UNCONFIRMED",
    };
    dependencies.executeAdminCommand.mockResolvedValue(receipt);

    const response = await POST(request(validCommand));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(receipt);
    expect(dependencies.executeAdminCommand).toHaveBeenCalledWith(validCommand, "gm-1", {
      correlationId: expect.any(String),
    });
  });

  it("keeps stale conflicts typed and does not report a commit", async () => {
    dependencies.executeAdminCommand.mockRejectedValue(
      new CommandConflict("State changed. Refresh before confirming.", "STALE_SEQUENCE"),
    );

    const response = await POST(request(validCommand));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "State changed. Refresh before confirming.",
      code: "STALE_SEQUENCE",
      correlationId: expect.any(String),
    });
  });

  it("redacts unexpected failures while returning their stable correlation", async () => {
    dependencies.executeAdminCommand.mockRejectedValue(new dependencies.CommandFailure("correlation-safe-reference"));

    const response = await POST(request(validCommand));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The Voyage action could not be completed. No progress has changed. Check the current Voyage status, then try again.",
      code: "COMMAND_FAILED",
      correlationId: "correlation-safe-reference",
    });
  });

  it("redacts a raw unexpected failure using the correlation allocated before execution", async () => {
    dependencies.executeAdminCommand.mockRejectedValue(new Error("database password must never escape"));

    const response = await POST(request(validCommand));
    const body = await response.json();
    const executionContext = dependencies.executeAdminCommand.mock.calls[0][2] as { correlationId: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "The Voyage action could not be completed. No progress has changed. Check the current Voyage status, then try again.",
      code: "COMMAND_FAILED",
      correlationId: executionContext.correlationId,
    });
    expect(JSON.stringify(body)).not.toContain("database password");
  });

  it.each([
    [
      "capability helper",
      () =>
        dependencies.requireGmCapability.mockRejectedValueOnce(
          new dependencies.CommandConflict("capability secret must not escape", "STALE_SEQUENCE"),
        ),
    ],
    [
      "authentication helper",
      () => {
        dependencies.requireGmCapability.mockResolvedValueOnce(null);
        dependencies.requireGm.mockRejectedValueOnce(new Error("authentication secret must not escape"));
      },
    ],
    ["CSRF helper", () => dependencies.verifyCsrf.mockRejectedValueOnce(new Error("csrf secret must not escape"))],
  ])("redacts a thrown %s failure with the same early correlation", async (_label, arrange) => {
    arrange();

    const response = await POST(request(validCommand));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "The Voyage action could not be completed. No progress has changed. Check the current Voyage status, then try again.",
      code: "COMMAND_FAILED",
      correlationId: expect.any(String),
    });
    expect(dependencies.logError).toHaveBeenCalledWith(
      { area: "gm-commands", correlationId: body.correlationId },
      "GM command request failed",
    );
    expect(JSON.stringify(body)).not.toMatch(/capability secret|authentication secret|csrf secret/u);
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });
});
