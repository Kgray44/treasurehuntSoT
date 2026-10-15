// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { storageKey } from "@/crossdeck/client";
import { useCrossdeckSession } from "./useCrossdeckSession";

const surface = { surfaceId: "phone", voyageId: "voyage", thisSession: true, role: "JOURNAL", label: "Phone" };
const metadata = (role = "JOURNAL") =>
  Response.json({ csrfToken: "synthetic-csrf", voyages: [], surfaces: [{ ...surface, role }] });
beforeEach(() => {
  sessionStorage.setItem(storageKey("voyage"), surface.surfaceId);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("preserves a device name entered before browser sizing supplies the default", async () => {
  let initialFrame: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    initialFrame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("fetch", async () => metadata());
  const { result } = renderHook(() => useCrossdeckSession("voyage"));
  await act(async () => {
    result.current.setLabel("Desktop");
  });
  await act(async () => {
    initialFrame!(0);
  });
  expect(result.current.label).toBe("Desktop");
});

it("keeps delayed pre-command metadata from replacing the committed purpose and blocks mid-command refresh", async () => {
  let lateGet: ((response: Response) => void) | undefined;
  let finishCommand: ((response: Response) => void) | undefined;
  let currentRole = "JOURNAL";
  let holdGet = false;
  const requests = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      if (body.action === "role")
        return new Promise((resolve) => {
          finishCommand = resolve;
        });
      return Response.json({});
    }
    if (holdGet)
      return new Promise((resolve) => {
        lateGet = resolve;
      });
    return metadata(currentRole);
  });
  vi.stubGlobal("fetch", requests);
  const { result } = renderHook(() => useCrossdeckSession("voyage"));
  await waitFor(() => expect(result.current.here?.role).toBe("JOURNAL"));
  await waitFor(() => expect(requests.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2));
  holdGet = true;
  let staleRefresh: Promise<void>;
  await act(async () => {
    staleRefresh = result.current.refresh();
  });
  let command: ReturnType<typeof result.current.act>;
  await act(async () => {
    command = result.current.act({ action: "role", surfaceId: "phone", role: "CHART" }, "Chart ready");
  });
  await waitFor(() => expect(finishCommand).toBeDefined());
  const count = requests.mock.calls.length;
  await act(async () => {
    await result.current.refresh();
  });
  expect(requests).toHaveBeenCalledTimes(count);
  holdGet = false;
  currentRole = "CHART";
  await act(async () => {
    finishCommand!(Response.json({ surface: { ...surface, role: "CHART" } }));
    await command;
    lateGet!(metadata("JOURNAL"));
    await staleRefresh;
  });
  expect(result.current.here?.role).toBe("CHART");
  expect(sessionStorage.getItem(storageKey("voyage"))).toBe("phone");
});
