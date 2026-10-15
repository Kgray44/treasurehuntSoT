// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CrossdeckConnection } from "./useCrossdeckSession";
import { CrossdeckCompanionGateway } from "./CrossdeckCompanionGateway";

const harness = vi.hoisted(() => ({
  connection: {} as CrossdeckConnection,
  hook: vi.fn(),
  privateController: vi.fn(),
  privateUnmount: vi.fn(),
  sharedController: vi.fn(),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { ...props, href }, children),
  };
});
vi.mock("./useCrossdeckSession", () => ({
  useCrossdeckSession: (voyage: string) => {
    harness.hook(voyage);
    return harness.connection;
  },
}));
vi.mock("@/components/player/journal/ChronicleJournalSession", async () => {
  const React = await import("react");
  return {
    ChronicleJournalSession: (props: unknown) => {
      harness.privateController(props);
      React.useEffect(() => () => harness.privateUnmount(), []);
      return React.createElement("main", { "data-testid": "private-journal" }, "Authorized personal Journal");
    },
  };
});
vi.mock("./CrossdeckDisplay", async () => {
  const React = await import("react");
  return {
    CrossdeckDisplay: (props: unknown) => {
      harness.sharedController(props);
      return React.createElement("main", { "data-testid": "crew-display" }, "Restricted crew display");
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  harness.connection = {
    voyage: "voyage",
    ready: true,
    signedOut: false,
    busy: false,
    message: "",
    csrf: "csrf",
    here: { surfaceId: "phone", voyageId: "voyage", thisSession: true, role: "JOURNAL" },
    refresh: vi.fn().mockResolvedValue(undefined),
    setMessage: vi.fn(),
  } as unknown as CrossdeckConnection;
});
afterEach(cleanup);

it.each([
  ["loading", { ready: false }, "Connecting your companion"],
  ["signed out", { signedOut: true }, "Sign in to continue"],
  ["missing surface", { here: undefined }, "Reconnect this device"],
  [
    "another Voyage",
    { here: { surfaceId: "phone", voyageId: "other", thisSession: true, role: "JOURNAL" } },
    "Reconnect this device",
  ],
  [
    "another account session",
    { here: { surfaceId: "phone", voyageId: "voyage", thisSession: false, role: "JOURNAL" } },
    "Reconnect this device",
  ],
])("keeps the personal Journal unmounted while %s", (_description, override, heading) => {
  Object.assign(harness.connection, override);
  render(<CrossdeckCompanionGateway voyageId="voyage" />);
  expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  expect(harness.privateController).not.toHaveBeenCalled();
  expect(harness.sharedController).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Return to Chronicle" })).toHaveAttribute(
    "href",
    "/player/playthroughs/voyage/journal",
  );
});

it("mounts the canonical personal controller only after the tab's matching surface is authorized", () => {
  render(<CrossdeckCompanionGateway voyageId="voyage" />);
  expect(harness.hook).toHaveBeenCalledWith("voyage");
  expect(harness.privateController).toHaveBeenCalledWith({
    sessionId: "voyage",
    identitySession: true,
    companion: harness.connection,
  });
  expect(harness.sharedController).not.toHaveBeenCalled();
});

it("uses only the restricted consumer for a shared role and unmounts private state on a role change", () => {
  harness.connection.here!.role = "SHARED_CREW_DISPLAY";
  const view = render(<CrossdeckCompanionGateway voyageId="voyage" />);
  expect(screen.getByTestId("crew-display")).toBeVisible();
  expect(harness.privateController).not.toHaveBeenCalled();
  expect(harness.sharedController).toHaveBeenCalledWith({ voyageId: "voyage", connection: harness.connection });

  harness.connection.here!.role = "JOURNAL";
  view.rerender(<CrossdeckCompanionGateway voyageId="voyage" />);
  expect(screen.getByTestId("private-journal")).toBeVisible();
  harness.connection.here!.role = "SHARED_CREW_DISPLAY";
  view.rerender(<CrossdeckCompanionGateway voyageId="voyage" />);
  expect(screen.queryByTestId("private-journal")).toBeNull();
  expect(harness.privateUnmount).toHaveBeenCalledOnce();
});

it("offers retry without mounting private state and reports an interrupted retry", async () => {
  harness.connection.here = undefined;
  vi.mocked(harness.connection.refresh).mockRejectedValue(new Error("offline"));
  render(<CrossdeckCompanionGateway voyageId="voyage" />);
  fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));
  await waitFor(() =>
    expect(harness.connection.setMessage).toHaveBeenCalledWith("Connection interrupted. Retry when you are online."),
  );
  expect(harness.privateController).not.toHaveBeenCalled();
});
