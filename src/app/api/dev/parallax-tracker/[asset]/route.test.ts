import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { pilotEnvironmentEnabled } from "@/spatial-pilot/authorization";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
vi.mock("@/spatial-pilot/authorization", () => ({ pilotEnvironmentEnabled: vi.fn() }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: vi.fn() }));
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  const readFile = vi.fn();
  return { ...actual, readFile, default: { ...actual, readFile } };
});
const request = new Request("https://example.test/api/dev/parallax-tracker/availability");
const invoke = (asset: string) => GET(request, { params: Promise.resolve({ asset }) });
beforeEach(() => {
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_PROTOTYPE", "1");
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "TINYVIO");
  vi.mocked(pilotEnvironmentEnabled).mockReturnValue(true);
  vi.mocked(requireWayfarerAccount).mockResolvedValue({ accountId: "synthetic-owner" } as never);
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
