// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CrossdeckDisplay } from "./CrossdeckDisplay";
import { storageKey } from "@/crossdeck/client";
import type { ObjectRef } from "@/crossdeck/sync-contracts";
const mocks = vi.hoisted(() => ({ resume: null as null | ((object: ObjectRef) => Promise<void>) }));
vi.mock("./CrossdeckHandoff", () => ({
  CrossdeckHandoff: (props: { resume: typeof mocks.resume }) => {
    mocks.resume = props.resume;
    return null;
  },
}));
vi.mock("@/landfall/map-renderer", () => ({ LandfallMapRenderer: () => null }));
const ref = (id: string): ObjectRef => ({ family: "ARTIFACT", objectId: id, version: "released" });
const reading = (title: string) => new Response(JSON.stringify({ title, text: "Synthetic crew content", context: {} }));
beforeEach(() => {
  mocks.resume = null;
  sessionStorage.setItem(storageKey("first"), "surface");
  sessionStorage.setItem(storageKey("second"), "surface");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
function setup() {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  let olderRequests = 0;
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    void init;
    return url.includes("/api/crossdeck/view?")
      ? url.includes("object=old")
        ? olderRequests++ === 0
          ? pending
          : Promise.resolve(reading("Obsolete view"))
        : Promise.resolve(reading("Current view"))
      : Promise.resolve(
          new Response(
            JSON.stringify({ csrfToken: "csrf", surfaces: [{ surfaceId: "surface", role: "SHARED_CREW_DISPLAY" }] }),
          ),
        );
  });
  vi.stubGlobal("fetch", fetcher);
  return { finish, fetcher };
}
it("keeps an older asynchronous crew-view response from overwriting a newer presentation", async () => {
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" />);
  await act(async () => {});
  let obsolete!: Promise<void>;
  await act(async () => {
    obsolete = mocks.resume!(ref("old")).catch(() => {});
  });
  await act(async () => mocks.resume!(ref("new")));
  expect(screen.getByRole("heading", { name: "Current view" })).toBeInTheDocument();
  await act(async () => {
    f.finish(reading("Obsolete view"));
    await obsolete;
  });
  expect(screen.queryByRole("heading", { name: "Obsolete view" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Current view" })).toBeInTheDocument();
});
it("aborts and clears old crew presentation across Voyage replacement", async () => {
  const f = setup();
  const view = render(<CrossdeckDisplay voyageId="first" />);
  await act(async () => {});
  let obsolete!: Promise<void>;
  await act(async () => {
    obsolete = mocks.resume!(ref("old")).catch(() => {});
  });
  view.rerender(<CrossdeckDisplay voyageId="second" />);
  await act(async () => {
    f.finish(reading("First Voyage view"));
    await obsolete;
  });
  expect(screen.queryByRole("heading", { name: "First Voyage view" })).not.toBeInTheDocument();
  const call = f.fetcher.mock.calls.find(([url]) => url.includes("object=old"));
  expect((call?.[1] as RequestInit | undefined)?.signal?.aborted).toBe(true);
});
it("aborts a pending crew view when periodic authorization fails", async () => {
  vi.useFakeTimers();
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" />);
  await act(async () => {});
  let obsolete!: Promise<void>;
  await act(async () => {
    obsolete = mocks.resume!(ref("old")).catch(() => {});
  });
  const previous = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation((url, init) =>
    url.startsWith("/api/crossdeck?")
      ? Promise.resolve(new Response(JSON.stringify({ error: "access ended" }), { status: 403 }))
      : previous(url, init),
  );
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  await act(async () => {
    f.finish(reading("Revoked view"));
    await obsolete;
  });
  expect(screen.queryByRole("heading", { name: "Revoked view" })).not.toBeInTheDocument();
  const call = f.fetcher.mock.calls.find(([url]) => url.includes("object=old"));
  expect((call?.[1] as RequestInit | undefined)?.signal?.aborted).toBe(true);
});
