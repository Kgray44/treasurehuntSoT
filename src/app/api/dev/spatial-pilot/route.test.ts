// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";
import { requirePilotOwner } from "@/spatial-pilot/authorization";
import { provisionPilot } from "@/spatial-pilot/service";
import { provisionRoomTest } from "@/spatial-pilot/room-test";
import { apiError } from "@/chronicle/api";

vi.mock("@/spatial-pilot/authorization", () => ({ requirePilotOwner: vi.fn() }));
vi.mock("@/spatial-pilot/service", () => ({ provisionPilot: vi.fn() }));
vi.mock("@/spatial-pilot/room-test", () => ({
  roomTestKinds: ["CLASSROOM", "CLUTTERED", "HAUNTED_BEDROOM"],
  provisionRoomTest: vi.fn(),
}));
vi.mock("@/chronicle/api", () => ({ apiError: vi.fn() }));

const reviewedDigest = "a".repeat(64);
function incoming(action: string) {
  return new Request("https://127.0.0.1:3292/api/dev/spatial-pilot", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": "synthetic-csrf",
      "x-forwarded-host": "forged.invalid",
      "x-forwarded-proto": "http",
      forwarded: "host=forged.invalid;proto=http",
    },
    body: JSON.stringify({
      action,
      ...(action === "room-test" ? { room: "HAUNTED_BEDROOM", reviewedObservationSha256: reviewedDigest } : {}),
    }),
  });
}
beforeEach(() => {
  vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://private.example.test");
  vi.mocked(requirePilotOwner).mockResolvedValue({ accountId: "spatial-pilot-navigator" } as never);
  vi.mocked(provisionPilot).mockResolvedValue({ taleId: "synthetic-chronicle" } as never);
  vi.mocked(provisionRoomTest).mockResolvedValue({ taleId: "synthetic-room-chronicle" } as never);
  vi.mocked(apiError).mockImplementation(() =>
    NextResponse.json({ error: "Synthetic unavailable configuration" }, { status: 503 }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it.each(["provision", "replay", "room-test"] as const)(
  "uses the configured HTTPS origin for %s despite internal request URL and forged forwarding headers",
  async (action) => {
    const request = incoming(action);
    const response = await POST(request);
    expect(requirePilotOwner).toHaveBeenCalledExactlyOnceWith(request); // Mutation CSRF/session authority remains request-bound.
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    if (action === "room-test") {
      expect(provisionRoomTest).toHaveBeenCalledExactlyOnceWith(
        "spatial-pilot-navigator",
        "https://private.example.test",
        "HAUNTED_BEDROOM",
        reviewedDigest,
      );
      expect(provisionPilot).not.toHaveBeenCalled();
    } else {
      expect(provisionPilot).toHaveBeenCalledExactlyOnceWith(
        "spatial-pilot-navigator",
        "https://private.example.test",
        action === "replay",
      );
      expect(provisionRoomTest).not.toHaveBeenCalled();
    }
    expect(apiError).not.toHaveBeenCalled();
  },
);
it.each(["provision", "replay", "room-test"] as const)(
  "fails closed before %s provisioning when canonical origin configuration is invalid",
  async (action) => {
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://private.example.test/unapproved-path");
    const response = await POST(incoming(action));
    expect(response.ok).toBe(false);
    expect(provisionPilot).not.toHaveBeenCalled();
    expect(provisionRoomTest).not.toHaveBeenCalled();
    expect(apiError).toHaveBeenCalledOnce();
  },
);
it("keeps owner/CSRF authorization ahead of all pilot provisioning", async () => {
  vi.mocked(requirePilotOwner).mockResolvedValue(null);
  expect((await POST(incoming("provision"))).status).toBe(404);
  expect(provisionPilot).not.toHaveBeenCalled();
  expect(provisionRoomTest).not.toHaveBeenCalled();
  expect(apiError).not.toHaveBeenCalled();
});
