// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { storageKey } from "@/crossdeck/client";
import { CrossdeckDevices } from "./CrossdeckDevices";

beforeEach(() => {
  sessionStorage.setItem(storageKey("voyage"), "surface");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("reactivates an authorized saved surface on Journal mount before the periodic heartbeat", async () => {
  const requests = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? {}
        : {
            csrfToken: "account-session-csrf",
            voyages: [],
            surfaces: [{ surfaceId: "surface", thisSession: true, presence: "DISCONNECTED", role: "PRIMARY_STORY" }],
          },
    ),
  );
  vi.stubGlobal("fetch", requests);
  render(<CrossdeckDevices initialVoyage="voyage" compact />);
  await waitFor(() => expect(requests.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
  const heartbeat = requests.mock.calls.find(([, init]) => init?.method === "POST")![1]!;
  expect(JSON.parse(heartbeat.body as string)).toMatchObject({
    action: "heartbeat",
    surfaceId: "surface",
    lifecycle: "ACTIVE",
  });
  expect(heartbeat.headers).toMatchObject({ "x-csrf-token": "account-session-csrf" });
});

it("does not reactivate a saved surface when its account authority ended", async () => {
  const requests = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ error: "Sign in again" }, { status: 401 }),
  );
  vi.stubGlobal("fetch", requests);
  render(<CrossdeckDevices initialVoyage="voyage" compact />);
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(2));
  expect(requests.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});
