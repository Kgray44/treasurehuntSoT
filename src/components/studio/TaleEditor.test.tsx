import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaleEditor } from "./TaleEditor";

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));

vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: {
      play: vi.fn(async (_scene: string, options: { operation?: () => Promise<unknown> }) => ({
        outcome: "presented",
        operationResult: await options.operation?.(),
      })),
    },
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

function editorData() {
  return {
    csrfToken: "csrf",
    tale: {
      id: "tale-1",
      slug: "test-tale",
      title: "A Test Tale",
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
        category: "Story",
        icon: "N",
        description: "A readable story passage.",
        defaultTitle: "New Narrative",
        defaultConfiguration: { body: "" },
        fields: [{ key: "body", label: "Body", kind: "textarea", required: true }],
        schemaVersion: 1,
      },
    ],
  };
}

describe("TaleEditor Phase 4 motion and authority", () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal(
      "prompt",
      vi.fn(() => "Release notes"),
    );
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
    await screen.findByRole("heading", { name: "A Test Tale" });

    const more = screen.getByRole("button", { name: "More" });
    const libraryHandle = document.querySelector(".block-library-drag-handle");
    expect(libraryHandle).toHaveAttribute("aria-roledescription", "sortable story block");
    expect(libraryHandle?.tagName).toBe("BUTTON");
    expect(libraryHandle?.querySelector("button")).toBeNull();
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Duplicate tale" })).not.toBeInTheDocument();
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Duplicate tale" })).toBeVisible();
    fireEvent.keyDown(more, { key: "Escape" });
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps dnd-kit transform ownership outside the Motion post-drop wrapper and returns inspector focus", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, editorData())));
    render(<TaleEditor taleId="tale-1" authenticated />);

    await screen.findByRole("heading", { name: "A Test Tale" });
    const card = screen.getByText("Opening Scene").closest<HTMLElement>("article")!;
    const motionWrapper = card.closest<HTMLElement>("[data-post-drop-layout-wrapper='true']")!;
    expect(motionWrapper).toBeInTheDocument();
    expect(motionWrapper.parentElement).toHaveAttribute("data-dnd-transform-owner", "true");

    fireEvent.click(card);
    const title = await screen.findByRole("textbox", { name: "Block title" });
    await waitFor(() => expect(title).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Close block inspector" }));
    await waitFor(() => expect(card).toHaveFocus());
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
            errors: [{ message: "Opening Scene needs a destination.", blockId: "block-1" }],
            warnings: [],
          }),
        ),
    );
    render(<TaleEditor taleId="tale-1" authenticated />);
    await screen.findByRole("heading", { name: "A Test Tale" });

    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    const issue = await screen.findByRole("button", { name: "Opening Scene needs a destination." });
    fireEvent.click(issue);
    const card = screen.getByText("Opening Scene").closest<HTMLElement>("article")!;

    expect(card).toHaveAttribute("data-validation-error", "true");
    await waitFor(() => expect(card).toHaveFocus());
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
    fireEvent.click(await screen.findByRole("button", { name: "Delete block" }));
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
    await screen.findByRole("heading", { name: "A Test Tale" });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.queryByText(/Version 4 sealed/)).not.toBeInTheDocument();

    await act(async () => resolvePublish(response(201, { versionLabel: "4" })));
    expect(await screen.findByText(/Version 4 sealed/)).toHaveAttribute("data-authority-state", "confirmed");
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
    await screen.findByRole("heading", { name: "A Test Tale" });
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
});
