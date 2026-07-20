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

import { POST } from "./route";

const validAction = {
  action: "AWARD_ARTIFACT",
  campaignSlug: "test-voyage",
  expectedSequence: 9,
  idempotencyKey: "quartermaster-abcdef",
  payload: {},
  confirmation: true,
};

function request(body: unknown) {
  return new Request("http://localhost/api/gm/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": "csrf" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/gm/action compatibility bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireGm.mockResolvedValue(null);
    dependencies.requireGmCapability.mockResolvedValue({ userId: "gm-1" });
    dependencies.verifyCsrf.mockResolvedValue(true);
  });

  it("correlates unauthenticated and CSRF failures before execution", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce(null);
    const unauthenticated = await POST(request(validAction));
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({
      code: "UNAUTHENTICATED",
      correlationId: expect.any(String),
    });

    dependencies.requireGmCapability.mockResolvedValueOnce({ userId: "gm-1" });
    dependencies.verifyCsrf.mockResolvedValueOnce(false);
    const csrf = await POST(request(validAction));
    expect(csrf.status).toBe(403);
    expect(await csrf.json()).toMatchObject({ code: "CSRF", correlationId: expect.any(String) });
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });

  it("refuses an authenticated creator without captain authority", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce({ userId: "creator-1", user: { role: "CREATOR" } });

    const response = await POST(request(validAction));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });

  it("rejects the former weak action shape", async () => {
    const response = await POST(request({ action: "AWARD_ARTIFACT", campaignSlug: "test-voyage", confirmation: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION", correlationId: expect.any(String) });
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });

  it("maps a fully evidenced action onto the canonical command executor", async () => {
    dependencies.executeAdminCommand.mockResolvedValue({
      kind: "PROGRESSION_EVENT",
      event: { id: "event-9", type: "ARTIFACT_AWARDED", sequence: 10 },
      playerEvent: { id: "event-9", type: "ARTIFACT_AWARDED", sequence: 10 },
      correlationId: "correlation-9",
      persistence: "COMMITTED",
      publication: "PROCESS_PUBLISHED",
      delivery: "PUBLISHED",
      deliveryScope: "PROCESS_SUBSCRIBERS_ONLY",
      playerDelivery: "UNCONFIRMED",
      playerPresentation: "UNCONFIRMED",
      playerAcknowledgment: "UNCONFIRMED",
    });

    const response = await POST(request(validAction));

    expect(response.status).toBe(200);
    expect(dependencies.executeAdminCommand).toHaveBeenCalledWith(
      {
        command: "AWARD_ARTIFACT",
        campaignSlug: "test-voyage",
        expectedSequence: 9,
        idempotencyKey: "quartermaster-abcdef",
        payload: {},
        confirmation: true,
      },
      "gm-1",
      { correlationId: expect.any(String) },
    );
  });

  it("keeps compatibility-route conflicts typed and correlated", async () => {
    dependencies.executeAdminCommand.mockRejectedValue(
      new dependencies.CommandConflict("State changed. Refresh before confirming.", "STALE_SEQUENCE"),
    );

    const response = await POST(request(validAction));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "State changed. Refresh before confirming.",
      code: "STALE_SEQUENCE",
      correlationId: expect.any(String),
    });
  });

  it("redacts compatibility-route failures with the correlation allocated before execution", async () => {
    dependencies.executeAdminCommand.mockRejectedValue(new Error("private failure detail"));

    const response = await POST(request(validAction));
    const body = await response.json();
    const executionContext = dependencies.executeAdminCommand.mock.calls[0][2] as { correlationId: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "The Voyage action could not be completed. No progress has changed. Check the current Voyage status, then try again.",
      code: "COMMAND_FAILED",
      correlationId: executionContext.correlationId,
    });
    expect(JSON.stringify(body)).not.toContain("private failure detail");
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

    const response = await POST(request(validAction));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "The Voyage action could not be completed. No progress has changed. Check the current Voyage status, then try again.",
      code: "COMMAND_FAILED",
      correlationId: expect.any(String),
    });
    expect(dependencies.logError).toHaveBeenCalledWith(
      { area: "gm-action", correlationId: body.correlationId },
      "GM action request failed",
    );
    expect(JSON.stringify(body)).not.toMatch(/capability secret|authentication secret|csrf secret/u);
    expect(dependencies.executeAdminCommand).not.toHaveBeenCalled();
  });
});
