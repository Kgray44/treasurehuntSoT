import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  rate: vi.fn(),
  version: vi.fn(),
  snapshot: vi.fn(),
  status: vi.fn(),
  issue: vi.fn(),
}));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.owner }));
vi.mock("@/chronicle/publishing", () => ({ parsePublishedSnapshot: mocks.snapshot }));
vi.mock("@/lib/db", () => ({ db: { publishedTaleVersion: { findFirst: mocks.version } } }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("@/landfall/installation-token-server", async (original) => ({
  ...(await original<typeof import("@/landfall/installation-token-server")>()),
  deployedLandfallInstallationSigner: { status: mocks.status, issue: mocks.issue },
}));
import { LandfallInstallationSigner } from "@/landfall/installation-token-server";
import { POST } from "./route";
const pair = generateKeyPairSync("ed25519"),
  now = 1000000;
const signer = new LandfallInstallationSigner(
  { keyId: "lab-key", privateKey: pair.privateKey, publicKey: pair.publicKey },
  () => now,
);
const definition = structuredClone(landfallFixture);
definition.taleId = "fixture";
definition.waypoints[0].installations = [
  { id: "lab-installation", medium: "QR", label: "Synthetic tag", accessibilityAlternative: "Ask the Captain." },
];
const input = {
  operation: "ISSUE",
  waypointId: definition.waypoints[0].id,
  publishedVersionId: "lab-pin",
  installationId: "lab-installation",
};
const send = (value: unknown = input) =>
  POST(
    new Request("https://example.test/interaction", {
      method: "POST",
      headers: { "x-csrf-token": "lab-csrf" },
      body: JSON.stringify(value),
    }),
    { params: Promise.resolve({ taleId: "fixture" }) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue({ session: { accountId: "lab-creator" } });
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.version.mockResolvedValue({
    id: "lab-pin",
    taleId: "fixture",
    versionLabel: "Synthetic edition",
    contentSnapshot: "synthetic-only",
  });
  mocks.snapshot.mockReturnValue({ tale: { id: "fixture" }, landfall: definition });
  mocks.status.mockReturnValue(signer.status());
  mocks.issue.mockImplementation((scope) => signer.issue(scope));
});
describe("Creator published physical installation issuance", () => {
  it("requires existing ownership/CSRF authorization and actor quota before signing or reading a version", async () => {
    mocks.owner.mockResolvedValueOnce(null);
    expect((await send()).status).toBe(404);
    expect(mocks.version).not.toHaveBeenCalled();
    mocks.rate.mockReturnValueOnce({ allowed: false });
    expect((await send()).status).toBe(429);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.owner).toHaveBeenCalledWith("fixture", expect.any(Request));
  });
  it("uses only published installations and returns an authentic bounded printable QR with no arrival authority", async () => {
    const response = await send(),
      value = await response.json();
    expect(value).toMatchObject({
      state: "ISSUED",
      medium: "QR",
      installationId: "lab-installation",
      expiresAt: now + 7 * 86400000,
      canComplete: false,
    });
    expect(value.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(
      signer.verify(value.token, {
        taleId: "fixture",
        publishedVersionId: "lab-pin",
        worldspaceId: "town",
        waypointId: definition.waypoints[0].id,
        id: "lab-installation",
        medium: "QR",
      }),
    ).toMatchObject({ purpose: "LANDFALL_INSTALLATION" });
    expect(mocks.version).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taleId: "fixture", id: "lab-pin" } }),
    );
    expect(mocks.owner).toHaveBeenCalledTimes(2);
  });
  it("does not invent signing trust and rejects draft payloads, scope overrides or uninstalled identifiers", async () => {
    mocks.status.mockReturnValueOnce({ state: "NOT_CONFIGURED", canComplete: false });
    expect(await (await send()).json()).toEqual({ state: "NOT_CONFIGURED", canComplete: false });
    expect(mocks.version).not.toHaveBeenCalled();
    for (const value of [
      { ...input, keyId: "tag-key" },
      { ...input, script: "code" },
      { ...input, medium: "NFC" },
      { ...input, definition },
    ])
      expect((await send(value)).status).toBe(400);
    expect((await send({ ...input, installationId: "uninstalled" })).status).toBe(409);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("rejects foreign snapshots, non-physical waypoints, missing publications and late owner revocation", async () => {
    mocks.version.mockResolvedValueOnce(null);
    expect((await send()).status).toBe(409);
    mocks.snapshot.mockReturnValueOnce({ tale: { id: "unrelated" }, landfall: definition });
    expect((await send()).status).toBe(409);
    const virtual = structuredClone(definition);
    virtual.worldspaces[0].kind = "VIRTUAL";
    mocks.snapshot.mockReturnValueOnce({ tale: { id: "fixture" }, landfall: virtual });
    expect((await send()).status).toBe(409);
    mocks.owner.mockResolvedValueOnce({ session: { accountId: "lab-creator" } }).mockResolvedValueOnce(null);
    expect((await send()).status).toBe(409);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
