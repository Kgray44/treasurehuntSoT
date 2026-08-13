import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaleEditor } from "./TaleEditor";
import type { EditorData } from "./studio-types";

const animationDirector = vi.hoisted(() => ({ play: vi.fn() }));

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));

vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: animationDirector,
  }),
}));

vi.mock("@/animation/hosts/SceneHost", () => ({
  SceneHost: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSceneTargetRegistration: () => ({ bindTarget: () => undefined }),
}));

vi.mock("@/animation/hosts/SceneHostContext", () => ({
  useOptionalSceneHost: () => ({ hostId: "studio-host", kind: "platform-ceremony" }),
}));

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function editorData(): EditorData {
  return {
    csrfToken: "csrf",
    tale: {
      id: "tale-1",
      slug: "test-tale",
      title: "A Test Chronicle",
      subtitle: null,
      shortDescription: "A chart for testing.",
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: 90,
      contentWarnings: null,
      latestPublishedVersionId: null,
    },
    draft: {
      id: "draft-1",
      autosaveVersion: 3,
      validationState: "STALE",
      validationSummary: {},
      savedAt: "2026-07-19T12:00:00.000Z",
      chapters: [
        {
          id: "chapter-1",
          title: "Chapter One",
          subtitle: null,
          description: null,
          coverAssetId: null,
          estimatedDuration: null,
          isOptional: false,
          metadata: {},
          blocks: [
            {
              id: "block-1",
              blockType: "narrative",
              title: "Opening Scene",
              internalLabel: null,
              configuration: { body: "The harbor wakes." },
              presentation: {},
              completion: {},
              creatorNotes: null,
              isEnabled: true,
              schemaVersion: 1,
            },
            {
              id: "block-2",
              blockType: "narrative",
              title: "Second Scene",
              internalLabel: null,
              configuration: { body: "The crew chooses a bearing." },
              presentation: {},
              completion: {},
              creatorNotes: null,
              isEnabled: true,
              schemaVersion: 1,
            },
          ],
        },
      ],
    },
    assets: [],
    collections: [],
    locations: [],
    artifacts: [],
    versions: [],
    registry: [
      {
        type: "narrative",
        displayName: "Narrative",
        category: "Narrative",
        icon: "N",
        description: "A readable Passage.",
        defaultTitle: "New Narrative",
        defaultConfiguration: { body: "" },
        fields: [{ key: "body", label: "Body", kind: "textarea", required: true }],
        schemaVersion: 1,
        contract: {
          currentVersion: 2,
          minimumReaderVersion: 1,
          connectionPolicy: { minimum: 0, maximum: 1, canonicalAuthority: "BlockConnection" },
          assetRequirements: [],
          variableReads: [],
          variableWrites: [],
          providerContract: null,
          accessibilityRules: [],
        },
      },
    ],
  };
}

function variableExplorer() {
  return {
    variables: [
      {
        id: "lantern-found",
        name: "lanternFound",
        description: "Tracks whether the crew recovered the lantern.",
        type: { kind: "BOOLEAN" },
        scope: "SESSION",
        defaultValue: false,
        privacy: "PLAYER_SAFE",
        allowedOperations: ["assign", "toggle"],
        readers: [],
        writers: [],
        initialization: { proofStatus: "COMPLETE", potentiallyUninitializedReferences: [] },
        unusedState: "UNUSED",
        relatedIssueCodes: [],
      },
      {
        id: "crew-score",
        name: "crewScore",
        type: { kind: "INTEGER" },
        scope: "SESSION",
        defaultValue: 0,
        privacy: "CREATOR_SAFE",
        allowedOperations: ["assign", "increment", "decrement", "min", "max"],
        readers: [],
        writers: [],
        initialization: { proofStatus: "COMPLETE", potentiallyUninitializedReferences: [] },
        unusedState: "USED",
        relatedIssueCodes: [],
      },
      {
        id: "found-items",
        name: "foundItems",
        type: { kind: "STRING_SET" },
        scope: "SESSION",
        privacy: "CREATOR_SAFE",
        allowedOperations: ["assign", "add", "remove", "contains", "count", "clear"],
        readers: [],
        writers: [],
        initialization: { proofStatus: "COMPLETE", potentiallyUninitializedReferences: [] },
        unusedState: "USED",
        relatedIssueCodes: [],
      },
    ],
  };
}

describe("Voyagewright Studio editor motion and authority", () => {
  beforeEach(() => {
    animationDirector.play.mockImplementation(
      async (_scene: string, options: { operation?: () => Promise<unknown> }) => ({
        outcome: "presented",
        operationResult: await options.operation?.(),
      }),
    );
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("exposes the More actions through an explicit keyboard-operable disclosure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, editorData())));
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    const more = screen.getByRole("button", { name: "More" });
    const libraryHandle = document.querySelector(".block-library-drag-handle");
    expect(libraryHandle).toHaveAttribute("aria-roledescription", "sortable Passage");
    expect(libraryHandle?.tagName).toBe("BUTTON");
    expect(libraryHandle?.querySelector("button")).toBeNull();
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Duplicate Chronicle" })).not.toBeInTheDocument();
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Duplicate Chronicle" })).toBeVisible();
    fireEvent.keyDown(more, { key: "Escape" });
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps dnd-kit transform ownership outside the Motion post-drop wrapper and returns inspector focus", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, editorData())));
    render(<TaleEditor taleId="tale-1" authenticated />);

    await screen.findByRole("heading", { name: "A Test Chronicle" });
    const card = screen.getByText("Opening Scene").closest<HTMLElement>("article")!;
    const motionWrapper = card.closest<HTMLElement>("[data-post-drop-layout-wrapper='true']")!;
    expect(motionWrapper).toBeInTheDocument();
    expect(motionWrapper.parentElement).toHaveAttribute("data-dnd-transform-owner", "true");

    fireEvent.click(card);
    const title = await screen.findByRole("textbox", { name: "Passage title" });
    await waitFor(() => expect(title).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Close Passage inspector" }));
    await waitFor(() => expect(card).toHaveFocus());
  });

  it("supports whole-card drag wiring, additive Passage selection, and the persisted animation controls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, editorData())));
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    const first = screen.getByText("Opening Scene").closest<HTMLElement>("article")!;
    const second = screen.getByText("Second Scene").closest<HTMLElement>("article")!;
    expect(first).toHaveAttribute("role", "button");
    expect(first).toHaveAttribute("aria-roledescription", "sortable");
    fireEvent.click(first);
    fireEvent.click(second, { ctrlKey: true });
    expect(screen.getByText("2 Passages selected")).toBeVisible();

    fireEvent.click(first);
    expect(await screen.findByText("Passage animation")).toBeVisible();
    expect(screen.getByLabelText("Opening animation")).toBeVisible();
    expect(screen.getByLabelText("Leaving animation")).toBeVisible();
    expect(screen.getByLabelText("While this Passage is active")).toBeVisible();
    expect(screen.getAllByRole("option", { name: /Tidal wake/ })).toHaveLength(3);
  });

  it("keeps contract-aware selection usable for a representative 100-Passage Chronicle", async () => {
    const data = editorData();
    data.draft.chapters = Array.from({ length: 5 }, (_, chapterIndex) => ({
      id: `chapter-${chapterIndex + 1}`,
      title: `Chapter ${chapterIndex + 1}`,
      isOptional: false,
      metadata: {},
      blocks: Array.from({ length: 20 }, (_, blockIndex) => ({
        id: `large-${chapterIndex}-${blockIndex}`,
        blockType: "narrative",
        title: `Large Passage ${chapterIndex * 20 + blockIndex + 1}`,
        configuration: { body: "A synthetic Passage for Inspector scale coverage." },
        presentation: {},
        completion: {},
        isEnabled: true,
        schemaVersion: 2,
      })),
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, data)));
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    const target = screen.getByText("Large Passage 20").closest<HTMLElement>("article")!;
    fireEvent.click(target);
    expect(await screen.findByRole("textbox", { name: "Passage title" })).toHaveValue("Large Passage 20");
    expect(
      screen.getAllByRole("button", { name: /Content|Behavior|Completion|Presentation|Accessibility|Advanced/ }),
    ).toHaveLength(6);
  });

  it("highlights and focuses the exact block named by authoritative validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockResolvedValueOnce(
          response(200, {
            valid: false,
            errors: [
              {
                code: "DRYDOCK_GRAPH_NO_TERMINAL_PATH",
                message: "Opening Scene needs a destination.",
                category: "GRAPH",
                remediation: "Connect the Passage to a terminal.",
                blockId: "block-1",
              },
            ],
            warnings: [],
          }),
        ),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    fireEvent.click(screen.getByRole("button", { name: "Validate Chronicle" }));
    const issue = await screen.findByRole("button", { name: /Opening Scene needs a destination\./ });
    expect(issue).toHaveAttribute("data-drydock-rule-code", "DRYDOCK_GRAPH_NO_TERMINAL_PATH");
    expect(screen.getByRole("combobox", { name: "Filter validation category" })).toHaveValue("ALL");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter validation category" }), {
      target: { value: "GRAPH" },
    });
    expect(issue).toHaveTextContent("Connect the Passage to a terminal.");
    fireEvent.click(issue);
    const card = screen.getByText("Opening Scene").closest<HTMLElement>("article")!;

    expect(card).toHaveAttribute("data-validation-error", "true");
    expect(await screen.findByText(/A reachable Passage cannot statically reach a terminal/)).toBeInTheDocument();
    expect(screen.getByText(/Waiver: not permitted/)).toBeInTheDocument();
    await waitFor(() => expect(card).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Close validation results" }));
    await waitFor(() => expect(screen.queryByLabelText("Chronicle validation results")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Validation/ }));
    await waitFor(() => expect(screen.getByLabelText("Chronicle validation results")).toBeVisible());
    expect(screen.getByText("Blocks publishing")).toBeVisible();
  });

  it("keeps authoring modes as disclosure and focuses the affected contract field from a Drydock issue", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockResolvedValueOnce(
          response(200, {
            valid: false,
            errors: [
              {
                code: "DRYDOCK_NARRATIVE_BODY_REQUIRED",
                message: "Opening Scene needs Player-facing text.",
                category: "CONTENT",
                remediation: "Add a short opening for Players to read.",
                blockId: "block-1",
                field: "configuration.body",
              },
            ],
            warnings: [],
          }),
        ),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    const opening = screen.getByText("Opening Scene").closest<HTMLElement>("article")!;
    fireEvent.click(opening);
    const level = screen.getByRole("combobox", { name: "Authoring level" });
    expect(level).toHaveValue("GUIDED");
    fireEvent.change(level, { target: { value: "ENGINEERING" } });
    expect(level).toHaveValue("ENGINEERING");
    expect(screen.getByText(/It never bypasses Drydock/)).toBeInTheDocument();
    fireEvent.change(level, { target: { value: "GUIDED" } });
    expect(screen.getByRole("textbox", { name: "Passage title" })).toHaveValue("Opening Scene");

    fireEvent.click(screen.getByRole("button", { name: "Validate Chronicle" }));
    fireEvent.click(await screen.findByRole("button", { name: /Opening Scene needs Player-facing text/ }));
    const body = await screen.findByRole("textbox", { name: /Body/ });
    await waitFor(() => expect(body).toHaveFocus());
  });

  it("uses the Drydock variable explorer to constrain operations and build a nested visual condition", async () => {
    const data = editorData();
    data.draft.chapters[0].blocks = [
      {
        id: "set-variable",
        blockType: "setVariable",
        title: "Set the lantern flag",
        configuration: { variableId: "", operation: "set", value: false },
        presentation: {},
        completion: {},
        creatorNotes: null,
        isEnabled: true,
        schemaVersion: 1,
      },
      {
        id: "condition",
        blockType: "condition",
        title: "Check the lantern",
        configuration: {
          variable: "",
          operator: "equals",
          value: false,
          successTargetBlockId: "",
          failureTargetBlockId: "",
        },
        presentation: {},
        completion: {},
        creatorNotes: null,
        isEnabled: true,
        schemaVersion: 1,
      },
    ];
    data.registry = [
      {
        type: "setVariable",
        displayName: "Set Variable",
        category: "Logic",
        icon: "=",
        description: "Set a typed variable.",
        defaultTitle: "Set Variable",
        defaultConfiguration: {},
        fields: [
          { key: "variable", label: "Variable", kind: "text", required: true },
          { key: "operation", label: "Operation", kind: "select", options: [] },
          { key: "value", label: "Value", kind: "json" },
        ],
        schemaVersion: 2,
        contract: {
          currentVersion: 2,
          minimumReaderVersion: 1,
          connectionPolicy: { minimum: 0, maximum: 0, canonicalAuthority: "BlockConnection" },
          assetRequirements: [],
          variableReads: [],
          variableWrites: [
            {
              fieldPath: "configuration.variableId",
              identityFieldPath: "configuration.variableName",
              access: "WRITE",
              operations: ["assign", "increment", "decrement", "toggle"],
            },
          ],
          providerContract: null,
          accessibilityRules: [],
        },
      },
      {
        type: "condition",
        displayName: "Condition",
        category: "Logic",
        icon: "◇",
        description: "Route through a typed expression.",
        defaultTitle: "Condition",
        defaultConfiguration: {},
        fields: [
          { key: "variable", label: "Variable", kind: "text", required: true },
          { key: "operator", label: "Comparison", kind: "select", options: [] },
          { key: "value", label: "Value", kind: "json" },
          { key: "successTargetBlockId", label: "Success", kind: "text" },
          { key: "failureTargetBlockId", label: "Failure", kind: "text" },
        ],
        schemaVersion: 2,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, data))
        .mockResolvedValue(response(200, { explorer: variableExplorer() })),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    fireEvent.click(screen.getByText("Set the lantern flag").closest<HTMLElement>("article")!);
    fireEvent.click(screen.getByRole("button", { name: "Load declared variables" }));
    const search = await screen.findByRole("searchbox", { name: "Search declared variables" });
    fireEvent.change(search, { target: { value: "lantern" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Choose a declared variable" }), {
      target: { value: "lantern-found" },
    });
    expect(screen.getByRole("option", { name: "Set" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toggle" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Increase by" })).not.toBeInTheDocument();
    expect(screen.getByText(/Tracks whether the crew recovered/)).toBeVisible();

    fireEvent.click(screen.getByText("Check the lantern").closest<HTMLElement>("article")!);
    fireEvent.click(screen.getByRole("button", { name: "Add ALL group" }));
    fireEvent.click(screen.getByRole("button", { name: "Add ANY group" }));
    fireEvent.click(screen.getByRole("button", { name: "Add contains check" }));
    fireEvent.click(screen.getByRole("button", { name: "Add count check" }));
    expect(screen.getAllByText(/All of these must be true|Any of these may be true/).length).toBeGreaterThan(1);
  });

  it("keeps a forward-compatible registry type editable through the safe generic fallback", async () => {
    const data = editorData();
    data.draft.chapters[0].blocks[0] = {
      ...data.draft.chapters[0].blocks[0],
      id: "future-compass",
      blockType: "futureCompass",
      title: "Future compass",
      configuration: { instruction: "Turn toward the bell." },
      schemaVersion: 2,
    };
    data.registry = [
      {
        type: "futureCompass",
        displayName: "Future Compass",
        category: "Future",
        icon: "?",
        description: "A contract supplied by a later accepted block family.",
        defaultTitle: "Future Compass",
        defaultConfiguration: { instruction: "" },
        fields: [{ key: "instruction", label: "Instruction", kind: "textarea", required: true }],
        schemaVersion: 2,
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, data)));
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    fireEvent.click(screen.getByText("Future compass").closest<HTMLElement>("article")!);
    const inspector = screen
      .getByLabelText("Selected Passage tools")
      .parentElement?.querySelector(".contract-aware-inspector");
    expect(inspector).toHaveAttribute("data-editor-strategy", "SAFE_GENERIC_FALLBACK");
    const instruction = screen.getByRole("textbox", { name: /Instruction/ });
    fireEvent.change(instruction, { target: { value: "Turn to the lighthouse." } });
    expect(instruction).toHaveValue("Turn to the lighthouse.");
  });

  it("surfaces an older schema as requiring a server-confirmed Drydock migration", async () => {
    const data = editorData();
    data.draft.chapters[0].blocks[0].configuration = { heading: "Opening scene", body: "The harbor wakes." };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, data)));
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    fireEvent.click(screen.getByText("Opening Scene").closest<HTMLElement>("article")!);
    expect(await screen.findByText("Migration requires server confirmation")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Authoring level" }), { target: { value: "ENGINEERING" } });
    expect(screen.getByText(/Draft v1; current v2/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Preview Drydock migration" })).toBeVisible();
  });

  it("applies a revision-guarded safe repair through the ordinary Studio undo history", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockResolvedValueOnce(
          response(200, {
            valid: false,
            errors: [
              {
                code: "DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT",
                message: "Legacy target disagrees with the canonical connection.",
                category: "COMPATIBILITY",
                blockId: "block-1",
              },
            ],
            warnings: [],
          }),
        )
        .mockResolvedValueOnce(
          response(200, {
            sourceRevision: 3,
            preview: {
              kind: "CANONICAL_TARGET_MIRROR",
              classification: "SAFE_AUTOMATIC",
              blockId: "block-1",
              sourceChecksum: "source-checksum",
              expectedIssueChanges: { resolved: ["DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT"], introduced: [] },
              description: "Synchronize legacy target mirrors to the existing canonical BlockConnection.",
              after: { configuration: { body: "The harbor wakes." }, nextBlockId: "block-2" },
            },
          }),
        ),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    fireEvent.click(screen.getByRole("button", { name: "Validate Chronicle" }));
    fireEvent.click(await screen.findByRole("button", { name: /Legacy target disagrees/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preview safe repair" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("without changing canonical Passage connections");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Apply safe repair" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Undo last edit" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Undo last edit" }));
    expect(screen.getByRole("button", { name: "Redo edit" })).not.toBeDisabled();
  });

  it("opens the owner-projected static graph outline and preserves Passage navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockResolvedValueOnce(
          response(200, {
            valid: false,
            errors: [
              {
                code: "DRYDOCK_GRAPH_NO_TERMINAL_PATH",
                message: "Opening Scene needs a destination.",
                blockId: "block-1",
              },
            ],
            warnings: [],
          }),
        )
        .mockResolvedValueOnce(
          response(200, {
            survey: {
              proofCompleteness: "COMPLETE",
              nodes: [
                {
                  id: "block-1",
                  blockType: "narrative",
                  isEntry: true,
                  isTerminal: false,
                  isReachable: true,
                  canReachTerminal: false,
                  stronglyConnectedComponent: null,
                  annotations: [{ code: "DRYDOCK_GRAPH_NO_TERMINAL_PATH", severity: "ERROR" }],
                },
              ],
            },
          }),
        ),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    fireEvent.click(screen.getByRole("button", { name: "Validate Chronicle" }));
    await screen.findByRole("button", { name: /Opening Scene needs a destination/ });
    fireEvent.click(screen.getByRole("button", { name: "Open static graph outline" }));
    expect(await screen.findByRole("region", { name: "Static graph outline" })).toHaveTextContent("No terminal path.");
    expect(screen.getByText("Opening Scene").closest("article")).toHaveAttribute(
      "data-drydock-graph-state",
      expect.stringContaining("DRYDOCK_GRAPH_NO_TERMINAL_PATH"),
    );
    expect(screen.getByLabelText("Static graph analysis")).toHaveTextContent("No terminal path.");
    fireEvent.click(screen.getByRole("button", { name: "narrative (block-1)" }));
    await waitFor(() => expect(screen.getByText("Opening Scene").closest("article")).toHaveFocus());
  });

  it("does not remove a block until the draft save succeeds and reconciles an authoritative undo", async () => {
    let resolveDelete!: (value: Response) => void;
    const deletion = new Promise<Response>((resolve) => {
      resolveDelete = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockReturnValueOnce(deletion)
        .mockResolvedValueOnce(response(200, { autosaveVersion: 5, savedAt: "2026-07-19T12:02:00.000Z" })),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    const card = (await screen.findByText("Opening Scene")).closest<HTMLElement>("article")!;
    fireEvent.click(card);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Passage" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Passage" }));
    expect(screen.getByText("Opening Scene")).toBeInTheDocument();

    await act(async () => resolveDelete(response(200, { autosaveVersion: 4, savedAt: "2026-07-19T12:01:00.000Z" })));
    await waitFor(() => expect(screen.queryByText("Opening Scene")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Undo deletion" }));

    expect(await screen.findByText("Opening Scene")).toBeInTheDocument();
  });

  it("shows the publish seal only after the immutable version response succeeds", async () => {
    let resolvePublish!: (value: Response) => void;
    const publication = new Promise<Response>((resolve) => {
      resolvePublish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockReturnValueOnce(publication)
        .mockResolvedValueOnce(response(200, editorData())),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });
    fireEvent.click(screen.getByRole("button", { name: "Publish Chronicle" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish Version" }));
    expect(screen.queryByText(/Version 4 published/)).not.toBeInTheDocument();

    await act(async () => resolvePublish(response(201, { versionLabel: "4" })));
    expect(await screen.findByText(/Version 4 published/)).toHaveAttribute("data-authority-state", "confirmed");
  });

  it("keeps a successfully published version confirmed when its presentation director interrupts afterward", async () => {
    animationDirector.play.mockImplementationOnce(
      async (_scene: string, options: { operation?: () => Promise<unknown> }) => {
        await options.operation?.();
        throw new Error("presentation-interrupted-after-publish");
      },
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockResolvedValueOnce(response(201, { versionLabel: "4" }))
        .mockResolvedValueOnce(response(200, editorData())),
    );

    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });
    fireEvent.click(screen.getByRole("button", { name: "Publish Chronicle" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish Version" }));

    expect(await screen.findByText(/Version 4 published/)).toHaveAttribute("data-authority-state", "confirmed");
    expect(screen.queryByText("Publishing failed")).not.toBeInTheDocument();
  });

  it("waits for an in-flight autosave before publishing the immutable version", async () => {
    let resolveSave!: (value: Response) => void;
    const save = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, editorData()))
      .mockReturnValueOnce(save)
      .mockResolvedValueOnce(response(201, { versionLabel: "5" }))
      .mockResolvedValueOnce(response(200, editorData()));
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<TaleEditor taleId="tale-1" authenticated />);
      const card = (await screen.findByText("Opening Scene")).closest<HTMLElement>("article")!;
      fireEvent.click(card);
      vi.useFakeTimers();
      fireEvent.change(screen.getByRole("textbox", { name: "Passage title" }), {
        target: { value: "Updated opening scene" },
      });
      act(() => vi.advanceTimersByTime(1100));
      expect(fetchMock).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByRole("button", { name: "Publish Chronicle" }));
      await act(async () => resolveSave(response(200, { autosaveVersion: 4, savedAt: "2026-07-19T12:02:00.000Z" })));
      vi.useRealTimers();
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Publish Version" }));

      expect(await screen.findByText(/Version 5 published/)).toHaveAttribute("data-authority-state", "confirmed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks each upload independently and preserves successful files when a sibling fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockResolvedValueOnce(response(201, { assets: [{ asset: { id: "asset-1" } }] }))
        .mockResolvedValueOnce(response(415, { error: "Unsupported file type." }))
        .mockResolvedValueOnce(response(200, editorData())),
    );
    render(<TaleEditor taleId="tale-1" initialSection="assets" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });
    const uploadLabel = screen.getByText("Drop files or choose from this device").closest("label")!;
    const input = within(uploadLabel).getByDisplayValue("") as HTMLInputElement;
    const first = new File(["image"], "harbor.png", { type: "image/png", lastModified: 1 });
    const second = new File(["bad"], "notes.exe", { type: "application/octet-stream", lastModified: 2 });
    fireEvent.change(input, { target: { files: [first, second] } });

    const progress = await screen.findByRole("list", { name: "File upload progress" });
    await waitFor(() => {
      expect(within(progress).getByText("harbor.png").closest("li")).toHaveAttribute("data-upload-state", "ready");
      expect(within(progress).getByText("notes.exe").closest("li")).toHaveAttribute("data-upload-state", "failed");
    });
  });

  it("opens the command palette from the keyboard and exposes only current canonical actions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, editorData())));
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    const commands = screen.getByRole("button", { name: "Open Studio command palette" });
    commands.focus();
    fireEvent.click(commands);
    const palette = await screen.findByRole("dialog", { name: "Find an action" });
    await waitFor(() =>
      expect(within(palette).getByRole("searchbox", { name: "Search Studio commands" })).toHaveFocus(),
    );
    expect(within(palette).getByRole("button", { name: /Validate Chronicle/i })).toBeInTheDocument();
    expect(within(palette).getByRole("button", { name: /Insert Narrative/i })).toBeInTheDocument();
    expect(within(palette).queryByRole("button", { name: /new Story Block/i })).not.toBeInTheDocument();
    fireEvent.change(within(palette).getByRole("searchbox", { name: "Search Studio commands" }), {
      target: { value: "validate" },
    });
    expect(within(palette).queryByRole("button", { name: /Insert Narrative/i })).not.toBeInTheDocument();

    fireEvent.keyDown(palette, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Find an action" })).not.toBeInTheDocument());
    await waitFor(() => expect(commands).toHaveFocus());

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const reopenedPalette = await screen.findByRole("dialog", { name: "Find an action" });
    expect(within(reopenedPalette).getByRole("button", { name: /Insert Narrative/i })).toBeInTheDocument();
  });

  it("keeps canvas view controls presentation-only and keyboard reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, editorData())));
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    expect(screen.getByRole("status", { name: "Canvas zoom 100 percent" })).toHaveTextContent("100%");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("status", { name: "Canvas zoom 110 percent" })).toHaveTextContent("110%");
    expect(screen.getByText("Opening Scene")).toBeInTheDocument();
  });

  it("shows the owner-scoped reusable Library without inventing unavailable block types", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, editorData()))
        .mockResolvedValueOnce(
          response(200, {
            items: [
              {
                id: "reusable-1",
                kind: "FRAGMENT",
                name: "A safe choice",
                description: "A preserved two-passage choice.",
                tags: ["choice"],
                status: "ACTIVE",
                currentVersionNumber: 1,
                currentVersionId: "version-1",
                checksum: "a".repeat(64),
                usageCount: 2,
                updatedAt: "2026-08-13T12:00:00.000Z",
              },
            ],
          }),
        ),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });
    fireEvent.click(screen.getByRole("tab", { name: "Reuse" }));
    expect(await screen.findByText("A safe choice")).toBeInTheDocument();
    expect(screen.getByText("FRAGMENT · Version 1")).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it("applies a compatible preset through the ordinary save path with immutable source-version provenance", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, editorData()))
      .mockResolvedValueOnce(
        response(200, {
          items: [
            {
              id: "reusable-1",
              kind: "PRESET",
              name: "A stronger opening",
              description: "A governed narrative preset.",
              tags: [],
              status: "ACTIVE",
              currentVersionNumber: 1,
              currentVersionId: "version-1",
              checksum: "a".repeat(64),
              usageCount: 0,
              updatedAt: "2026-08-13T12:00:00.000Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          itemId: "reusable-1",
          versionId: "version-1",
          envelope: {
            kind: "PRESET",
            itemId: "reusable-1",
            versionId: "version-1",
            attribution: { sourceOwnerId: "creator-1", modified: false },
            blocks: [
              {
                id: "source-block",
                blockType: "narrative",
                configuration: { body: "A safer, reusable opening." },
                presentation: {},
                completion: {},
                schemaVersion: 1,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(response(200, { autosaveVersion: 4, savedAt: "2026-08-13T12:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Chronicle" });

    fireEvent.click(screen.getByText("Opening Scene").closest<HTMLElement>("article")!);
    fireEvent.click(screen.getByRole("tab", { name: "Reuse" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply to selected Passage" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/studio/tales/tale-1/reusable-content?itemId=reusable-1",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/studio/tales/tale-1/draft",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"sourceKind":"PRESET_APPLIED"'),
        }),
      ),
    );
  });
});
