// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
  const devices = screen.getByRole("link", { name: "Devices", exact: true });
  const description = document.getElementById(devices.getAttribute("aria-describedby")!);
  expect(description?.textContent).toContain("0 connected");
  expect(devices.textContent).toContain("0 connected");
  expect(devices.getAttribute("data-voyage-id")).toBe("voyage");
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

it("fences background heartbeats after page exit and reactivates a restored browser page", async () => {
  const requests = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? {}
        : {
            csrfToken: "account-session-csrf",
            voyages: [],
            surfaces: [{ surfaceId: "surface", thisSession: true, presence: "ACTIVE", role: "PRIMARY_STORY" }],
          },
    ),
  );
  vi.stubGlobal("fetch", requests);
  render(<CrossdeckDevices initialVoyage="voyage" compact />);
  const posts = () => requests.mock.calls.filter(([, init]) => init?.method === "POST");
  await waitFor(() => expect(posts()).toHaveLength(1));
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(posts()).toHaveLength(2);
  expect(JSON.parse(posts()[1][1]!.body as string).lifecycle).toBe("DISCONNECTED");
  expect(posts()[1][1]!.keepalive).toBe(true);
  await act(async () => {
    const returned = new Event("pageshow");
    Object.defineProperty(returned, "persisted", { value: true });
    window.dispatchEvent(returned);
  });
  await waitFor(() => expect(posts()).toHaveLength(3));
  expect(JSON.parse(posts()[2][1]!.body as string).lifecycle).toBe("ACTIVE");
});
