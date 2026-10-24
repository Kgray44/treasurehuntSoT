// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createSpatialDraft } from "@/parallax/authoring";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  rate: vi.fn(),
  runtime: vi.fn(),
  configuration: vi.fn(),
  import: vi.fn(),
  withdraw: vi.fn(),
  list: vi.fn(),
  infer: vi.fn(),
  apply: vi.fn(),
  policy: vi.fn(),
  usage: vi.fn(),
  configured: vi.fn(),
}));
vi.mock("@/chronicle/studio-authorization", () => ({ requireStudioWorkspace: mocks.authorize }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("@/private-content/config", () => ({ parsePrivateContentConfiguration: mocks.configuration }));
vi.mock("@/private-content/providers", () => ({ createPrivateProviderRuntime: mocks.runtime }));
vi.mock("@/private-content/media/room-photo", () => ({
  importProtectedRoomPhoto: mocks.import,
  withdrawRoomPhotoPermission: mocks.withdraw,
  listRoomPhotoPermissions: mocks.list,
}));
vi.mock("@/parallax/room-perception-service", async (original) => ({
  ...(await original<typeof import("@/parallax/room-perception-service")>()),
  requestRoomPerception: mocks.infer,
  applyRoomPerception: mocks.apply,
}));
vi.mock("@/parallax/ai-ledger", () => ({ readAIPolicy: mocks.policy, creatorAIUsage: mocks.usage }));
vi.mock("@/parallax/openai-provider", () => ({ openAIProviderConfiguration: mocks.configured }));
import { GET, POST } from "./route";
const request = (body: unknown) =>
  new Request("http://localhost/api/studio/parallax/room-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": "synthetic-csrf" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ accountId: "synthetic-owner" });
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.list.mockResolvedValue([]);
  mocks.runtime.mockReturnValue({
    configuration: { PRIVATE_CONTENT_ENABLED: true },
    storage: { health: async () => ({ configured: true, healthy: true }) },
    scanner: { health: async () => ({ configured: true, healthy: true }) },
  });
  mocks.policy.mockResolvedValue({ policy: { allowedModels: ["gpt-6-luna", "gpt-6.1-sol"] } });
  mocks.usage.mockResolvedValue({ enabled: true, roomModel: "gpt-6.1-sol" });
  mocks.configured.mockReturnValue({ configured: true });
});
it("retains owner-scoped withdrawal metadata when inference configuration is unavailable", async () => {
  mocks.list.mockResolvedValue([{ mediaId: "opaque-photo", permissionExpiresAt: "2026-10-13T00:00:00Z" }]);
  mocks.configuration.mockImplementation(() => {
    throw new Error("configuration unavailable");
  });
  const response = await GET(new Request("http://localhost/api/studio/parallax/room-photo?definitionId=owned-scene"));
  expect(mocks.list).toHaveBeenCalledWith("synthetic-owner", "owned-scene");
  expect(await response.json()).toEqual(
    expect.objectContaining({
      available: false,
      photos: [{ mediaId: "opaque-photo", permissionExpiresAt: "2026-10-13T00:00:00Z" }],
    }),
  );
});
it("checks Creator/CSRF authorization before reading or importing an image", async () => {
  mocks.authorize.mockResolvedValue(null);
  const raw = request({});
  expect((await POST(raw)).status).toBe(401);
  expect(mocks.authorize).toHaveBeenCalledWith(raw);
  expect(raw.bodyUsed).toBe(false);
  expect(mocks.runtime).not.toHaveBeenCalled();
  expect(mocks.import).not.toHaveBeenCalled();
  expect((await GET()).status).toBe(403);
});
it("reports safe configuration and manual fallback without disclosing private provider details", async () => {
  expect(await (await GET()).json()).toEqual({
    available: true,
    model: "gpt-6.1-sol",
    message: "Protected photo import and room inference are ready.",
  });
  mocks.configuration.mockImplementation(() => {
    throw new Error("synthetic-secret-and-path-must-never-leak");
  });
  const response = await GET();
  expect(await response.text()).not.toContain("synthetic-secret-and-path");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it("labels the local development scanner without claiming certified malware protection", async () => {
  mocks.runtime.mockReturnValue({
    configuration: { PRIVATE_CONTENT_ENABLED: true },
    storage: { health: async () => ({ configured: true, healthy: true }) },
    scanner: { name: "synthetic-test-scanner", health: async () => ({ configured: true, healthy: true }) },
  });
  expect(await (await GET()).json()).toEqual({
    available: true,
    model: "gpt-6.1-sol",
    message:
      "Local development photo import and room inference are ready. Development scanner only; malware protection is not certified.",
  });
  mocks.configured.mockReturnValue({ configured: false });
  expect(await (await GET()).json()).toEqual(expect.objectContaining({ available: false }));
});
it("rejects duplicate image IDs before inference", async () => {
  const response = await POST(
    request({
      action: "RECONSTRUCT",
      draft: createSpatialDraft("route-photo"),
      revision: 1,
      editorGeneration: 0,
      requestId: "photo-request",
      idempotencyKey: "synthetic-photo-key",
      mediaIds: ["same-photo", "same-photo"],
      sharedFeatureId: null,
    }),
  );
  expect(response.status).toBe(400);
  expect(mocks.infer).not.toHaveBeenCalled();
});
it("withdraws only the authenticated owner's scene-specific permission without needing inference configuration", async () => {
  mocks.withdraw.mockResolvedValue({ withdrawn: true });
  const response = await POST(request({ action: "WITHDRAW", definitionId: "owned-scene", mediaId: "owned-photo" }));
  expect(response.status).toBe(200);
  expect(mocks.withdraw).toHaveBeenCalledWith({
    ownerAccountId: "synthetic-owner",
    definitionId: "owned-scene",
    mediaId: "owned-photo",
  });
  expect(mocks.runtime).not.toHaveBeenCalled();
});
it("bounds streamed request bytes even without a Content-Length header", async () => {
  const raw = new Request("http://localhost/api/studio/parallax/room-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "x".repeat(256 * 1024 + 1),
  });
  expect((await POST(raw)).status).toBe(413);
  expect(mocks.infer).not.toHaveBeenCalled();
  expect(mocks.runtime).not.toHaveBeenCalled();
});
it("rejects unsupported uploads before entering private storage", async () => {
  const form = new FormData();
  form.set("image", new File(["synthetic-svg"], "fixture.svg", { type: "image/svg+xml" }));
  form.set("definitionId", "owned-scene");
  form.set("consent", "yes");
  const response = await POST(
    new Request("http://localhost/api/studio/parallax/room-photo", { method: "POST", body: form }),
  );
  expect(response.status).toBe(400);
  expect(mocks.import).not.toHaveBeenCalled();
});
it("passes the authorized owner and explicit consent to canonical private import and returns only its opaque receipt", async () => {
  const form = new FormData();
  form.set("image", new File(["synthetic-raster"], "fixture.png", { type: "image/png" }));
  form.set("definitionId", "owned-scene");
  form.set("consent", "yes");
  mocks.import.mockResolvedValue({
    mediaId: "opaque-photo",
    width: 64,
    height: 32,
    permissionExpiresAt: "2026-10-13T00:00:00Z",
  });
  const raw = new Request("http://localhost/api/studio/parallax/room-photo", { method: "POST", body: form });
  const response = await POST(raw);
  expect(response.status).toBe(201);
  expect(mocks.import).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerAccountId: "synthetic-owner",
      definitionId: "owned-scene",
      consent: true,
      declaredMediaType: "image/png",
      signal: raw.signal,
    }),
  );
  expect(await response.json()).toEqual({
    mediaId: "opaque-photo",
    width: 64,
    height: 32,
    permissionExpiresAt: "2026-10-13T00:00:00Z",
  });
});
