import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createSpatialDraft } from "@/parallax/authoring";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { CompactSpatialCatalogEntry } from "@/parallax/spatial-catalog-read-projection";
import { SpatialContentLibrary } from "./SpatialContentLibrary";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function entry(index: number, origin: "MY_CREATIONS" | "INSTALLED" = "MY_CREATIONS"): CompactSpatialCatalogEntry {
  const id = `owned-${String(index).padStart(3, "0")}`;
  return {
    id: `saved:${id}`,
    kind: "SCENES",
    origin,
    name: `Owned Scene ${String(index).padStart(3, "0")}`,
    description: "Synthetic Scene",
    family: "Saved Scene",
    searchText: `owned scene ${index}`,
    saveState: "SAVED",
    archived: false,
    previewMarks: [{ id: `${id}:mark`, kind: "PARCHMENT", x: 0, z: 0 }],
  };
}

function record(index: number, readOnly = false): SpatialLibraryRecord {
  const id = `owned-${String(index).padStart(3, "0")}`;
  const draft = createSpatialDraft(id);
  draft.content.title = `Owned Scene ${String(index).padStart(3, "0")}`;
  return {
    id,
    revision: 1,
    draft,
    releases: [],
    usageCount: 0,
    updatedAt: "2026-10-15T00:00:00.000Z",
    saveState: "SAVED",
    archived: false,
    readOnly,
  };
}

function props() {
  return {
    items: [],
    environments: [],
    catalogMode: "PAGED" as const,
    initialKind: "SCENES" as const,
    busy: false,
    onInsertPreset: vi.fn(),
    onOpenScene: vi.fn(),
    onManageScene: vi.fn(),
    onSaveScene: vi.fn(),
    onArchiveScene: vi.fn(),
    onUseSaved: vi.fn(),
    onOpenEnvironment: vi.fn(),
    onManageEnvironment: vi.fn(),
    onSaveEnvironment: vi.fn(),
    onArchiveEnvironment: vi.fn(),
    onUseEnvironment: vi.fn(),
    onCreateEnvironment: vi.fn(),
  };
}

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

it("loads global pages without local truncation and resolves exact Scene before actions", async () => {
  const first = Array.from({ length: 48 }, (_, index) => entry(index));
  const second = [entry(48), entry(49)];
  let finishDetails!: (response: Response) => void;
  const details = new Promise<Response>((resolve) => {
    finishDetails = resolve;
  });
  const fetcher = vi.fn((input: string) => {
    const url = new URL(input, "http://localhost");
    if (url.searchParams.get("view") === "library-item") return details;
    return Promise.resolve(
      reply({
        items: url.searchParams.has("cursor") ? second : first,
        total: 50,
        nextCursor: url.searchParams.has("cursor") ? null : "page-two",
        availableKinds: ["ASSETS", "SCENES"],
        availableOrigins: ["MY_CREATIONS"],
      }),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  const input = props();
  render(<SpatialContentLibrary {...input} />);
  expect(await screen.findByRole("button", { name: "Inspect Owned Scene 000" })).toBeVisible();
  expect(screen.getByText("50 items")).toBeVisible();
  expect(screen.getAllByRole("button", { name: /^Inspect Owned Scene/ })).toHaveLength(48);
  fireEvent.click(screen.getByRole("button", { name: /Show more · 2 remaining/ }));
  expect(await screen.findByRole("button", { name: "Inspect Owned Scene 049" })).toBeVisible();
  expect(screen.getAllByRole("button", { name: /^Inspect Owned Scene/ })).toHaveLength(50);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Owned Scene 049" }));
  expect(await screen.findByRole("status", { name: "" })).toHaveTextContent("Loading verified item details");
  expect(screen.queryByRole("button", { name: "Open original" })).not.toBeInTheDocument();
  finishDetails(reply({ kind: "SPATIAL", record: record(49) }));
  const open = await screen.findByRole("button", { name: "Open original" });
  fireEvent.click(open);
  expect(input.onOpenScene).toHaveBeenCalledWith(expect.objectContaining({ id: "owned-049" }));
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("cursor=page-two"), expect.any(Object));
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("entryId=saved%3Aowned-049"), expect.any(Object));
});

it("shows installed content as read-only after exact selection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.searchParams.get("view") === "library-item") return reply({ kind: "SPATIAL", record: record(7, true) });
      return reply({
        items: [
          {
            ...entry(7, "INSTALLED"),
            community: {
              listingId: "listing-one",
              releaseId: "release-two",
              semanticVersion: "2.1.0",
              license: { key: "share", version: 3, requiresAttribution: true },
              attribution: [{ displayName: "A. Creator", contributionType: "AUTHOR" }],
            },
          },
        ],
        total: 1,
        nextCursor: null,
        availableKinds: ["SCENES"],
        availableOrigins: ["INSTALLED"],
      });
    }),
  );
  const input = props();
  render(<SpatialContentLibrary {...input} />);
  fireEvent.click(await screen.findByRole("button", { name: "Inspect Owned Scene 007" }));
  await waitFor(() => expect(screen.getByLabelText("Owned Scene 007 details")).toHaveTextContent("read-only"));
  expect(screen.getByText("Community release 2.1.0")).toBeVisible();
  expect(screen.getByText("License: share v3 · Attribution required")).toBeVisible();
  expect(screen.getByText("Credit: A. Creator")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open original" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create independent copy" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Organize / rename" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Archive…" })).not.toBeInTheDocument();
  expect(input.onOpenScene).not.toHaveBeenCalled();
});
