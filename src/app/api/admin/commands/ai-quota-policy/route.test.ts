// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  assurance: vi.fn(),
  preview: vi.fn(),
  execute: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/wayfarer/accounts", () => ({ currentAccount: mocks.account }));
vi.mock("@/lib/db", () => ({ db: { privilegedAssurance: { findFirst: mocks.assurance } } }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate, rateLimitHeaders: () => ({}) }));
vi.mock("@/parallax/ai-quota-commands", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/parallax/ai-quota-commands")>()),
  previewAIQuotaPolicy: mocks.preview,
  executeAIQuotaPolicy: mocks.execute,
}));
import { POST as preview } from "./preview/route";
import { POST as execute } from "./execute/route";

const input = {
  target: "USER",
  accountId: "synthetic-user",
  expectedRevision: 0,
  policy: null,
  reason: "Restore the standard allowance",
  idempotencyKey: "synthetic-quota-change-01",
};
const previewId = "fe3fcbe4-924e-49f7-b83a-9e406c7e38b4";
function session(role = "ADMINISTRATOR") {
  return {
    id: "synthetic-session",
    accountId: "synthetic-operator",
    csrfToken: "synthetic-csrf",
    expiresAt: new Date(Date.now() + 600000),
    account: { roles: [{ role, scopeType: "GLOBAL", scopeId: null }], profile: { displayName: "Synthetic operator" } },
  };
}
function request(kind: "preview" | "execute", body: unknown, csrf = "synthetic-csrf") {
  return new Request(`http://localhost/api/admin/commands/ai-quota-policy/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
}
const execution = () => ({ input, previewId, confirmed: true });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.account.mockResolvedValue(session());
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.assurance.mockResolvedValue({
    method: "PASSWORD",
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 600000),
  });
  mocks.preview.mockResolvedValue({
    previewId,
    commandType: "PARALLAX_AI_QUOTA_POLICY_UPDATE",
    risk: "HIGH",
    reauthenticationRequired: true,
  });
  mocks.execute.mockResolvedValue({ id: "synthetic-receipt", targetAccountId: "synthetic-user" });
});

describe("AI quota mutation HTTP safeguards", () => {
  it.each(["preview", "execute"] as const)("rejects unauthenticated %s before touching owner state", async (kind) => {
    mocks.account.mockResolvedValue(null);
    const response = await (kind === "preview" ? preview : execute)(
      request(kind, kind === "preview" ? input : execution()),
    );
    expect(response.status).toBe(401);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(["preview", "execute"] as const)("rejects invalid CSRF for %s before touching owner state", async (kind) => {
    const response = await (kind === "preview" ? preview : execute)(
      request(kind, kind === "preview" ? input : execution(), ""),
    );
    expect(response.status).toBe(403);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(["CREATOR", "SUPPORT_OPERATOR"])("denies quota changes to the %s role", async (role) => {
    mocks.account.mockResolvedValue(session(role));
    expect((await preview(request("preview", input))).status).toBe(403);
    expect((await execute(request("execute", execution()))).status).toBe(403);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("requires recent assurance bound to this exact operator session", async () => {
    mocks.assurance.mockResolvedValue({ method: "PASSWORD", issuedAt: new Date(0), expiresAt: new Date(0) });
    expect((await execute(request("execute", execution()))).status).toBe(403);
    expect(mocks.assurance).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId: "synthetic-operator",
          accountSessionId: "synthetic-session",
          revokedAt: null,
        },
      }),
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and a valid preview identity", async () => {
    for (const body of [
      { ...execution(), confirmed: false },
      { ...execution(), previewId: "" },
      { ...execution(), unexpected: true },
    ]) {
      expect((await execute(request("execute", body))).status).toBe(400);
    }
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("stops rate-limited mutations before preview or execution", async () => {
    mocks.rate.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
    for (const [handler, kind, body] of [
      [preview, "preview", input],
      [execute, "execute", execution()],
    ] as const) {
      const response = await handler(request(kind, body));
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("30");
    }
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("forwards only validated account-bound input and the reviewed preview to the owner", async () => {
    const inspected = await preview(request("preview", input));
    expect(inspected.status).toBe(200);
    expect(inspected.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.preview).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "synthetic-operator", accountSessionId: "synthetic-session" }),
      input,
    );
    const saved = await execute(request("execute", execution()));
    expect(saved.status).toBe(200);
    expect(saved.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await saved.json()).toEqual({ receipt: { id: "synthetic-receipt", targetAccountId: "synthetic-user" } });
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "synthetic-operator", accountSessionId: "synthetic-session" }),
      input,
      previewId,
    );
  });
});
