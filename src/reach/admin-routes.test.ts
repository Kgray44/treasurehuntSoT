// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultReachRuntimePolicy, defaultReachRuntimePolicyEnvelope } from "./runtime-policy";
import { createReachTelemetryReport } from "./telemetry";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  assurance: vi.fn(),
  policy: vi.fn(),
  overview: vi.fn(),
  insert: vi.fn(),
  preview: vi.fn(),
  execute: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/wayfarer/accounts", () => ({ currentAccount: mocks.account }));
vi.mock("@/lib/db", () => ({ db: { privilegedAssurance: { findFirst: mocks.assurance } } }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate, rateLimitHeaders: () => ({}) }));
vi.mock("@/reach/admin-service", async (original) => ({
  ...(await original<typeof import("./admin-service")>()),
  readReachRuntimePolicy: mocks.policy,
  getReachAdminOverview: mocks.overview,
  insertReachTelemetry: mocks.insert,
}));
vi.mock("@/reach/admin-commands", async (original) => ({
  ...(await original<typeof import("./admin-commands")>()),
  previewReachRuntimePolicy: mocks.preview,
  executeReachRuntimePolicy: mocks.execute,
}));
import { GET as policy } from "@/app/api/reach/policy/route";
import { POST as telemetry } from "@/app/api/reach/telemetry/route";
import { GET as overview } from "@/app/api/admin/reach/route";
import { POST as preview } from "@/app/api/admin/commands/reach-runtime-policy/preview/route";
import { POST as execute } from "@/app/api/admin/commands/reach-runtime-policy/execute/route";

const previewId = "d7eb28f2-73d9-4b76-9b9c-7b19a1a2cae1";
const input = () => ({
  expectedRevision: 0,
  policy: { ...defaultReachRuntimePolicy },
  reason: "Set bounded Reach runtime limits",
  idempotencyKey: "synthetic-reach-route-command",
});
const contribution = () => ({ idempotencyKey: randomUUID(), reportVersion: 1, report: createReachTelemetryReport() });
const session = (role = "ADMINISTRATOR") => ({
  id: "synthetic-session",
  accountId: "synthetic-admin",
  csrfToken: "synthetic-csrf",
  expiresAt: new Date(Date.now() + 600000),
  account: { roles: [{ role, scopeType: "GLOBAL", scopeId: null }], profile: { displayName: "Synthetic operator" } },
});
function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
      "Sec-Fetch-Site": "same-origin",
      "x-csrf-token": "synthetic-csrf",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
const commandPath = (kind: string) => "/api/admin/commands/reach-runtime-policy/" + kind;
const confirmed = () => ({ input: input(), previewId, confirmed: true });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.account.mockResolvedValue(session());
  mocks.assurance.mockResolvedValue({
    method: "PASSWORD",
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 600000),
  });
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.policy.mockResolvedValue(defaultReachRuntimePolicyEnvelope);
  mocks.overview.mockResolvedValue({
    state: "HEALTHY",
    data: { reporting: { state: "NO_REPORTS", coverage: { totalReports: 0, distinctPeople: null } } },
  });
  mocks.insert.mockResolvedValue({ accepted: true, duplicate: false, reason: null });
  mocks.preview.mockResolvedValue({
    previewId,
    currentState: defaultReachRuntimePolicyEnvelope,
    resultingState: { ...defaultReachRuntimePolicyEnvelope, revision: 1 },
  });
  mocks.execute.mockResolvedValue({
    id: "synthetic-receipt",
    correlationId: "synthetic-correlation",
    envelope: { ...defaultReachRuntimePolicyEnvelope, revision: 1 },
    idempotent: false,
  });
});

describe("public Reach policy and identity-free automatic numeric ingestion", () => {
  it("returns the mandatory no-store policy without account lookup or fabricated fallback", async () => {
    const response = await policy(new Request("http://localhost/api/reach/policy"));
    expect(await response.json()).toEqual(defaultReachRuntimePolicyEnvelope);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.account).not.toHaveBeenCalled();
    mocks.policy.mockRejectedValueOnce(new Error("synthetic database unavailable"));
    const failed = await policy(new Request("http://localhost/api/reach/policy"));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("synthetic database");
  });
  it("accepts strict automatic numbers without cookies, consent fields or account association", async () => {
    const body = contribution();
    const response = await telemetry(request("/api/reach/telemetry", body));
    expect(response.status).toBe(202);
    expect(mocks.insert).toHaveBeenCalledWith(body);
    expect(mocks.account).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("uses the validated actual Host when Next normalizes a loopback URL, without aliasing hosts", async () => {
    const body = JSON.stringify(contribution());
    const normalized = (Host: string, Origin: string, protocol = "http:") =>
      new Request(`${protocol}//localhost:3138/api/reach/telemetry`, {
        method: "POST",
        headers: { Host, Origin, "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
        body,
      });
    expect((await telemetry(normalized("127.0.0.1:3138", "http://127.0.0.1:3138"))).status).toBe(202);
    mocks.insert.mockClear();
    for (const invalid of [
      normalized("127.0.0.1:3138", "http://localhost:3138"),
      normalized("127.0.0.1:3138,foreign.invalid", "http://127.0.0.1:3138"),
      normalized("foreign.invalid", "http://127.0.0.1:3138"),
      normalized("127.0.0.1:3138", "https://127.0.0.1:3138"),
      normalized("127.0.0.1:3138", "ftp://127.0.0.1:3138", "ftp:"),
    ])
      expect((await telemetry(invalid)).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    { Origin: "https://foreign.invalid" },
    { Origin: "null" },
    { Origin: "" },
    { "Sec-Fetch-Site": "cross-site" },
  ])("rejects cross-origin/missing origin before reading or persisting %j", async (headers) => {
    expect((await telemetry(request("/api/reach/telemetry", contribution(), headers))).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("requires JSON and rejects the oversized body before parsing or storage", async () => {
    expect(
      (await telemetry(request("/api/reach/telemetry", contribution(), { "Content-Type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (await telemetry(request("/api/reach/telemetry", contribution(), { "Content-Length": "32769" }))).status,
    ).toBe(413);
    const oversized = new Request("http://localhost/api/reach/telemetry", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: " ".repeat(32769),
    });
    expect((await telemetry(oversized)).status).toBe(413);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["accountId", "cameraId", "landmarks", "consented"])(
    "rejects extra %s metadata rather than retaining it",
    async (field) => {
      expect(
        (await telemetry(request("/api/reach/telemetry", { ...contribution(), [field]: "forbidden" }))).status,
      ).toBe(400);
      expect(mocks.insert).not.toHaveBeenCalled();
    },
  );
  it("distinguishes mandatory-disabled collection, duplicate retry and unavailable storage", async () => {
    mocks.insert.mockResolvedValueOnce({ accepted: false, duplicate: false, reason: "COLLECTION_DISABLED" });
    expect((await telemetry(request("/api/reach/telemetry", contribution()))).status).toBe(409);
    mocks.insert.mockResolvedValueOnce({ accepted: true, duplicate: true, reason: null });
    expect(await (await telemetry(request("/api/reach/telemetry", contribution()))).json()).toMatchObject({
      accepted: true,
      duplicate: true,
    });
    mocks.insert.mockRejectedValueOnce(new Error("synthetic unavailable"));
    expect((await telemetry(request("/api/reach/telemetry", contribution()))).status).toBe(503);
  });
  it("rate-limits public policy and telemetry before storage calls", async () => {
    mocks.rate.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
    expect((await policy(new Request("http://localhost/api/reach/policy"))).status).toBe(429);
    expect((await telemetry(request("/api/reach/telemetry", contribution()))).status).toBe(429);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.policy).not.toHaveBeenCalled();
  });
});

describe("canonical Reach Admiralty route authority and preview confirmation", () => {
  it("requires CONFIG_OBSERVE and preserves real-empty projection with no-store", async () => {
    const response = await overview();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    mocks.account.mockResolvedValue(session("SUPPORT_OPERATOR"));
    expect((await overview()).status).toBe(403);
  });
  it.each(["preview", "execute"] as const)("rejects unauthenticated, wrong-role and invalid-CSRF %s", async (kind) => {
    const handler = kind === "preview" ? preview : execute,
      body = kind === "preview" ? input() : confirmed();
    mocks.account.mockResolvedValueOnce(null);
    expect((await handler(request(commandPath(kind), body))).status).toBe(401);
    mocks.account.mockResolvedValueOnce(session("OPERATIONS_OPERATOR"));
    expect((await handler(request(commandPath(kind), body))).status).toBe(403);
    expect((await handler(request(commandPath(kind), body, { "x-csrf-token": "wrong" }))).status).toBe(403);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(["preview", "execute"] as const)("requires recent canonical session assurance for %s", async (kind) => {
    mocks.assurance.mockResolvedValueOnce(null);
    expect(
      (
        await (kind === "preview" ? preview : execute)(
          request(commandPath(kind), kind === "preview" ? input() : confirmed()),
        )
      ).status,
    ).toBe(403);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("returns direct owner preview and receipt shapes and keeps the current session identity", async () => {
    expect(await (await preview(request(commandPath("preview"), input()))).json()).toHaveProperty(
      "preview.previewId",
      previewId,
    );
    const response = await execute(request(commandPath("execute"), confirmed()));
    expect(await response.json()).toMatchObject({ receipt: { envelope: { revision: 1 }, idempotent: false } });
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "synthetic-admin", accountSessionId: "synthetic-session" }),
      input(),
      previewId,
    );
  });
  it("requires strict confirmation, valid preview ID and bounded immutable policy fields", async () => {
    for (const body of [
      { ...confirmed(), confirmed: false },
      { ...confirmed(), previewId: "invalid" },
      { ...confirmed(), extra: true },
    ])
      expect((await execute(request(commandPath("execute"), body))).status).toBe(400);
    expect(
      (
        await preview(
          request(commandPath("preview"), { ...input(), policy: { ...input().policy, maximumObservationAgeMs: 500 } }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("applies mutation rate limits before owner preview or execution", async () => {
    mocks.rate.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
    expect((await preview(request(commandPath("preview"), input()))).status).toBe(429);
    expect((await execute(request(commandPath("execute"), confirmed()))).status).toBe(429);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
