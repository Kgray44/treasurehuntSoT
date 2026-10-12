// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { storageKey } from "@/crossdeck/client";
import { CrossdeckDevices } from "./CrossdeckDevices";
import { VoyageContext } from "./VoyageContext";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,synthetic") } }));
vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({
      src,
      alt,
      width,
      height,
      className,
    }: {
      src: string;
      alt: string;
      width: number;
      height: number;
      className?: string;
    }) => React.createElement("img", { src, alt, width, height, className }),
  };
});

const savedSurface = {
  surfaceId: "surface",
  surfaceSessionId: "membership-surface",
  voyageId: "voyage",
  voyageTitle: "Northern Light",
  thisSession: true,
  presence: "ACTIVE",
  role: "PRIMARY_STORY",
  label: "This computer",
};
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
  router.push.mockClear();
  sessionStorage.setItem(storageKey("voyage"), "surface");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

it("replaces a failed pairing intent when a new QR opens in the same phone tab", async () => {
  sessionStorage.setItem(
    "crossdeck.pending-pair.v1",
    JSON.stringify({ code: "ABCD1234", expires: Date.now() + 60_000 }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ csrfToken: "csrf", voyages: [], surfaces: [] })),
  );
  render(<CrossdeckDevices pairing />);
  const input = await screen.findByRole("textbox", { name: "Connection code" });
  await waitFor(() => expect(input).toHaveValue("ABCD1234"));
  history.replaceState(null, "", location.pathname + "#code=1234ABCD");
  fireEvent(window, new HashChangeEvent("hashchange"));
  await waitFor(() => expect(input).toHaveValue("1234ABCD"));
  expect(location.hash).toBe("");
  expect(JSON.parse(sessionStorage.getItem("crossdeck.pending-pair.v1")!).code).toBe("1234ABCD");
});

it("reactivates an authorized saved surface on Journal mount before the periodic heartbeat", async () => {
  const requests = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? {}
        : {
            csrfToken: "account-session-csrf",
            voyages: [],
            surfaces: [{ ...savedSurface, presence: "DISCONNECTED" }],
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
  expect(sessionStorage.getItem(storageKey("voyage"))).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Connect another device" }));
  expect(screen.getByRole("link", { name: "Sign in" })).toBeVisible();
});

it("fences background heartbeats after page exit and reactivates a restored browser page", async () => {
  const requests = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? {}
        : {
            csrfToken: "account-session-csrf",
            voyages: [],
            surfaces: [savedSurface],
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

it("connects directly from the open Chronicle and restores the reader's focus when the dialog closes", async () => {
  const requests = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return Response.json(
        body.action === "challenge"
          ? { code: "ABCD-1234", expiresAt: new Date(Date.now() + 60_000).toISOString() }
          : {},
      );
    }
    return Response.json(
      String(url).startsWith("/api/crossdeck")
        ? { csrfToken: "account-session-csrf", voyages: [], surfaces: [savedSurface] }
        : { available: false, journal: { chapters: [] } },
    );
  });
  vi.stubGlobal("fetch", requests);
  render(
    <CrossdeckDevices
      initialVoyage="voyage"
      compact
      voyageContext={{ voyageId: "voyage", versionId: "released-edition", title: "Northern Light" }}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Connect another device" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  const context = within(dialog).getByRole("region", { name: "Voyage context" });
  expect(context).toHaveTextContent("Northern Light");
  expect(context).toHaveAttribute("data-experience-voyage", "voyage");
  expect(context).toHaveAttribute("data-experience-version", "released-edition");
  expect(within(dialog).getByRole("heading", { name: "Bring your phone aboard" })).toBeVisible();
  expect(await within(dialog).findByAltText("Scan with your phone to join this Chronicle")).toBeVisible();
  expect(router.push).not.toHaveBeenCalled();
  expect(
    requests.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init!.body)).action),
  ).toEqual(["heartbeat", "challenge"]);
  fireEvent.click(within(dialog).getByText("Use a code instead"));
  expect(within(dialog).getByText("ABCD-1234")).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue the Chronicle" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("region", { name: "Voyage context" })).toBeNull();
  expect(trigger).toHaveFocus();
});

it("restores a still-mounted parent identity when the open compact connection is removed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return Response.json(
          body.action === "register"
            ? { surface: { ...savedSurface, surfaceId: body.surfaceId } }
            : { code: "ABCD-1234", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        );
      }
      return Response.json({ csrfToken: "csrf", voyages: [], surfaces: [savedSurface] });
    }),
  );
  const voyage = { voyageId: "voyage", versionId: "edition", title: "Northern Light" };
  function Parent({ showConnection }: { showConnection: boolean }) {
    const [presented, setPresented] = useState(false);
    return (
      <>
        <div aria-hidden={presented} inert={presented ? true : undefined}>
          <VoyageContext voyage={voyage} heading />
        </div>
        {showConnection && (
          <CrossdeckDevices initialVoyage="voyage" compact voyageContext={voyage} onPresentationChange={setPresented} />
        )}
      </>
    );
  }
  const view = render(<Parent showConnection />);
  const identity = screen.getByRole("region", { name: "Voyage context" });
  const trigger = screen.getByRole("button", { name: "Connect another device" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Bring your phone aboard" });
  expect(screen.getAllByRole("region", { name: "Voyage context" })).toEqual([
    within(dialog).getByRole("region", { name: "Voyage context" }),
  ]);
  expect(identity.closest('[aria-hidden="true"][inert]')).not.toBeNull();
  view.rerender(<Parent showConnection={false} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getAllByRole("region", { name: "Voyage context" })).toEqual([identity]);
  expect(identity.closest('[aria-hidden="true"],[inert]')).toBeNull();
});

it.each([
  { voyageId: "another-voyage", signedOut: false },
  { voyageId: "voyage", signedOut: true },
])(
  "does not project a private Voyage context outside its authorized connection ($voyageId/$signedOut)",
  async ({ voyageId, signedOut }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        signedOut
          ? Response.json({ error: "Sign in again" }, { status: 401 })
          : Response.json({ csrfToken: "csrf", voyages: [], surfaces: [savedSurface] }),
      ),
    );
    render(
      <CrossdeckDevices
        initialVoyage="voyage"
        compact
        voyageContext={{ voyageId, versionId: "other-edition", title: "Another private Chronicle" }}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Connect another device" });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Bring your phone aboard" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Voyage context" })).toBeNull();
    expect(screen.queryByText("Another private Chronicle")).toBeNull();
  },
);

it("automatically registers a new authorized primary screen before creating its connection code", async () => {
  sessionStorage.clear();
  let registered: typeof savedSurface | undefined;
  const requests = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      if (body.action === "register") {
        registered = { ...savedSurface, surfaceId: body.surfaceId };
        return Response.json({ surface: registered });
      }
      return Response.json(
        body.action === "challenge"
          ? { code: "ABCD-1234", expiresAt: new Date(Date.now() + 60_000).toISOString() }
          : {},
      );
    }
    return Response.json(
      String(url).startsWith("/api/crossdeck")
        ? { csrfToken: "account-session-csrf", voyages: [], surfaces: registered ? [registered] : [] }
        : { available: false, journal: { chapters: [] } },
    );
  });
  vi.stubGlobal("fetch", requests);
  render(<CrossdeckDevices initialVoyage="voyage" compact />);
  const trigger = screen.getByRole("button", { name: "Connect another device" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  await screen.findByAltText("Scan with your phone to join this Chronicle");
  const actions = requests.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init!.body)));
  expect(actions.filter((body) => body.action === "register")).toHaveLength(1);
  expect(actions.find((body) => body.action === "register")).toMatchObject({ voyageId: "voyage" });
  expect(actions.find((body) => body.action === "challenge")).toMatchObject({
    surfaceId: registered!.surfaceId,
    role: "JOURNAL",
  });
  expect(sessionStorage.getItem(storageKey("voyage"))).toBe(registered!.surfaceId);
});

it.each(["JOURNAL", "SHARED_CREW_DISPLAY"])(
  "claims an authorized %s surface and opens its dedicated destination",
  async (role) => {
    sessionStorage.clear();
    let claimed: typeof savedSurface | undefined;
    const requests = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (body.action === "claim") {
          claimed = { ...savedSurface, surfaceId: body.surfaceId, role };
          return Response.json({ surface: claimed });
        }
        return Response.json({});
      }
      return Response.json(
        String(url).startsWith("/api/crossdeck")
          ? { csrfToken: "account-session-csrf", voyages: [], surfaces: claimed ? [claimed] : [] }
          : { available: false, journal: { chapters: [] } },
      );
    });
    vi.stubGlobal("fetch", requests);
    render(<CrossdeckDevices pairing />);
    const input = await screen.findByRole("textbox", { name: "Connection code" });
    fireEvent.change(input, { target: { value: "abcd-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Join the Chronicle" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        role === "SHARED_CREW_DISPLAY" ? "/devices/display?voyage=voyage" : "/devices/companion?voyage=voyage",
      ),
    );
    const claim = requests.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init!.body)))
      .find((body) => body.action === "claim");
    expect(claim).toMatchObject({ code: "ABCD-1234" });
    expect(sessionStorage.getItem(storageKey("voyage"))).toBe(claimed!.surfaceId);
  },
);
