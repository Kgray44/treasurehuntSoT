// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { pilotEnvironmentEnabled, requirePilotOwner } from "@/spatial-pilot/authorization";
import { readEighthwallAsset } from "@/parallax/eighthwall-local-assets";

vi.mock("@/spatial-pilot/authorization", () => ({
  pilotEnvironmentEnabled: vi.fn(),
  requirePilotOwner: vi.fn(),
}));
vi.mock("@/parallax/eighthwall-local-assets", () => ({ readEighthwallAsset: vi.fn() }));

function invoke(asset = "media-worker.js", incoming?: Request) {
  // A normal browser resource GET cannot attach a mutation CSRF header.
  const request = new Request("https://private.example.test/api/dev/parallax-tracker/resources/media-worker.js");
  return GET(incoming ?? request, { params: Promise.resolve({ asset }) });
}
beforeEach(() => {
  vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://private.example.test");
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_PROTOTYPE", "1");
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", "EIGHTHWALL");
  vi.mocked(pilotEnvironmentEnabled).mockReturnValue(true);
  vi.mocked(requirePilotOwner).mockResolvedValue({ accountId: "spatial-pilot-navigator" } as never);
  vi.mocked(readEighthwallAsset).mockResolvedValue(null);
});

it("uses the configured licensed origin for resources behind a loopback proxy and ignores forwarded origin headers", async () => {
  const proxyRequest = new Request("https://127.0.0.1:3292/api/dev/parallax-tracker/resources/media-worker.js", {
    headers: {
      "x-forwarded-host": "forged.invalid",
      "x-forwarded-proto": "http",
      forwarded: "host=forged.invalid;proto=http",
    },
  });
  vi.mocked(readEighthwallAsset).mockResolvedValue({
    bytes: Buffer.from("synthetic resource"),
    type: "text/javascript",
  });
  expect((await invoke("media-worker.js", proxyRequest)).status).toBe(200);
  expect(readEighthwallAsset).toHaveBeenCalledExactlyOnceWith(
    "resources/media-worker.js",
    "https://private.example.test",
  );
  expect(requirePilotOwner).toHaveBeenCalledExactlyOnceWith();
});

it("refuses an invalid configured public origin before resource reads", async () => {
  vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://private.example.test/unapproved-path");
  expect((await invoke()).ok).toBe(false);
  expect(readEighthwallAsset).not.toHaveBeenCalled();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it.each(["ZAPPAR", "TINYVIO", "PUBLIC_SOURCE", "UNKNOWN"])(
  "refuses resources when %s is selected before reading authorization or SDK assets",
  async (engine) => {
    vi.stubEnv("PARALLAX_LOCAL_TRACKER_ENGINE", engine);
    expect((await invoke()).status).toBe(404);
    expect(requirePilotOwner).not.toHaveBeenCalled();
    expect(readEighthwallAsset).not.toHaveBeenCalled();
  },
);
it("refuses ordinary servers and disabled prototypes before any owner or asset read", async () => {
  vi.mocked(pilotEnvironmentEnabled).mockReturnValue(false);
  expect((await invoke()).status).toBe(404);
  vi.mocked(pilotEnvironmentEnabled).mockReturnValue(true);
  vi.stubEnv("PARALLAX_LOCAL_TRACKER_PROTOTYPE", "0");
  expect((await invoke()).status).toBe(404);
  expect(requirePilotOwner).not.toHaveBeenCalled();
  expect(readEighthwallAsset).not.toHaveBeenCalled();
});
it("refuses anonymous and other-account requests before reading a proprietary resource", async () => {
  vi.mocked(requirePilotOwner).mockResolvedValue(null);
  const response = await invoke();
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("");
  expect(readEighthwallAsset).not.toHaveBeenCalled();
});
it.each([
  ["media-worker.js", "text/javascript"],
  ["powered-by.svg", "image/svg+xml"],
] as const)(
  "serves the authorized %s through a header-free owner GET with private response headers",
  async (asset, type) => {
    const bytes = Buffer.from("synthetic route-test resource; no SDK bytes");
    vi.mocked(readEighthwallAsset).mockResolvedValue({ bytes, type });
    const response = await invoke(asset);
    expect(requirePilotOwner).toHaveBeenCalledExactlyOnceWith();
    expect(readEighthwallAsset).toHaveBeenCalledExactlyOnceWith(`resources/${asset}`, "https://private.example.test");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(type);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  },
);
it.each(["unknown.js", "../../authorization.private.json"])(
  "returns no bytes when the asset authority rejects %s",
  async (asset) => {
    const response = await invoke(asset);
    expect(readEighthwallAsset).toHaveBeenCalledExactlyOnceWith(`resources/${asset}`, "https://private.example.test");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  },
);
