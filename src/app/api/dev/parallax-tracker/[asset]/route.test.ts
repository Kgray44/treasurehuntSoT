import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { pilotEnvironmentEnabled } from "@/spatial-pilot/authorization";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { readFile } from "node:fs/promises";
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
