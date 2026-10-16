// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpatialDraft } from "@/parallax/authoring";
import { DraftConflictError } from "@/chronicle/studio-service";
import { createLegacyEnvironmentWorking } from "@/parallax/legacy-environment-working-contracts";
import { environmentVersionSchema } from "@/parallax/legacy-scene-environment-contracts";
import builtinEnvironments from "@/parallax/builtin-environments.v1.json";
import { defaultAIGlobalPolicy } from "@/parallax/ai-policy";
import { SpatialAssistantError, assistantSceneDigest } from "@/parallax/spatial-assistant";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  overview: vi.fn(),
  request: vi.fn(),
  apply: vi.fn(),
  usage: vi.fn(),
  policy: vi.fn(),
  list: vi.fn(),
  rate: vi.fn(),
  environmentCatalog: vi.fn(),
  inventory: vi.fn(),
  compactCatalog: vi.fn(),
  exactCatalogItem: vi.fn(),
  legacyBegin: vi.fn(),
  legacyCopy: vi.fn(),
  legacySave: vi.fn(),
  legacyRelease: vi.fn(),
  legacyLibrarySave: vi.fn(),
  legacyArchive: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/wayfarer/accounts", () => ({ currentAccount: mocks.account }));
vi.mock("@/homeport/workspace-capabilities", () => ({ workspaceCapabilityOverview: mocks.overview }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("@/parallax/environment-library-compatibility", () => ({
  listCompatibleEnvironments: mocks.environmentCatalog,
}));
vi.mock("@/parallax/legacy-environment-service", async (original) => ({
  ...(await original<typeof import("@/parallax/legacy-environment-service")>()),
  beginLegacyEnvironmentEdit: mocks.legacyBegin,
  copyLegacyEnvironment: mocks.legacyCopy,
  saveLegacyEnvironmentWorking: mocks.legacySave,
  releaseLegacyEnvironmentVersion: mocks.legacyRelease,
  saveLegacyEnvironmentToLibrary: mocks.legacyLibrarySave,
  archiveLegacyEnvironment: mocks.legacyArchive,
}));
vi.mock("@/parallax/library-lifecycle-service", async (original) => ({
  ...(await original<typeof import("@/parallax/library-lifecycle-service")>()),
  spatialLibraryInventory: mocks.inventory,
}));
vi.mock("@/parallax/spatial-catalog-read-projection", async (original) => ({
  ...(await original<typeof import("@/parallax/spatial-catalog-read-projection")>()),
  readCompactSpatialCatalogPage: mocks.compactCatalog,
  readExactSpatialCatalogItem: mocks.exactCatalogItem,
}));
vi.mock("@/parallax/spatial-assistant-service", async (original) => ({
  ...(await original<typeof import("@/parallax/spatial-assistant-service")>()),
  requestSpatialAssistant: mocks.request,
}));
vi.mock("@/parallax/spatial-assistant-application", async (original) => ({
  ...(await original<typeof import("@/parallax/spatial-assistant-application")>()),
  applySpatialAssistant: mocks.apply,
}));
vi.mock("@/parallax/ai-ledger", async (original) => ({
  ...(await original<typeof import("@/parallax/ai-ledger")>()),
  creatorAIUsage: mocks.usage,
  readAIPolicy: mocks.policy,
}));
vi.mock("@/parallax/library-service", async (original) => ({
  ...(await original<typeof import("@/parallax/library-service")>()),
  listSpatialItems: mocks.list,
}));
import { GET, POST } from "./route";
const draft = createSpatialDraft("synthetic-route");
const usage = {
  enabled: true,
  advancedEnabled: false,
  allowance: 500,
  used: 1,
  remaining: 499,
  resetAt: "2026-11-01T00:00:00.000Z",
  source: "INHERITED",
  nearingLimit: false,
};
const input = () => ({
  action: "AI",
  kind: "ASSISTANT",
  draft,
  revision: 1,
  editorGeneration: 4,
  requestId: "synthetic-request",
  idempotencyKey: "synthetic-request-key",
  request: "Move the selected map",
  selectedEntityId: draft.content.entities[0].id,
  mode: "STANDARD",
});
const request = (body: unknown, csrf = "synthetic-csrf") =>
  new Request("http://localhost/api/studio/parallax", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
async function application() {
  return {
    action: "ASSISTANT_APPLY",
    proposal: {
      schemaVersion: 1,
      requestId: "synthetic-request",
      definitionId: draft.content.definitionId,
      sceneRevision: 1,
      editorGeneration: 4,
      sceneDigest: await assistantSceneDigest(draft),
      intentType: "EDIT",
      summary: "Reviewed placement",
      clarification: null,
      assumptions: [],
      warnings: [],
      unsupportedCapabilities: [],
      accessibilityNotes: [],
      creatorExplanation: "Review the supported changes.",
      operations: [
        {
          id: "move",
          type: "PLACEMENT",
          entityId: draft.content.entities[0].id,
          placement: "WALL",
          explanation: "Place the map on a wall.",
          dependsOn: [],
        },
      ],
    },
    selectedOperationIds: ["move"],
    idempotencyKey: "synthetic-application-key",
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "synthetic-never-visible-key");
  mocks.account.mockResolvedValue({
    accountId: "synthetic-owner",
    csrfToken: "synthetic-csrf",
    account: { roles: [] },
  });
  mocks.overview.mockResolvedValue({ workspaces: [{ id: "CREATOR", state: "ACTIVE" }] });
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.usage.mockResolvedValue(usage);
  mocks.policy.mockResolvedValue({ policy: { ...defaultAIGlobalPolicy, enabled: true } });
  mocks.list.mockResolvedValue([]);
  mocks.request.mockResolvedValue({ status: "UNAVAILABLE", code: "SYNTHETIC_TEST", usage });
  mocks.apply.mockResolvedValue({ status: "SAVED", draft, revision: 2 });
  mocks.environmentCatalog.mockResolvedValue([]);
  mocks.inventory.mockResolvedValue({ items: [], environments: [] });
  mocks.compactCatalog.mockResolvedValue({
    items: [],
    total: 0,
    nextCursor: null,
    availableKinds: [],
    availableOrigins: [],
  });
  mocks.exactCatalogItem.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("compact Spatial Library read views", () => {
  it("uses the Creator session for a bounded global page without the full bootstrap inventory", async () => {
    const response = await GET(
      new Request("http://localhost/api/studio/parallax?view=library-catalog&kind=SCENES&limit=48"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(mocks.compactCatalog).toHaveBeenCalledWith(
      "synthetic-owner",
      expect.objectContaining({ kind: "SCENES", limit: 48 }),
    );
    expect(mocks.inventory).not.toHaveBeenCalled();
    expect(mocks.usage).not.toHaveBeenCalled();
    expect(await response.json()).not.toHaveProperty("csrfToken");
  });
  it("rejects malformed, unsupported, injected and stale page requests", async () => {
    const base = "http://localhost/api/studio/parallax?view=library-catalog&kind=SCENES";
    expect((await GET(new Request(`${base}&limit=1000`))).status).toBe(400);
    expect((await GET(new Request(`${base}&accountId=another`))).status).toBe(400);
    const usageFilter = await GET(new Request(`${base}&origin=IN_USE`));
    expect(usageFilter.status).toBe(422);
    expect(await usageFilter.json()).toMatchObject({ code: "SPATIAL_CATALOG_USAGE_FILTER_UNAVAILABLE" });
    expect(mocks.compactCatalog).not.toHaveBeenCalled();
    mocks.compactCatalog.mockRejectedValueOnce(new Error("Spatial catalog cursor is stale; restart browsing."));
    const stale = await GET(new Request(`${base}&cursor=old`));
    expect(stale.status).toBe(409);
    expect(stale.headers.get("cache-control")).toBe("private, no-store");
  });
  it("reads one exact selected record and conceals unavailable or foreign items", async () => {
    const url = "http://localhost/api/studio/parallax?view=library-item&entryId=saved%3Aowned";
    mocks.exactCatalogItem.mockResolvedValueOnce({ kind: "SPATIAL", record: { id: "owned" } });
    const found = await GET(new Request(url));
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ kind: "SPATIAL", record: { id: "owned" } });
    expect(mocks.exactCatalogItem).toHaveBeenCalledWith("synthetic-owner", "saved:owned");
    expect((await GET(new Request(url))).status).toBe(404);
    mocks.account.mockResolvedValue(null);
    expect((await GET(new Request(url))).status).toBe(401);
    expect(mocks.exactCatalogItem).toHaveBeenCalledTimes(2);
  });
});
describe("canonical Studio Assistant HTTP gates", () => {
  it("returns the compatible Environment catalog only through the Creator/CSRF port", async () => {
    mocks.environmentCatalog.mockResolvedValue([
      { representation: "LIFECYCLE_V1", id: "owned-environment", versions: [], working: { id: "owned-environment" } },
    ]);
    const response = await POST(request({ action: "ENVIRONMENT_CATALOG" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).catalog[0].id).toBe("owned-environment");
    expect(mocks.environmentCatalog).toHaveBeenCalledWith("synthetic-owner", undefined, []);
    mocks.environmentCatalog.mockClear();
    expect((await POST(request({ action: "ENVIRONMENT_CATALOG" }, "wrong-csrf"))).status).toBe(401);
    expect(mocks.environmentCatalog).not.toHaveBeenCalled();
  });
  it("rejects foreign account selectors on catalog requests before reading any records", async () => {
    expect((await POST(request({ action: "ENVIRONMENT_CATALOG", accountId: "another-person" }))).status).toBe(400);
    expect(mocks.environmentCatalog).not.toHaveBeenCalled();
  });
  it("shows only safe configuration and Creator allowance metadata", async () => {
    const response = await GET(new Request("http://localhost/api/studio/parallax"));
    const body = await response.json();
    expect(body).toMatchObject({
      aiConfigured: true,
      aiAvailable: true,
      aiUsage: usage,
      layoutScope: "synthetic-owner",
    });
    expect(JSON.stringify(body)).not.toMatch(/synthetic-never-visible-key|pricing|monthlySpendNano|Authorization/);
    expect(response.headers.get("cache-control")).toContain("no-store");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await (await GET(new Request("http://localhost/api/studio/parallax"))).json()).toMatchObject({
      aiConfigured: false,
      aiAvailable: false,
      aiUsage: { enabled: false },
    });
  });
  it("rejects unauthenticated requests before inference or application", async () => {
    mocks.account.mockResolvedValue(null);
    expect((await POST(request(input()))).status).toBe(401);
    expect((await POST(request(await application()))).status).toBe(401);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("requires the canonical CSRF token and an active Creator workspace", async () => {
    expect((await POST(request(input(), "incorrect"))).status).toBe(401);
    mocks.overview.mockResolvedValue({ workspaces: [{ id: "CREATOR", state: "INACTIVE" }] });
    expect((await POST(request(input()))).status).toBe(401);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rejects injected identities and schema fields before service execution", async () => {
    const response = await POST(request({ ...input(), accountId: "injected-owner" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_REQUEST" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("passes exact parsed request, session owner and cancellation signal to the one provider service", async () => {
    const http = request(input());
    expect((await POST(http)).status).toBe(200);
    const { action: _action, kind: _kind, ...expected } = input();
    void _action;
    void _kind;
    expect(mocks.request).toHaveBeenCalledWith("synthetic-owner", expected, { signal: http.signal });
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("passes only the reviewed application to the atomic canonical owner", async () => {
    const raw = await application();
    expect((await POST(request(raw))).status).toBe(200);
    const { action: _action, ...expected } = raw;
    void _action;
    expect(mocks.apply).toHaveBeenCalledWith("synthetic-owner", expected);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("returns quota failures with safe allowance/reset information", async () => {
    mocks.request.mockRejectedValue(
      new SpatialAssistantError("USER_MONTHLY_REQUESTS", "Your monthly allowance has been reached.", 429),
    );
    const response = await POST(request(input()));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "USER_MONTHLY_REQUESTS", usage });
  });
  it("redacts unknown persistence and upstream error messages", async () => {
    mocks.apply.mockRejectedValue(new Error("PRIVATE_DATABASE_DETAIL synthetic-never-visible-key"));
    const response = await POST(request(await application()));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/PRIVATE_DATABASE|synthetic-never-visible-key/);
  });
  it("keeps retired intent/critique actions from bypassing quota admission", async () => {
    vi.stubEnv("PARALLAX_AUTHORING_AI_URL", "https://legacy.example.test");
    vi.stubEnv("PARALLAX_AUTHORING_AI_TOKEN", "synthetic-legacy-token");
    const body = await (await POST(request({ action: "AI", kind: "INTENT", request: "Move the map", draft }))).json();
    expect(body).toMatchObject({ status: "UNAVAILABLE", code: "LEGACY_AI_RETIRED" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("bounds request bytes and the canonical HTTP rate before service work", async () => {
    expect((await POST(request({ ...input(), request: "x".repeat(256 * 1024) }))).status).toBe(413);
    mocks.rate.mockReturnValue({ allowed: false });
    expect((await POST(request(input()))).status).toBe(429);
    expect(mocks.request).not.toHaveBeenCalled();
  });
});

const legacySource = environmentVersionSchema.parse(builtinEnvironments[0]);
const legacyWorking = createLegacyEnvironmentWorking(
  { ...legacySource.content, id: "synthetic-legacy-room", origin: "MANUAL" },
  legacySource.reference,
  {
    operationId: "synthetic-copy",
    sourceDefinitionId: legacySource.reference.environmentId,
    sourceRevision: 0,
    requestDigest: "a".repeat(64),
  },
);
const legacyOperations = [
  {
    action: "LEGACY_ENVIRONMENT_BEGIN",
    body: { definitionId: legacyWorking.id, revision: 8, operationId: "synthetic-begin", versionId: "v".repeat(150) },
    service: mocks.legacyBegin,
  },
  {
    action: "LEGACY_ENVIRONMENT_COPY",
    body: {
      source: legacySource.reference,
      newId: legacyWorking.id,
      operationId: "synthetic-copy",
      name: "Owned synthetic room",
      destination: "WORKING",
    },
    service: mocks.legacyCopy,
  },
  { action: "LEGACY_ENVIRONMENT_SAVE", body: { document: legacyWorking, revision: 9 }, service: mocks.legacySave },
  {
    action: "LEGACY_ENVIRONMENT_RELEASE",
    body: {
      definitionId: legacyWorking.id,
      revision: 19,
      operationId: "synthetic-release",
      contentChecksum: "b".repeat(64),
    },
    service: mocks.legacyRelease,
  },
  {
    action: "LEGACY_ENVIRONMENT_LIBRARY_SAVE",
    body: { definitionId: legacyWorking.id, revision: 19 },
    service: mocks.legacyLibrarySave,
  },
  {
    action: "LEGACY_ENVIRONMENT_ARCHIVE",
    body: { definitionId: legacyWorking.id, revision: 19, archived: false },
    service: mocks.legacyArchive,
  },
];
describe("legacy Environment canonical HTTP ports", () => {
  it.each(legacyOperations)(
    "routes $action through the session owner and its separate writer",
    async ({ action, body, service }) => {
      service.mockResolvedValue({ revision: 20 });
      const response = await POST(request({ action, ...body }));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toBe("Cookie");
      if (action === "LEGACY_ENVIRONMENT_SAVE")
        expect(service).toHaveBeenCalledWith("synthetic-owner", legacyWorking, 9);
      else if (action === "LEGACY_ENVIRONMENT_LIBRARY_SAVE")
        expect(service).toHaveBeenCalledWith("synthetic-owner", legacyWorking.id, 19);
      else if (action === "LEGACY_ENVIRONMENT_ARCHIVE")
        expect(service).toHaveBeenCalledWith("synthetic-owner", legacyWorking.id, 19, false);
      else expect(service).toHaveBeenCalledWith("synthetic-owner", body);
      legacyOperations
        .filter((other) => other.service !== service)
        .forEach((other) => expect(other.service).not.toHaveBeenCalled());
    },
  );
  it.each(legacyOperations)(
    "gates $action on Creator access, CSRF and rate before writing",
    async ({ action, body }) => {
      expect((await POST(request({ action, ...body }, "wrong-csrf"))).status).toBe(401);
      mocks.overview.mockResolvedValue({ workspaces: [{ id: "CREATOR", state: "INACTIVE" }] });
      expect((await POST(request({ action, ...body }))).status).toBe(401);
      mocks.overview.mockResolvedValue({ workspaces: [{ id: "CREATOR", state: "ACTIVE" }] });
      mocks.rate.mockReturnValue({ allowed: false });
      expect((await POST(request({ action, ...body }))).status).toBe(429);
      legacyOperations.forEach((operation) => expect(operation.service).not.toHaveBeenCalled());
    },
  );
  it.each(legacyOperations)("rejects a caller owner selector on $action", async ({ action, body }) => {
    const response = await POST(request({ action, ...body, accountId: "foreign-owner" }));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    legacyOperations.forEach((operation) => expect(operation.service).not.toHaveBeenCalled());
  });
  it("returns a private stale-CAS conflict without creating an immutable release", async () => {
    mocks.legacySave.mockRejectedValue(new DraftConflictError(20));
    const response = await POST(request({ action: "LEGACY_ENVIRONMENT_SAVE", document: legacyWorking, revision: 9 }));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ code: "DRAFT_CONFLICT", currentVersion: 20 });
    expect(mocks.legacyRelease).not.toHaveBeenCalled();
  });
});

describe("owner-scoped Scene Manager comparison", () => {
  it("compares only an owner-inventory target with the same Environment", async () => {
    const source = structuredClone(draft),
      target = structuredClone(draft);
    source.content.environment = structuredClone(legacySource.reference);
    target.content.environment = structuredClone(legacySource.reference);
    target.content.title = "Other owner-scoped Scene";
    target.content.scenePresentation = { lighting: "LOW" };
    mocks.list.mockResolvedValue([{ id: "target-scene", draft: target, archived: false }]);
    const response = await POST(
      request({ action: "SCENE_COMPARE", draft: source, targetDefinitionId: "target-scene" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.list).toHaveBeenCalledWith("synthetic-owner");
    expect(await response.json()).toMatchObject({
      sourceTitle: source.content.title,
      targetTitle: target.content.title,
      differences: expect.arrayContaining([expect.objectContaining({ category: "LIGHTING_EFFECT" })]),
    });
  });
  it("rejects foreign or archived targets and caller account selectors", async () => {
    const body = { action: "SCENE_COMPARE", draft, targetDefinitionId: "foreign-scene" };
    expect((await POST(request(body))).status).toBe(400);
    mocks.list.mockResolvedValue([{ id: "foreign-scene", draft, archived: true }]);
    expect((await POST(request(body))).status).toBe(400);
    mocks.list.mockClear();
    expect((await POST(request({ ...body, accountId: "other-owner" }))).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
