import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createSpatialDraft } from "@/parallax/authoring";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { CompactSpatialCatalogEntry } from "@/parallax/spatial-catalog-read-projection";
import { SpatialContentLibrary } from "./SpatialContentLibrary";
import legacyBuiltins from "@/parallax/builtin-environments.v1.json";
import { environmentVersionSchema } from "@/parallax/legacy-scene-environment-contracts";
import { spatialElementCatalogEntries } from "@/parallax/spatial-element-catalog-provider";
import { projectEnvironmentForSpatialLibrary } from "@/parallax/spatial-library-environment-catalog";

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

it("retains one Library search and selection across compact and expanded presentations", () => {
  const onExpand = vi.fn();
  const onPlacePreset = vi.fn();
  const onInsertPreset = vi.fn();
  const shared = {
    ...props(),
    catalogMode: "FULL" as const,
    initialKind: "ASSETS" as const,
    providerEntries: spatialElementCatalogEntries,
    onExpand,
    onPlacePreset,
    onInsertPreset,
  };
  const view = render(<SpatialContentLibrary {...shared} />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), { target: { value: "Writing desk" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspect Writing desk" }));
  fireEvent.click(screen.getByRole("button", { name: "Expand Spatial Library" }));
  expect(onExpand).toHaveBeenCalledOnce();
  view.rerender(<SpatialContentLibrary {...shared} expanded />);
  expect(screen.getByRole("searchbox", { name: "Search assets" })).toHaveValue("Writing desk");
  expect(screen.getByLabelText("Writing desk details")).toBeVisible();
  fireEvent.click(
    within(screen.getByLabelText("Writing desk details")).getByRole("button", { name: "Place in Scene" }),
  );
  expect(onPlacePreset).toHaveBeenCalledWith("sc02:writing-desk");
  expect(onInsertPreset).not.toHaveBeenCalled();
  view.rerender(<SpatialContentLibrary {...shared} />);
  expect(screen.getByRole("searchbox", { name: "Search assets" })).toHaveValue("Writing desk");
  expect(screen.getByLabelText("Writing desk details")).toBeVisible();
});

it("moves category focus and selection together with standard tab keys", () => {
  render(
    <SpatialContentLibrary
      {...props()}
      catalogMode="FULL"
      initialKind="ASSETS"
      providerEntries={spatialElementCatalogEntries}
      expanded
    />,
  );
  const assets = screen.getByRole("tab", { name: "Assets" });
  assets.focus();
  fireEvent.keyDown(assets, { key: "ArrowDown" });
  const environments = screen.getByRole("tab", { name: "Environments" });
  expect(environments).toHaveFocus();
  expect(environments).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", environments.id);
  fireEvent.keyDown(environments, { key: "End" });
  expect(screen.getByRole("tab", { name: "Compositions" })).toHaveFocus();
});

it("reads owned publication status from the authorized Harborlight listing route", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      licenses: [],
      listings: [
        {
          id: "listing-one",
          title: "Published map",
          publicationStatus: "PUBLISHED",
          semanticVersion: "2.0.0",
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<SpatialContentLibrary {...props()} catalogMode="FULL" items={[record(7)]} expanded />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Owned Scene 007" }));
  expect(await screen.findByText(/Published in Community.*Published map.*v2\.0\.0/)).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining("/api/community/spatial-publication/licenses?"),
    expect.any(Object),
  );
});

it("routes expanded Scene duplication to the existing Scene lifecycle action", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ licenses: [], listings: [] })),
  );
  const source = record(7);
  const onDuplicateScene = vi.fn();
  render(
    <SpatialContentLibrary
      {...props()}
      catalogMode="FULL"
      items={[source]}
      expanded
      onDuplicateScene={onDuplicateScene}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Inspect Owned Scene 007" }));
  fireEvent.click(
    within(screen.getByLabelText("Owned Scene 007 details")).getByRole("button", { name: "Duplicate Scene…" }),
  );
  expect(onDuplicateScene).toHaveBeenCalledWith(source);
});

it("routes expanded Environment creation to the pinned Scene lifecycle action", () => {
  const version = environmentVersionSchema.parse(legacyBuiltins[0]);
  const environment = projectEnvironmentForSpatialLibrary({
    representation: "SC01_SCHEMA1",
    id: version.reference.environmentId,
    builtin: true,
    ownerAccountId: null,
    revision: null,
    saveState: null,
    archived: false,
    working: null,
    versions: [version],
  });
  const onCreateSceneFromEnvironment = vi.fn();
  render(
    <SpatialContentLibrary
      {...props()}
      catalogMode="FULL"
      initialKind="ENVIRONMENTS"
      environments={[environment]}
      expanded
      onCreateSceneFromEnvironment={onCreateSceneFromEnvironment}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: `Inspect ${environment.name}` }));
  fireEvent.click(
    within(screen.getByLabelText(`${environment.name} details`)).getByRole("button", {
      name: "Create Scene from Environment…",
    }),
  );
  expect(onCreateSceneFromEnvironment).toHaveBeenCalledWith(environment);
});

it("uses exact archived state and title instead of a stale active summary", async () => {
  const exact = record(7);
  exact.archived = true;
  exact.draft.content.title = "Current archived Scene";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      return reply(
        url.searchParams.get("view") === "library-item"
          ? { kind: "SPATIAL", record: exact }
          : {
              items: [entry(7)],
              total: 1,
              nextCursor: null,
              availableKinds: ["SCENES"],
              availableOrigins: ["MY_CREATIONS"],
            },
      );
    }),
  );
  render(<SpatialContentLibrary {...props()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Inspect Owned Scene 007" }));
  expect(await screen.findByLabelText("Current archived Scene details")).toBeVisible();
  expect(screen.getByRole("button", { name: "Restore" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open original" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Archive…" })).not.toBeInTheDocument();
});

it("keeps a saved Scene's verified Environment name when opening exact details", async () => {
  const exact = record(7);
  exact.draft.content.studio!.environmentBinding = {
    definitionId: "shared-room",
    versionId: null,
    revision: 1,
    checksum: "a".repeat(64),
    usedAt: "2026-10-15T01:00:00.000Z",
    policy: "INDEPENDENT_PINNED_SNAPSHOT",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      return reply(
        url.searchParams.get("view") === "library-item"
          ? { kind: "SPATIAL", record: exact }
          : {
              items: [{ ...entry(7), environmentId: "shared-room", environmentName: "Shared Room" }],
              total: 1,
              nextCursor: null,
              availableKinds: ["SCENES"],
              availableOrigins: ["MY_CREATIONS"],
            },
      );
    }),
  );
  render(<SpatialContentLibrary {...props()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Inspect Owned Scene 007" }));
  expect(await screen.findByLabelText("Owned Scene 007 details")).toHaveTextContent("Shared Room");
  expect(screen.queryByText("Environment unavailable")).not.toBeInTheDocument();
});

it.each([false, true])(
  "retains installed Environment permission and provenance after filtering (menu: %s)",
  async (menu) => {
    const version = environmentVersionSchema.parse(legacyBuiltins[0]);
    const id = version.reference.environmentId;
    const exact = {
      representation: "SC01_SCHEMA1",
      id,
      builtin: false,
      ownerAccountId: "synthetic-owner",
      revision: 1,
      saveState: "LEGACY_REVIEW",
      archived: false,
      working: null,
      versions: [version],
      readOnly: true,
    };
    const summary = {
      ...entry(7, "INSTALLED"),
      id: `environment:${id}`,
      kind: "ENVIRONMENTS",
      name: version.content.name,
      readOnly: true,
      community: {
        listingId: "listing",
        releaseId: "release",
        semanticVersion: "1.0.0",
        license: { key: "share", version: 1, requiresAttribution: true },
        attribution: [{ displayName: "Synthetic Author", contributionType: "AUTHOR" }],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input, "http://localhost");
        if (url.searchParams.get("view") === "library-item") return reply({ kind: "ENVIRONMENT", record: exact });
        const items = url.searchParams.get("search") ? [] : [summary];
        return reply({
          items,
          total: items.length,
          nextCursor: null,
          availableKinds: ["ENVIRONMENTS"],
          availableOrigins: ["INSTALLED"],
        });
      }),
    );
    render(<SpatialContentLibrary {...props()} initialKind="ENVIRONMENTS" />);
    const inspect = await screen.findByRole("button", { name: `Inspect ${version.content.name}` });
    if (menu) {
      fireEvent.click(screen.getByLabelText(`Actions for ${version.content.name}`));
      fireEvent.click(screen.getByRole("button", { name: "Preview details" }));
    } else fireEvent.click(inspect);
    expect(await screen.findByText("Credit: Synthetic Author")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search environments" }), { target: { value: "no-match" } });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: `Inspect ${version.content.name}` })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Credit: Synthetic Author")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit original" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Organize / rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive…" })).not.toBeInTheDocument();
  },
);

it("keeps an installed parent Environment read-only outside the loaded page", async () => {
  const version = environmentVersionSchema.parse(legacyBuiltins[0]);
  const exactScene = record(7);
  exactScene.draft.content.environment = version.reference;
  const exactRoom = {
    representation: "SC01_SCHEMA1",
    id: version.reference.environmentId,
    builtin: false,
    ownerAccountId: "synthetic-owner",
    revision: 1,
    saveState: "LEGACY_REVIEW",
    archived: false,
    working: null,
    versions: [version],
    readOnly: true,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.searchParams.get("view") === "library-item")
        return reply(
          url.searchParams.get("entryId")?.startsWith("environment:")
            ? { kind: "ENVIRONMENT", record: exactRoom }
            : { kind: "SPATIAL", record: exactScene },
        );
      const items = url.searchParams.get("kind") === "SCENES" ? [entry(7)] : [];
      return reply({
        items,
        total: items.length,
        nextCursor: null,
        availableKinds: ["SCENES", "ENVIRONMENTS"],
        availableOrigins: ["MY_CREATIONS"],
      });
    }),
  );
  render(<SpatialContentLibrary {...props()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Inspect Owned Scene 007" }));
  fireEvent.click(await screen.findByRole("button", { name: "View Environment" }));
  expect(await screen.findByLabelText(`${version.content.name} details`)).toHaveTextContent("read-only");
  expect(screen.getByLabelText(`${version.content.name} details`)).toHaveTextContent(
    "1 immutable version · Installed Community copy",
  );
  expect(screen.getByLabelText(`${version.content.name} details`)).not.toHaveTextContent("LEGACY_REVIEW");
  expect(screen.queryByRole("button", { name: "Edit original" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Review versions in Scene Manager" })).not.toBeInTheDocument();
});

const reply = (body: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      body && typeof body === "object" && "availableOrigins" in body ? { availableCollections: [], ...body } : body,
    ),
    { status },
  );

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
  expect(screen.getByText("License: Share v3 · Attribution required")).toBeVisible();
  expect(screen.getByText("Credit: A. Creator")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open original" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create independent copy" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Organize / rename" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Archive…" })).not.toBeInTheDocument();
  expect(input.onOpenScene).not.toHaveBeenCalled();
});

it("keeps installed release provenance when a deep-linked item is beyond the first Library page", async () => {
  const installed = {
    ...entry(49, "INSTALLED"),
    family: "Spatial Scene",
    description: "Pinned public Scene",
    community: {
      listingId: "listing-one",
      releaseId: "release-two",
      semanticVersion: "2.1.0",
      license: { key: "share", version: 3, requiresAttribution: true },
      attribution: [{ displayName: "A. Creator", contributionType: "AUTHOR" }],
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      return reply(
        url.searchParams.get("view") === "library-item"
          ? { kind: "SPATIAL", record: record(49, true), summary: installed }
          : {
              items: Array.from({ length: 48 }, (_, index) => entry(index)),
              total: 49,
              nextCursor: "page-two",
              availableKinds: ["SCENES"],
              availableOrigins: ["MY_CREATIONS", "INSTALLED"],
            },
      );
    }),
  );
  render(<SpatialContentLibrary {...props()} initialSelectionId="saved:owned-049" />);
  const details = await screen.findByLabelText("Owned Scene 049 details");
  expect(details).toHaveTextContent("Installed Community · Spatial Scene");
  expect(details).toHaveTextContent("Pinned public Scene");
  expect(details).toHaveTextContent("Community release 2.1.0");
  expect(details).toHaveTextContent("License: Share v3 · Attribution required");
  expect(details).toHaveTextContent("Credit: A. Creator");
  expect(screen.queryByRole("button", { name: "Open original" })).not.toBeInTheDocument();
});

it("keeps a malformed successful catalog response in recoverable Library feedback", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(reply({ items: [] }))
    .mockResolvedValue(
      reply({
        items: [],
        total: 0,
        nextCursor: null,
        availableKinds: ["SCENES"],
        availableOrigins: [],
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  render(<SpatialContentLibrary {...props()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Library results were incomplete");
  fireEvent.click(screen.getByRole("button", { name: "Refresh results" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each([null, { ...entry(1), previewMarks: [null] }])(
  "rejects malformed catalog entries before rendering artwork: %j",
  async (malformed) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply({
          items: [malformed],
          total: 1,
          nextCursor: null,
          availableKinds: ["SCENES"],
          availableOrigins: ["MY_CREATIONS"],
        }),
      ),
    );
    render(<SpatialContentLibrary {...props()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Library results were incomplete");
    expect(screen.getByRole("button", { name: "Refresh results" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Inspect Owned Scene 001" })).toBeNull();
  },
);

it("makes previous-source cards nonactionable immediately while the next page is pending", async () => {
  const saved = { ...entry(1), name: "Shared composition" };
  const builtin = { ...entry(2), name: "Shared composition", origin: "BUILT_IN" };
  let finish!: (response: ReturnType<typeof reply>) => void;
  const pending = new Promise<ReturnType<typeof reply>>((resolve) => {
    finish = resolve;
  });
  const response = (items: unknown[]) =>
    reply({
      items,
      total: items.length,
      nextCursor: null,
      availableKinds: ["SCENES", "EFFECTS", "COMPOSITIONS"],
      availableOrigins: ["BUILT_IN", "MY_CREATIONS"],
    });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response([saved, builtin]))
    .mockReturnValue(pending);
  vi.stubGlobal("fetch", fetcher);
  render(<SpatialContentLibrary {...props()} />);
  expect(await screen.findAllByRole("button", { name: "Inspect Shared composition" })).toHaveLength(2);
  fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: "MY_CREATIONS" } });
  expect(screen.queryAllByRole("button", { name: "Inspect Shared composition" })).toHaveLength(0);
  expect(screen.getByText("Loading Library results…")).toBeVisible();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("tab", { name: "Effects" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Compositions" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Source" })).toHaveValue("MY_CREATIONS");
  finish(response([saved]));
  expect(await screen.findAllByRole("button", { name: "Inspect Shared composition" })).toHaveLength(1);
});
