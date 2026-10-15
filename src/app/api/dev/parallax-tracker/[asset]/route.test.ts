import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { pilotEnvironmentEnabled, requirePilotOwner } from "@/spatial-pilot/authorization";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { eighthwallAvailability, readEighthwallAsset } from "@/parallax/eighthwall-local-assets";
vi.mock("@/spatial-pilot/authorization", () => ({ pilotEnvironmentEnabled: vi.fn(), requirePilotOwner: vi.fn() }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: vi.fn() }));
vi.mock("@/parallax/eighthwall-local-assets", () => ({
  eighthwallAvailability: vi.fn(),
  readEighthwallAsset: vi.fn(),
}));
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  const readFile = vi.fn();
  return { ...actual, readFile, default: { ...actual, readFile } };
});
const request = new Request("https://example.test/api/dev/parallax-tracker/availability");
const invoke = (asset: string, incoming = request) => GET(incoming, { params: Promise.resolve({ asset }) });
beforeEach(() => {
  vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://example.test");
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_PROTOTYPE", "1");
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "TINYVIO");
  vi.mocked(pilotEnvironmentEnabled).mockReturnValue(true);
  vi.mocked(requirePilotOwner).mockResolvedValue({ accountId: "spatial-pilot-navigator" } as never);
  vi.stubEnv("SPATIAL_PILOT_SOURCE_DIRTY", "0");
  vi.mocked(requireWayfarerAccount).mockResolvedValue({ accountId: "synthetic-owner" } as never);
  vi.mocked(eighthwallAvailability).mockResolvedValue(null);
  vi.mocked(readEighthwallAsset).mockResolvedValue(null);
});

it("authorizes proprietary SDK availability and bytes against the configured origin behind a proxy, ignoring forwarded headers", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "EIGHTHWALL");
  const proxyRequest = new Request("https://127.0.0.1:3292/api/dev/parallax-tracker/availability", {
    headers: {
      "x-forwarded-host": "forged.invalid",
      "x-forwarded-proto": "http",
      forwarded: "for=127.0.0.1;host=forged.invalid;proto=http",
    },
  });
  vi.mocked(eighthwallAvailability).mockResolvedValue({
    version: "1.0.0",
    scriptUrl: "/api/dev/parallax-tracker/xr.js",
    integrity: "sha256-synthetic-route-test",
  });
  vi.mocked(readEighthwallAsset).mockResolvedValue({
    bytes: Buffer.from("synthetic route fixture, not SDK bytes"),
    type: "text/javascript",
  });
  expect(await (await invoke("availability", proxyRequest)).json()).toMatchObject({
    engine: "EIGHTHWALL",
    localPrototype: true,
  });
  expect(eighthwallAvailability).toHaveBeenCalledExactlyOnceWith("https://example.test");
  const script = await invoke("xr.js", proxyRequest);
  expect(readEighthwallAsset).toHaveBeenCalledExactlyOnceWith("xr.js", "https://example.test");
  expect(script.status).toBe(200);
  expect(await script.text()).toBe("synthetic route fixture, not SDK bytes");
  expect(requirePilotOwner).toHaveBeenCalledWith();
});

it("fails closed on an invalid configured public origin before reading or serving proprietary SDK assets", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "EIGHTHWALL");
  vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://example.test/unapproved-path");
  const availability = await (await invoke("availability")).json();
  expect(availability).toMatchObject({ localPrototype: false, productionCleared: false });
  expect(availability.eighthwall).toBeUndefined();
  expect(eighthwallAvailability).toHaveBeenCalledExactlyOnceWith("");
  const script = await invoke("xr.js");
  expect(script.status).toBe(404);
  expect(await script.text()).toBe("");
  expect(readEighthwallAsset).toHaveBeenCalledExactlyOnceWith("xr.js", "");
  expect(readFile).not.toHaveBeenCalled();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("keeps the prototype unavailable on ordinary servers and for anonymous requests", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_PROTOTYPE", "0");
  expect((await invoke("availability")).status).toBe(404);
  expect(requireWayfarerAccount).not.toHaveBeenCalled();
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_PROTOTYPE", "1");
  vi.mocked(pilotEnvironmentEnabled).mockReturnValue(false);
  expect((await invoke("tinyvio-slam.wasm")).status).toBe(404);
  vi.mocked(pilotEnvironmentEnabled).mockReturnValue(true);
  vi.mocked(requireWayfarerAccount).mockResolvedValue(null);
  expect((await invoke("tinyvio-slam.wasm")).status).toBe(401);
  expect(readFile).not.toHaveBeenCalled();
});
it("declares only authenticated local prototype availability without a production or metric claim", async () => {
  const response = await invoke("availability");
  expect(await response.json()).toEqual({
    localPrototype: true,
    engine: "TINYVIO",
    sourceCommit: null,
    sourceDirty: false,
    productionCleared: false,
    method: "VISUAL_INERTIAL_SLAM",
    metricScaleVerified: false,
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(readFile).not.toHaveBeenCalled();
});
it("rejects arbitrary paths and mismatched sidecars before serving any bytes", async () => {
  expect((await invoke("../../credentials")).status).toBe(404);
  expect(readFile).not.toHaveBeenCalled();
  vi.mocked(readFile).mockResolvedValue(Buffer.from("unapproved tracking module"));
  const response = await invoke("tinyvio-slam.js");
  expect(response.status).toBe(503);
  expect(await response.text()).toBe("");
});

it("selects only an explicit public-source local prototype and keeps release and metric claims false", async () => {
  expect((await invoke("public-source-slam.wasm")).status).toBe(404);
  expect(readFile).not.toHaveBeenCalled();
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "PUBLIC_SOURCE");
  const availability = await invoke("availability");
  expect(await availability.json()).toMatchObject({
    localPrototype: true,
    engine: "PUBLIC_SOURCE",
    rebuildableSource: true,
    method: "VISUAL_SLAM",
    productionCleared: false,
    metricScaleVerified: false,
    noticesHref: "/api/dev/parallax-tracker/public-source-slam.NOTICES.txt",
  });
  expect((await invoke("tinyvio-slam.wasm")).status).toBe(404);
  vi.mocked(readFile).mockResolvedValue(Buffer.from("altered public source binary"));
  expect((await invoke("public-source-slam.wasm")).status).toBe(503);
  expect((await invoke("public-source-slam.NOTICES.txt")).status).toBe(503);
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "UNKNOWN");
  expect((await invoke("availability")).status).toBe(503);
});

it("serves the reproducible pinned notices only behind the authenticated prototype gate", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "PUBLIC_SOURCE");
  const source = readFileSync(
    "Development_Docs/Projects/Project_Parallax/reference/browser-slam-evaluation/public-source-prototype.NOTICES.txt",
    "utf8",
  );
  const artifact = Buffer.from(source.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
  vi.mocked(readFile).mockResolvedValue(artifact);
  const response = await invoke("public-source-slam.NOTICES.txt");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(artifact);
});

it("blocks Zappar bytes and startup configuration without an owner entitlement", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "ZAPPAR");
  vi.mocked(readFile).mockRejectedValue(new Error("No owner entitlement"));
  expect(await (await invoke("availability")).json()).toMatchObject({
    localPrototype: false,
    engine: "ZAPPAR",
    productionCleared: false,
  });
  expect((await invoke("zappar-4.4.0.js")).status).toBe(503);
  expect((await invoke("tinyvio-slam.js")).status).toBe(404);
  expect((await invoke("xr8.js")).status).toBe(404);
});

it("keeps the separately authorized 8th Wall engine blocked when its approval or original distribution is absent", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "EIGHTHWALL");
  vi.mocked(readFile).mockRejectedValue(new Error("No private application approval"));
  expect(await (await invoke("availability")).json()).toMatchObject({
    engine: "EIGHTHWALL",
    localPrototype: false,
    productionCleared: false,
  });
  expect((await invoke("xr.js")).status).toBe(404);
  expect((await invoke("tinyvio-slam.js")).status).toBe(404);
  vi.mocked(requirePilotOwner).mockResolvedValue(null);
  expect((await invoke("availability")).status).toBe(404);
});

it("denies proprietary evaluation assets to authenticated non-owner accounts", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "ZAPPAR");
  vi.mocked(requirePilotOwner).mockResolvedValue(null);
  expect((await invoke("availability")).status).toBe(404);
  expect((await invoke("zappar-4.4.0.js")).status).toBe(404);
  expect(readFile).not.toHaveBeenCalled();
});

it("never labels dirty runtime bytes with the clean HEAD source identity", async () => {
  vi.stubEnv("SPATIAL_PILOT_SOURCE_SHA", "a".repeat(40));
  vi.stubEnv("SPATIAL_PILOT_SOURCE_DIRTY", "1");
  expect(await (await invoke("availability")).json()).toMatchObject({ sourceCommit: null, sourceDirty: true });
  vi.stubEnv("SPATIAL_PILOT_SOURCE_DIRTY", "0");
  expect(await (await invoke("availability")).json()).toMatchObject({
    sourceCommit: "a".repeat(40),
    sourceDirty: false,
  });
});

it("serves only the hash-bound Zappar script for the owner-approved exact origin", async () => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "ZAPPAR");
  const binary = Buffer.from("synthetic SDK fixture - not a tracking engine");
  const authorization = {
    schemaVersion: 1,
    sdkVersion: "4.4.0",
    ownerAuthorized: true,
    activeEntitlement: "COMMERCIAL",
    domainAuthorization: "REGISTERED_SELF_HOSTING",
    expiresAt: "2099-01-01T00:00:00Z",
    termsAcceptedByOwner: true,
    permittedOrigins: ["https://example.test"],
    scriptSha256: createHash("sha256").update(binary).digest("hex"),
  };
  vi.mocked(readFile).mockImplementation(async (path) =>
    String(path).endsWith(".private.json") ? JSON.stringify(authorization) : binary,
  );
  const response = await invoke("availability");
  expect(requirePilotOwner).toHaveBeenCalledWith();
  expect(await response.json()).toMatchObject({
    localPrototype: true,
    engine: "ZAPPAR",
    productionCleared: false,
    metricScaleVerified: false,
    zappar: {
      version: "4.4.0",
      scriptUrl: "/api/dev/parallax-tracker/zappar-4.4.0.js",
      integrity: `sha256-${createHash("sha256").update(binary).digest("base64")}`,
    },
  });
  const script = await invoke("zappar-4.4.0.js");
  expect(script.headers.get("cache-control")).toBe("private, no-store");
  expect(await script.text()).toBe(binary.toString());
  authorization.permittedOrigins = ["https://other.example"];
  expect((await invoke("zappar-4.4.0.js")).status).toBe(503);
  authorization.permittedOrigins = ["https://example.test"];
  authorization.scriptSha256 = "0".repeat(64);
  expect((await invoke("zappar-4.4.0.js")).status).toBe(503);
});
