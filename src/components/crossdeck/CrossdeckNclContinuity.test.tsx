// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PlayerJournalBlock } from "@/chronicle/journal-contract";
import type { SessionState } from "@/components/player/journal/ChronicleJournalSession";
import { receiptSchema, type InteractionReceipt, type SpatialMoment } from "@/parallax/contracts";
import { syntheticBinding, syntheticSpatialMoment } from "@/parallax/fixtures";
import { materializeSpatialVersion } from "@/parallax/publication";
import type { CrossdeckConnection } from "./useCrossdeckSession";
import { CrossdeckCompanionGateway } from "./CrossdeckCompanionGateway";

// Real Gateway, Companion, Lens and Parallax runtime. The persisted Journal
// projection and participation/HTTP boundaries are synthetic: this is not a DB,
// pairing-transport, native-rendering or live browser-provider qualification.
const harness = vi.hoisted(() => ({
  connection: {} as CrossdeckConnection,
  state: {} as SessionState,
  blocks: [] as PlayerJournalBlock[],
  load: undefined as undefined | (() => Promise<Response>),
  record: undefined as undefined | ((receipt: InteractionReceipt) => Promise<Response>),
  posts: [] as { receipt: InteractionReceipt; headers: Headers }[],
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { ...props, href }, children),
  };
});
vi.mock("./useCrossdeckSession", () => ({ useCrossdeckSession: () => harness.connection }));
vi.mock("./CrossdeckHandoff", () => ({ CrossdeckHandoff: () => null }));
vi.mock("./CrossdeckContinuity", () => ({ useCrossdeckContinuity: () => null }));
vi.mock("./CrossdeckDisplay", () => ({ CrossdeckDisplay: () => <main>Restricted crew presentation</main> }));
vi.mock("@/components/player/journal/LandfallJournalChart", () => ({
  LandfallJournalProvider: ({ children }: { children: ReactNode }) => children,
  LandfallJournalChart: () => null,
}));
vi.mock("@/components/player/journal/ChronicleJournalSession", async () => {
  const { CrossdeckCompanion } = await import("./CrossdeckCompanion");
  return {
    ChronicleJournalSession: ({ companion }: { companion: CrossdeckConnection }) => (
      <CrossdeckCompanion
        state={harness.state}
        blocks={harness.blocks}
        assets={[]}
        mode="reduced"
        connection={companion}
        liveConnection="live"
        liveNotice="Synthetic authorized Journal projection"
        error=""
        onRefresh={() => {}}
      />
    ),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function modelMoment(): SpatialMoment {
  const moment = syntheticSpatialMoment();
  const { checksum: _checksum, ...content } = moment.version;
  void _checksum;
  content.title = "The released chest Scene";
  content.entities[0] = {
    ...content.entities[0],
    id: "released-chest",
    name: "The released treasure chest",
    content: "The original chest holds the northern bearing.",
    alternativeText: "The authored chest clue, available in Guided View.",
    interactions: ["INSPECT"],
    widthMeters: 0.8,
    element: {
      kind: "PHYSICAL_ASSET",
      enabled: true,
      modelId: "treasure-chest",
      packageVersion: "1.0.0",
      articulation: 0,
    },
  };
  const version = materializeSpatialVersion(content);
  return { ...moment, version, attachment: { ...moment.attachment, versionChecksum: version.checksum } };
}

function projection(moment: SpatialMoment): SessionState {
  const block: PlayerJournalBlock = {
    id: syntheticBinding.blockId,
    chapterId: "synthetic-chapter",
    blockType: "narrative",
    journalKind: "story",
    title: "The released spatial passage",
    orderIndex: 0,
    configuration: { body: "The same released passage remains in your Voyage." },
    presentation: { spreadMode: "right", spatialMoment: moment },
    connections: [],
    progress: "active",
    releasedAt: "2026-10-21T00:00:00Z",
    completedAt: null,
    selectedTargetId: null,
  };
  harness.blocks = [block];
  return {
    csrfToken: "synthetic-canonical-csrf",
    session: {
      id: syntheticBinding.sessionId,
      versionId: syntheticBinding.chronicleVersionId,
      status: "ACTIVE",
      previewMode: false,
      versionLabel: "Synthetic immutable edition",
      versionPublishedAt: null,
      versionChecksum: null,
      currentSequence: 4,
      startedAt: "2026-10-21T00:00:00Z",
      updatedAt: "2026-10-21T00:00:00Z",
      completedAt: null,
    },
    tale: { title: "The same synthetic Voyage", slug: "synthetic-ncl", subtitle: null, shortDescription: null },
    chapter: null,
    block: null,
    pendingVerification: null,
    assets: [],
    journal: {
      mode: "active",
      currentBlockId: block.id,
      currentChapterId: block.chapterId,
      chapters: [{ id: block.chapterId, title: "Synthetic chapter", subtitle: null, orderIndex: 0, blocks: [block] }],
    },
  };
}

const endpoint = `/api/player/playthroughs/${syntheticBinding.sessionId}/parallax`;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
let moment: SpatialMoment;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function canonicalResponse() {
  return Response.json({ moment, binding: syntheticBinding, replayOnly: false });
}

beforeEach(() => {
  moment = modelMoment();
  harness.state = projection(moment);
  harness.connection = {
    voyage: syntheticBinding.sessionId,
    csrf: "synthetic-participation-csrf",
    ready: true,
    signedOut: false,
    busy: false,
    message: "",
    here: {
      surfaceId: "synthetic-phone",
      voyageId: syntheticBinding.sessionId,
      thisSession: true,
      role: "CHRONICLE_LENS",
      label: "Synthetic phone",
    },
    act: vi.fn(),
    refresh: vi.fn(),
    setMessage: vi.fn(),
  } as unknown as CrossdeckConnection;
  harness.posts = [];
  harness.load = async () => canonicalResponse();
  harness.record = async () => Response.json({});
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url === `${endpoint}?block=${syntheticBinding.blockId}` && !init?.method) return harness.load!();
    if (url === endpoint && init?.method === "POST") {
      const receipt = receiptSchema.parse(JSON.parse(String(init.body)));
      harness.posts.push({ receipt, headers: new Headers(init.headers) });
      return harness.record!(receipt);
    }
    throw new Error("Unexpected request outside the scoped Parallax boundary");
  });
  vi.stubGlobal("fetch", fetchMock);
  delete window.LandfallNative;
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

async function openCompanion() {
  const view = render(<CrossdeckCompanionGateway voyageId={syntheticBinding.sessionId} />);
  const dialog = await screen.findByRole("dialog", { name: moment.version.title });
  await within(dialog).findByText("This device uses Guided View for this spatial moment.");
  return { view, dialog };
}

function expectNoAcceptedInspection() {
  expect(screen.queryByText(/You are inspecting/)).toBeNull();
  expect(screen.queryByText(/Interaction recorded\./)).toBeNull();
}

it("binds the released model Scene and accepted Inspect to the same Voyage, edition, Player and instance", async () => {
  const pending = deferred<Response>();
  harness.record = () => pending.promise;
  const unchangedProjection = structuredClone(harness.state);
  const { dialog } = await openCompanion();
  const context = within(dialog).getByRole("region", { name: "Voyage context" });
  expect(context).toHaveAttribute("data-experience-voyage", syntheticBinding.sessionId);
  expect(context).toHaveAttribute("data-experience-version", syntheticBinding.chronicleVersionId);
  expect(within(dialog).queryByRole("button", { name: "Use camera for local placement" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Inspect" }));
  await waitFor(() => expect(harness.posts).toHaveLength(1));
  expectNoAcceptedInspection();
  expect(harness.posts[0].headers.get("x-csrf-token")).toBe("synthetic-canonical-csrf");
  expect(harness.posts[0].receipt).toMatchObject({
    sessionId: syntheticBinding.sessionId,
    chronicleVersionId: syntheticBinding.chronicleVersionId,
    blockId: syntheticBinding.blockId,
    actorId: syntheticBinding.actorId,
    instanceId: `instance:${moment.attachment.id}:${syntheticBinding.runId}`,
    spatialDefinitionVersionId: moment.version.id,
    versionChecksum: moment.version.checksum,
    entityId: "released-chest",
    interactionType: "INSPECT",
    authority: "NONAUTHORITATIVE",
    mode: "GUIDED",
    synthetic: false,
  });
  await act(async () => pending.resolve(Response.json({})));
  await within(dialog).findByText(/You are inspecting The released treasure chest/);
  expect(harness.state).toEqual(unchangedProjection);
  expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith(endpoint))).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close Chronicle Lens" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("region", { name: "Voyage context" })).toHaveAttribute(
    "data-experience-version",
    syntheticBinding.chronicleVersionId,
  );
  expect(screen.getByRole("link", { name: "Return to Chronicle" })).toHaveAttribute(
    "href",
    `/player/playthroughs/${syntheticBinding.sessionId}/journal`,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open Chronicle Lens" }));
  const reopened = await screen.findByRole("dialog", { name: moment.version.title });
  await within(reopened).findByText("This device uses Guided View for this spatial moment.");
  expectNoAcceptedInspection();
  expect(harness.posts).toHaveLength(1);
});

it("keeps rejected Inspect unaccepted and retries the exact receipt after canonical acceptance", async () => {
  harness.record = async () => new Response(null, { status: 503 });
  const { dialog } = await openCompanion();
  fireEvent.click(within(dialog).getByRole("button", { name: "Inspect" }));
  await within(dialog).findByRole("alert");
  expectNoAcceptedInspection();
  const first = structuredClone(harness.posts[0].receipt);
  harness.record = async () => Response.json({});
  fireEvent.click(within(dialog).getByRole("button", { name: "Retry recording interaction" }));
  await within(dialog).findByText(/You are inspecting The released treasure chest/);
  expect(harness.posts).toHaveLength(2);
  expect(harness.posts[1].receipt).toEqual(first);
  expect(harness.state.session.currentSequence).toBe(4);
});

it.each(["sessionId", "chronicleVersionId", "blockId", "actorId", "runId"] as const)(
  "rejects a changed canonical %s before any Inspect POST",
  async (field) => {
    const { dialog } = await openCompanion();
    harness.load = async () =>
      Response.json({ moment, binding: { ...syntheticBinding, [field]: `changed-${field}` }, replayOnly: false });
    fireEvent.click(within(dialog).getByRole("button", { name: "Inspect" }));
    await within(dialog).findByText("This Lens is closed. Return to your Journal.");
    expectNoAcceptedInspection();
    expect(harness.posts).toHaveLength(0);
    expect(within(dialog).queryByRole("button", { name: "Inspect" })).toBeNull();
  },
);

it.each(["revision", "attachment"] as const)(
  "rejects a replaced Scene %s without reusing its prior inspection identity",
  async (replacement) => {
    const { dialog } = await openCompanion();
    const changed = structuredClone(moment);
    if (replacement === "attachment") changed.attachment.id = "replacement-chest-attachment";
    else {
      const { checksum: _checksum, ...content } = changed.version;
      void _checksum;
      content.id = "replacement-chest-version";
      content.entities[0].content = "A different released Scene revision.";
      changed.version = materializeSpatialVersion(content);
      changed.attachment.spatialDefinitionVersionId = changed.version.id;
      changed.attachment.versionChecksum = changed.version.checksum;
    }
    harness.load = async () => Response.json({ moment: changed, binding: syntheticBinding, replayOnly: false });
    fireEvent.click(within(dialog).getByRole("button", { name: "Inspect" }));
    await within(dialog).findByText("This Lens is closed. Return to your Journal.");
    expectNoAcceptedInspection();
    expect(harness.posts).toHaveLength(0);
  },
);

it("does not witness an edition from stale companion metadata beside a different canonical Scene binding", async () => {
  harness.state.session.versionId = "stale-projection-edition";
  const { dialog } = await openCompanion();
  expect(within(dialog).queryByRole("region", { name: "Voyage context" })).toBeNull();
  expect(harness.posts).toHaveLength(0);
});

it.each(["revoke", "crew", "journal"] as const)(
  "ignores a late accepted Inspect after the authorized surface changes to %s",
  async (transition) => {
    const pending = deferred<Response>();
    harness.record = () => pending.promise;
    const { view, dialog } = await openCompanion();
    fireEvent.click(within(dialog).getByRole("button", { name: "Inspect" }));
    await waitFor(() => expect(harness.posts).toHaveLength(1));
    expectNoAcceptedInspection();
    if (transition === "revoke") harness.connection.here = undefined;
    else harness.connection.here!.role = transition === "crew" ? "SHARED_CREW_DISPLAY" : "JOURNAL";
    view.rerender(<CrossdeckCompanionGateway voyageId={syntheticBinding.sessionId} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => pending.resolve(Response.json({})));
    expectNoAcceptedInspection();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(harness.posts).toHaveLength(1);
    if (transition === "revoke") expect(screen.getByRole("heading", { name: "Reconnect this device" })).toBeVisible();
    if (transition === "crew") expect(screen.getByText("Restricted crew presentation")).toBeVisible();
    expect(harness.state.session.currentSequence).toBe(4);
  },
);

it("never activates a late Scene load after its surface was revoked", async () => {
  const pending = deferred<Response>();
  harness.load = () => pending.promise;
  const view = render(<CrossdeckCompanionGateway voyageId={syntheticBinding.sessionId} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  harness.connection.here = undefined;
  view.rerender(<CrossdeckCompanionGateway voyageId={syntheticBinding.sessionId} />);
  await act(async () => pending.resolve(canonicalResponse()));
  expect(screen.getByRole("heading", { name: "Reconnect this device" })).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("The original chest holds the northern bearing.")).toBeNull();
  expect(harness.posts).toHaveLength(0);
});
