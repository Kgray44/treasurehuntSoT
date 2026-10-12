// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PlayerJournalBlock } from "@/chronicle/journal-contract";
import type { SessionState } from "@/components/player/journal/ChronicleJournalSession";
import type { Continuity, ObjectRef, TransferMode } from "@/crossdeck/sync-contracts";
import { syntheticBinding, syntheticSpatialMoment } from "@/parallax/fixtures";
import type { CrossdeckConnection } from "./useCrossdeckSession";
import type { CrossdeckSyncConnection } from "./CrossdeckHandoff";
import { CrossdeckCompanion } from "./CrossdeckCompanion";

type Resume = (
  ref: ObjectRef,
  context: Continuity,
  policy?: { mode: TransferMode; readOnly: boolean },
) => Promise<void>;
const harness = vi.hoisted(() => ({
  available: true,
  mapReady: true,
  bridgeReady: true,
  provider: {} as { enabled: boolean; historical: boolean; publishedVersionId: string; csrfToken: string },
  bridge: { current: null as null | { capture: () => Continuity; resume: (context: Continuity) => void } },
  chart: {} as { compact?: boolean; presentationOnly?: boolean; readOnly?: boolean },
  resume: undefined as Resume | undefined,
  syncConnection: "live" as CrossdeckSyncConnection,
  onConnectionChange: undefined as undefined | ((connection: CrossdeckSyncConnection) => void),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { ...props, href }, children),
  };
});
vi.mock("./CrossdeckContinuity", () => ({ useCrossdeckContinuity: () => harness.bridge }));
vi.mock("./CrossdeckHandoff", async () => {
  const React = await import("react");
  return {
    CrossdeckHandoff: ({
      resume,
      onConnectionChange,
    }: {
      resume: Resume;
      onConnectionChange?: (connection: CrossdeckSyncConnection) => void;
    }) => {
      harness.resume = resume;
      harness.onConnectionChange = onConnectionChange;
      React.useEffect(() => onConnectionChange?.(harness.syncConnection), [onConnectionChange]);
      return null;
    },
  };
});
vi.mock("@/components/player/journal/LandfallJournalChart", async () => {
  const React = await import("react");
  return {
    LandfallJournalProvider: (
      props: typeof harness.provider & { children: ReactNode; onAvailabilityChange: (available: boolean) => void },
    ) => {
      harness.provider = props;
      const { onAvailabilityChange } = props;
      React.useEffect(() => onAvailabilityChange(harness.available), [onAvailabilityChange]);
      return props.children;
    },
    LandfallJournalChart: (props: typeof harness.chart) => {
      harness.chart = props;
      React.useEffect(() => {
        if (harness.bridgeReady) harness.bridge.current = { capture: () => ({}), resume: () => {} };
        return () => {
          harness.bridge.current = null;
        };
      }, []);
      return harness.mapReady
        ? React.createElement(
            "div",
            { "aria-label": "Virtual Landfall chart" },
            "Current objective: Reach the northern light",
          )
        : React.createElement("p", null, "Loading the canonical chart");
    },
  };
});

function block(
  id: string,
  kind: PlayerJournalBlock["journalKind"],
  text: string,
  overrides: Partial<PlayerJournalBlock> = {},
): PlayerJournalBlock {
  return {
    id,
    chapterId: "chapter",
    blockType: "narrative",
    journalKind: kind,
    title: `Released ${id}`,
    orderIndex: 0,
    configuration: { body: text },
    presentation: { spreadMode: "two-page" },
    connections: [],
    progress: "released",
    releasedAt: "2026-10-11T00:00:00Z",
    completedAt: null,
    selectedTargetId: null,
    ...overrides,
  };
}
const note = block(
  "note",
  "story",
  "A first released bearing.\n\nA second released bearing.\n\nThe complete third bearing.",
);
const chart = block("map", "map", "Use this course to reach the northern light.", { blockType: "livingChart" });
const artifact = block("artifact", "artifact", "The released brass compass points toward the old harbor.");
const spatial = block(syntheticBinding.blockId, "story", "The stars hold the next clue.", {
  progress: "active",
  presentation: { spatialMoment: syntheticSpatialMoment(), spreadMode: "right" },
});
const blocks = [note, chart, artifact, spatial];
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
function state(): SessionState {
  return {
    csrfToken: "canonical-csrf",
    session: {
      id: syntheticBinding.sessionId,
      versionId: syntheticBinding.chronicleVersionId,
      status: "ACTIVE",
      previewMode: false,
      versionLabel: "Released edition",
      versionPublishedAt: null,
      versionChecksum: null,
      currentSequence: 4,
      startedAt: "2026-10-11T00:00:00Z",
      updatedAt: "2026-10-11T00:00:00Z",
      completedAt: null,
    },
    tale: { title: "The Northern Light", slug: "north", subtitle: null, shortDescription: null },
    chapter: null,
    block: null,
    pendingVerification: null,
    assets: [],
    journal: {
      mode: "active",
      currentBlockId: note.id,
      currentChapterId: "chapter",
      chapters: [{ id: "chapter", title: "Released bearings", subtitle: null, orderIndex: 0, blocks }],
    },
  };
}
function connection(role = "JOURNAL"): CrossdeckConnection {
  return {
    voyage: syntheticBinding.sessionId,
    csrf: "connection-csrf",
    ready: true,
    signedOut: false,
    busy: false,
    message: "",
    here: { surfaceId: "phone", voyageId: syntheticBinding.sessionId, role, thisSession: true, label: "My phone" },
    act: vi.fn().mockResolvedValue({ surface: { surfaceId: "phone" } }),
    setMessage: vi.fn(),
    refresh: vi.fn(),
  } as unknown as CrossdeckConnection;
}
function props(currentConnection = connection()) {
  return {
    state: state(),
    blocks,
    assets: [],
    mode: "reduced" as const,
    connection: currentConnection,
    liveConnection: "live" as const,
    liveNotice: "Current Voyage checked",
    error: "",
    onRefresh: vi.fn(),
  };
}

beforeEach(() => {
  harness.available = true;
  harness.mapReady = true;
  harness.bridgeReady = true;
  harness.bridge.current = null;
  harness.resume = undefined;
  harness.syncConnection = "live";
  harness.onConnectionChange = undefined;
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
      this.querySelector<HTMLElement>("button")?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 360, height: 500 } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

it("renders the complete selected released passage and keeps reading controls local to this companion", () => {
  const current = connection();
  const view = render(<CrossdeckCompanion {...props(current)} />);
  expect(screen.getByText("The complete third bearing.")).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Released passage" }), { target: { value: artifact.id } });
  expect(screen.getByText("The released brass compass points toward the old harbor.")).toBeVisible();
  expect(screen.queryByText("The complete third bearing.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use larger reading size" }));
  expect(screen.getByRole("article", { name: artifact.title })).toHaveStyle({ fontSize: "1.2rem" });
  expect(current.act).not.toHaveBeenCalled();
  expect(view.container.querySelector("main")).toHaveAttribute(
    "data-experience-version",
    syntheticBinding.chronicleVersionId,
  );
  expect(view.container.querySelector("main")).toHaveAttribute("data-experience-voyage", syntheticBinding.sessionId);
  expect(screen.getByRole("link", { name: "Return to Chronicle" })).toHaveAttribute(
    "href",
    `/player/playthroughs/${syntheticBinding.sessionId}/journal`,
  );
});

it("switches purpose through server participation and waits for the authorized role before replacing content", async () => {
  const current = connection();
  const view = render(<CrossdeckCompanion {...props(current)} />);
  const purposeMenu = screen.getByText("Change companion purpose").closest("details")!;
  const moreMenu = screen.getByText("More purposes").closest("details")!;
  fireEvent.click(screen.getByText("Change companion purpose"));
  fireEvent.click(screen.getByText("More purposes"));
  fireEvent.click(screen.getByRole("button", { name: "Voyage Chart" }));
  await waitFor(() =>
    expect(current.act).toHaveBeenCalledWith({ action: "role", surfaceId: "phone", role: "CHART" }, expect.any(String)),
  );
  expect(screen.getByRole("region", { name: "Journal companion" })).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(purposeMenu).toHaveAttribute("open");
  current.here!.role = "CHART";
  view.rerender(<CrossdeckCompanion {...props(current)} />);
  expect(screen.getByText("Current objective: Reach the northern light")).toBeVisible();
  expect(purposeMenu).not.toHaveAttribute("open");
  expect(moreMenu).not.toHaveAttribute("open");
  await waitFor(() => expect(screen.getByRole("heading", { name: "Voyage Chart" })).toHaveFocus());
  expect(harness.chart).toMatchObject({ compact: true });
  expect(harness.provider).toMatchObject({
    enabled: true,
    historical: false,
    publishedVersionId: syntheticBinding.chronicleVersionId,
  });
});

it("waits for the complete purpose mutation before accepting a released passage selection", async () => {
  const current = connection("ARTIFACT_VIEWER");
  let finishAction!: (value: Awaited<ReturnType<CrossdeckConnection["act"]>>) => void;
  const pendingAction = new Promise<Awaited<ReturnType<CrossdeckConnection["act"]>>>((resolve) => {
    finishAction = resolve;
  });
  vi.mocked(current.act).mockReturnValue(pendingAction);
  const currentState = state();
  currentState.journal.currentBlockId = chart.id;
  const currentProps = { ...props(current), state: currentState };
  const view = render(<CrossdeckCompanion {...currentProps} />);
  fireEvent.click(screen.getByText("Change companion purpose"));
  fireEvent.click(screen.getByRole("button", { name: "Journal companion" }));
  expect(current.act).toHaveBeenCalledWith({ action: "role", surfaceId: "phone", role: "JOURNAL" }, expect.any(String));
  // The role response can render before the hook's post-mutation refresh finishes.
  current.busy = true;
  current.here!.role = "JOURNAL";
  view.rerender(<CrossdeckCompanion {...currentProps} />);
  const passage = screen.getByRole("combobox", { name: "Released passage" });
  expect(screen.getByRole("region", { name: "Journal companion" })).toBeVisible();
  expect(passage).toHaveValue(chart.id);
  expect(passage).toBeDisabled();
  await act(async () => {
    finishAction({});
    await pendingAction;
  });
  current.busy = false;
  view.rerender(<CrossdeckCompanion {...currentProps} />);
  expect(passage).toBeEnabled();
  fireEvent.change(passage, { target: { value: note.id } });
  await waitFor(() => expect(screen.getByRole("article", { name: note.title })).toBeVisible());
  view.rerender(<CrossdeckCompanion {...currentProps} />);
  expect(passage).toHaveValue(note.id);
  expect(screen.getByText("The complete third bearing.")).toBeVisible();
});

it("preserves the selected released passage when a purpose mutation fails", async () => {
  const current = connection();
  let finishAction!: (value: Awaited<ReturnType<CrossdeckConnection["act"]>>) => void;
  const pendingAction = new Promise<Awaited<ReturnType<CrossdeckConnection["act"]>>>((resolve) => {
    finishAction = resolve;
  });
  vi.mocked(current.act).mockReturnValue(pendingAction);
  const currentProps = props(current);
  const view = render(<CrossdeckCompanion {...currentProps} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Released passage" }), {
    target: { value: artifact.id },
  });
  fireEvent.click(screen.getByText("Change companion purpose"));
  fireEvent.click(screen.getByRole("button", { name: "Voyage Chart" }));
  current.busy = true;
  view.rerender(<CrossdeckCompanion {...currentProps} />);
  expect(screen.getByRole("combobox", { name: "Released passage" })).toBeDisabled();
  await act(async () => {
    finishAction(undefined);
    await pendingAction;
  });
  current.busy = false;
  view.rerender(<CrossdeckCompanion {...currentProps} />);
  const passage = screen.getByRole("combobox", { name: "Released passage" });
  expect(passage).toBeEnabled();
  expect(passage).toHaveValue(artifact.id);
  expect(screen.getByRole("article", { name: artifact.title })).toBeVisible();
  expect(screen.getByText("Change companion purpose").closest("details")).toHaveAttribute("open");
});

it("opens the canonical Lens automatically with meaningful camera-free content and authenticated nonauthoritative receipts", async () => {
  const requests = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? {}
        : { moment: spatial.presentation.spatialMoment, binding: syntheticBinding, replayOnly: false },
    ),
  );
  vi.stubGlobal("fetch", requests);
  const current = connection();
  const view = render(<CrossdeckCompanion {...props(current)} />);
  fireEvent.click(screen.getByText("Change companion purpose"));
  fireEvent.click(screen.getByRole("button", { name: "Chronicle Lens" }));
  await waitFor(() => expect(current.act).toHaveBeenCalled());
  current.here!.role = "CHRONICLE_LENS";
  view.rerender(<CrossdeckCompanion {...props(current)} />);
  const dialog = await screen.findByRole("dialog", { name: "A message between worlds" });
  expect(await within(dialog).findByText(/The next bearing is written in the stars/)).toBeVisible();
  expect(within(dialog).getByText("This device uses Guided View for this spatial moment.")).toBeVisible();
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(screen.getByText("Change companion purpose").closest("details")).not.toHaveAttribute("open");
  expect(requests.mock.calls[0][0]).toBe(
    `/api/player/playthroughs/${syntheticBinding.sessionId}/parallax?block=${syntheticBinding.blockId}`,
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Inspect" }));
  await waitFor(() => expect(requests.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
  const receipt = requests.mock.calls.find(([, init]) => init?.method === "POST")![1]!;
  expect(receipt.headers).toMatchObject({ "x-csrf-token": "canonical-csrf" });
  expect(JSON.parse(String(receipt.body))).toMatchObject({ authority: "NONAUTHORITATIVE", mode: "GUIDED" });
});

it("presents released artifact content and truthfully disables purposes whose projections are unavailable", () => {
  harness.available = false;
  const currentProps = { ...props(connection("ARTIFACT_VIEWER")), blocks: [note, artifact] };
  render(<CrossdeckCompanion {...currentProps} />);
  expect(screen.getByText("The released brass compass points toward the old harbor.")).toBeVisible();
  fireEvent.click(screen.getByText("Change companion purpose"));
  expect(screen.getByRole("button", { name: "Chronicle Lens" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Voyage Chart" })).toBeDisabled();
  fireEvent.click(screen.getByText("More purposes"));
  expect(screen.getByRole("button", { name: "Creator preview" })).toBeDisabled();
  expect(screen.getByText("Use the existing Creator preview in Studio.")).toBeVisible();
});

it("keeps a received passive map on the current projection and waits for its real DOM and bridge", async () => {
  vi.useFakeTimers();
  harness.mapReady = false;
  harness.bridgeReady = false;
  const currentProps = props(connection("CHART"));
  const view = render(<CrossdeckCompanion {...currentProps} />);
  let completed = false;
  let receiving!: Promise<void>;
  await act(async () => {
    receiving = harness.resume!(
      { family: "MAP", objectId: chart.id, version: syntheticBinding.chronicleVersionId },
      { blockId: chart.id },
      { mode: "MIRROR", readOnly: true },
    ).then(() => {
      completed = true;
    });
    await vi.advanceTimersByTimeAsync(80);
  });
  expect(completed).toBe(false);
  expect(harness.provider).toMatchObject({ enabled: false, historical: false });
  expect(harness.chart).toEqual({ compact: true, presentationOnly: true });
  harness.mapReady = true;
  view.rerender(<CrossdeckCompanion {...currentProps} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(80);
  });
  expect(screen.getByText("Current objective: Reach the northern light")).toBeVisible();
  expect(completed).toBe(false);
  harness.bridge.current = { capture: () => ({}), resume: () => {} };
  await act(async () => {
    await vi.advanceTimersByTimeAsync(80);
    await receiving;
  });
  expect(completed).toBe(true);
});

it("rejects unreleased or other-edition received objects before changing participation", async () => {
  const current = connection();
  render(<CrossdeckCompanion {...props(current)} />);
  await expect(
    harness.resume!({ family: "NOTE", objectId: "unreleased", version: syntheticBinding.chronicleVersionId }, {}),
  ).rejects.toThrow("Refresh the Voyage");
  await expect(harness.resume!({ family: "NOTE", objectId: note.id, version: "another-edition" }, {})).rejects.toThrow(
    "Refresh the Voyage",
  );
  expect(current.act).not.toHaveBeenCalled();
  expect(screen.getByText("The complete third bearing.")).toBeVisible();
});

it("offers a truthful offline retry while preserving the already released view", () => {
  const currentProps = { ...props(), liveConnection: "offline" as const };
  render(<CrossdeckCompanion {...currentProps} />);
  expect(screen.getByText("Offline · showing your released view")).toBeVisible();
  expect(screen.getByText("The complete third bearing.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(currentProps.onRefresh).toHaveBeenCalledOnce();
});

it("reports Crossdeck interruption even while Journal remains live and waits for verified recovery", async () => {
  render(<CrossdeckCompanion {...props()} />);
  expect(screen.getByText("Same Voyage · in sync")).toBeVisible();
  await act(async () => harness.onConnectionChange!("offline"));
  expect(screen.getByText("Offline · showing your released view")).toBeVisible();
  expect(screen.queryByText("Same Voyage · in sync")).toBeNull();
  expect(screen.getByText("The complete third bearing.")).toBeVisible();
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(screen.getByText("Offline · showing your released view")).toBeVisible();
  await act(async () => harness.onConnectionChange!("reconnecting"));
  expect(screen.getByText("Reconnecting to your Voyage")).toBeVisible();
  expect(screen.queryByText("Same Voyage · in sync")).toBeNull();
  await act(async () => harness.onConnectionChange!("live"));
  expect(screen.getByText("Same Voyage · in sync")).toBeVisible();
  expect(screen.queryByText("Offline · showing your released view")).toBeNull();
});

it("does not claim to be in sync before the Crossdeck transport verifies the connection", () => {
  harness.syncConnection = "connecting";
  render(<CrossdeckCompanion {...props()} />);
  expect(screen.getByText("Reconnecting to your Voyage")).toBeVisible();
  expect(screen.queryByText("Same Voyage · in sync")).toBeNull();
});
