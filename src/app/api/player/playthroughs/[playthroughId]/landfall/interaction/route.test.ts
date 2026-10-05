import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  csrf: vi.fn(),
  rate: vi.fn(),
  chart: vi.fn(),
  pinned: vi.fn(),
  status: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/platform/auth", () => ({ requirePlayerIdentity: mocks.identity, verifyPlayerCsrf: mocks.csrf }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../route", () => ({ GET: mocks.chart }));
vi.mock("@/landfall/published", () => ({ loadPinnedLandfallDefinition: mocks.pinned }));
vi.mock("@/landfall/installation-token-server", async (original) => ({
  ...(await original<typeof import("@/landfall/installation-token-server")>()),
  deployedLandfallInstallationSigner: { status: mocks.status, verify: mocks.verify },
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
definition.waypoints[0].installations = [
  { id: "lab-installation", medium: "QR", label: "Synthetic tag", accessibilityAlternative: "Ask the Captain." },
];
const pinned = {
  sessionId: "lab-session",
  taleId: "fixture",
  publishedVersionId: "lab-pin",
  currentSequence: 4,
  definition,
};
const bootstrap = projectPlayerLandfallBootstrap(pinned, { releasedAssets: [], chapterId: null, blockId: null });
const scope = {
  taleId: "fixture",
  publishedVersionId: "lab-pin",
  worldspaceId: "town",
  waypointId: definition.waypoints[0].id,
  id: "lab-installation",
  medium: "QR" as const,
};
const input = () => ({ operation: "VERIFY", medium: "QR", token: signer.issue(scope).token });
const send = (value: unknown) =>
  POST(
    new Request("https://example.test/interaction", {
      method: "POST",
      headers: { "x-csrf-token": "lab-csrf" },
      body: JSON.stringify(value),
    }),
    { params: Promise.resolve({ playthroughId: "lab-session" }) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ playerProfileId: "lab-player" });
  mocks.csrf.mockResolvedValue(true);
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.chart.mockImplementation(async () => Response.json({ available: true, bootstrap }));
  mocks.pinned.mockResolvedValue(pinned);
  mocks.status.mockReturnValue(signer.status());
  mocks.verify.mockImplementation((token, value) => signer.verify(token, value));
});
describe("authorized published installation identity", () => {
  it("checks Player identity, CSRF, access and rate limits before exposing trust or verifying", async () => {
    mocks.identity.mockResolvedValueOnce(null);
    expect((await send(input())).status).toBe(401);
    mocks.csrf.mockResolvedValueOnce(false);
    expect((await send(input())).status).toBe(403);
    mocks.rate.mockReturnValueOnce({ allowed: false });
    expect((await send(input())).status).toBe(429);
    mocks.chart.mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status: 404 }));
    expect((await send(input())).status).toBe(404);
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("returns only first-party public trust and released objective installations, without progress authority", async () => {
    const response = await send({ operation: "STATUS" }),
      value = await response.json();
    expect(value).toMatchObject({
      state: "CONFIGURED",
      scope: { taleId: "fixture", publishedVersionId: "lab-pin" },
      installations: definition.waypoints[0].installations,
      canComplete: false,
    });
    expect(JSON.stringify(value)).not.toContain("PRIVATE");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("verifies a genuine bounded signature while expressly declining any presence or arrival claim", async () => {
    expect(await (await send(input())).json()).toEqual({
      state: "VERIFIED",
      installationId: "lab-installation",
      medium: "QR",
      expiresAt: now + 7 * 86400000,
      physicalPresence: "NOT_PROVEN",
      canComplete: false,
    });
    expect(mocks.chart).toHaveBeenCalledTimes(2);
  });
  it("rejects unconfigured, unrelated, stale, hidden/history or tampered requests", async () => {
    mocks.status.mockReturnValueOnce({ state: "NOT_CONFIGURED", canComplete: false });
    expect(await (await send(input())).json()).toMatchObject({ state: "NOT_CONFIGURED" });
    for (const value of [
      { ...input(), medium: "NFC" },
      { ...input(), url: "https://untrusted.example.test" },
      { ...input(), token: "x".repeat(2049) },
      { ...input(), token: signer.issue({ ...scope, publishedVersionId: "unrelated" }).token },
    ])
      expect((await send(value)).status).toBe(400);
    mocks.chart.mockResolvedValueOnce(
      Response.json({ available: true, bootstrap: { ...bootstrap, replayOnly: true } }),
    );
    expect((await send(input())).status).toBe(409);
    mocks.pinned.mockResolvedValueOnce({ ...pinned, currentSequence: 5 });
    expect((await send(input())).status).toBe(409);
  });
  it("discards successful signatures after the current objective or Player access changes", async () => {
    mocks.chart
      .mockResolvedValueOnce(Response.json({ available: true, bootstrap }))
      .mockResolvedValueOnce(Response.json({ available: true, bootstrap: { ...bootstrap, currentSequence: 5 } }));
    expect((await send(input())).status).toBe(409);
    mocks.chart
      .mockResolvedValueOnce(Response.json({ available: true, bootstrap }))
      .mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status: 404 }));
    expect((await send(input())).status).toBe(404);
  });
});
