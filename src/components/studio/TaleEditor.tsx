"use client";

/* eslint-disable @next/next/no-img-element -- Studio previews use authenticated, dynamically generated asset variants. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PublishedBlockView } from "@/components/tales/PublishedBlockView";
import type { InspectorField, JsonObject } from "@/tall-tale/types";

type Block = {
  id: string;
  blockType: string;
  title: string;
  internalLabel?: string | null;
  configuration: JsonObject;
  presentation: JsonObject;
  completion: JsonObject;
  creatorNotes?: string | null;
  isEnabled: boolean;
  schemaVersion: number;
};
type Chapter = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  coverAssetId?: string | null;
  estimatedDuration?: number | null;
  isOptional: boolean;
  metadata: JsonObject;
  blocks: Block[];
};
type Tale = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  coverAssetId: string | null;
  theme: string;
  visibility: string;
  playerCountMin: number;
  playerCountMax: number;
  estimatedDuration: number | null;
  contentWarnings: string | null;
  latestPublishedVersionId: string | null;
};
type RegistryItem = {
  type: string;
  displayName: string;
  category: string;
  icon: string;
  description: string;
  defaultTitle: string;
  defaultConfiguration: JsonObject;
  fields: InspectorField[];
  schemaVersion: number;
};
type Asset = {
  id: string;
  displayName: string;
  description: string | null;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  tags: string[];
  roles: string[];
  collectionItems: Array<{ collectionId: string }>;
  createdAt: string;
  updatedAt: string;
  variants: Array<{ role: string; url: string; processingState: string }>;
};
type LibraryRecord = {
  id: string;
  name: string;
  region?: string | null;
  playerFacingDescription?: string | null;
  captainNotes?: string | null;
  shortDescription?: string | null;
  loreDescription?: string | null;
  ordinaryGameObjectLabel?: string | null;
  collectionType?: string;
  description?: string | null;
  referenceCollectionId?: string | null;
  mapAssetId?: string | null;
  displayAssetId?: string | null;
  artworkAssetId?: string | null;
  revealVideoAssetId?: string | null;
  modelAssetId?: string | null;
};
type Version = {
  id: string;
  versionLabel: string;
  publishedAt: string;
  publishedBy: string;
  releaseNotes: string | null;
  isCurrent: boolean;
  activeSessions: number;
};
type EditorData = {
  csrfToken: string;
  tale: Tale;
  draft: {
    id: string;
    autosaveVersion: number;
    validationState: string;
    validationSummary: JsonObject;
    savedAt: string;
    chapters: Chapter[];
  };
  assets: Asset[];
  collections: LibraryRecord[];
  locations: LibraryRecord[];
  artifacts: LibraryRecord[];
  versions: Version[];
  registry: RegistryItem[];
};
type DraftState = { tale: Tale; chapters: Chapter[] };

const clone = <T,>(value: T): T => structuredClone(value);

export function TaleEditor({
  taleId,
  initialSection = "story",
  authenticated,
}: {
  taleId: string;
  initialSection?: "story" | "settings" | "assets" | "locations" | "artifacts" | "versions";
  authenticated: boolean;
}) {
  const [data, setData] = useState<EditorData | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<DraftState[]>([]);
  const [future, setFuture] = useState<DraftState[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("Loading chart…");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: Array<{ message: string; blockId?: string }>;
    warnings: Array<{ message: string; blockId?: string }>;
  } | null>(null);
  const [assetDrawer, setAssetDrawer] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetMedia, setAssetMedia] = useState("ALL");
  const [assetRole, setAssetRole] = useState("ALL");
  const [assetTag, setAssetTag] = useState("ALL");
  const [assetCollection, setAssetCollection] = useState("ALL");
  const [assetContext, setAssetContext] = useState("ALL");
  const [assetUsage, setAssetUsage] = useState("ALL");
  const [assetLimit, setAssetLimit] = useState(24);
  const [libraryTab, setLibraryTab] = useState<"blocks" | "chapters" | "outline">("blocks");
  const [blockSearch, setBlockSearch] = useState("");
  const [collapsedChapters, setCollapsedChapters] = useState<string[]>([]);
  const [previewBlock, setPreviewBlock] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewReducedMotion, setPreviewReducedMotion] = useState(false);
  const [previewReplay, setPreviewReplay] = useState(0);
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySort, setLibrarySort] = useState<"name" | "region">("name");
  const saving = useRef(false);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    const response = await fetch(`/api/studio/tales/${taleId}`, { cache: "no-store" });
    const body = (await response.json()) as EditorData & { error?: string };
    if (!response.ok) {
      setError(body.error ?? "The chart could not be opened.");
      return;
    }
    setData(body);
    setDraft({ tale: body.tale, chapters: body.draft.chapters });
    setSaveState(`Saved at ${new Date(body.draft.savedAt).toLocaleTimeString()}`);
  }, [taleId]);
  useEffect(() => {
    if (!authenticated) return;
    queueMicrotask(() => void load());
  }, [authenticated, load]);

  const save = useCallback(
    async (state: DraftState, quiet = true) => {
      if (!data || saving.current) return false;
      saving.current = true;
      setSaveState("Saving…");
      if (!quiet) setError("");
      const response = await fetch(`/api/studio/tales/${taleId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": data.csrfToken },
        body: JSON.stringify({
          autosaveVersion: data.draft.autosaveVersion,
          tale: state.tale,
          chapters: state.chapters,
        }),
      });
      const body = (await response.json()) as {
        autosaveVersion?: number;
        savedAt?: string;
        error?: string;
        code?: string;
      };
      saving.current = false;
      if (!response.ok) {
        setSaveState(body.code === "DRAFT_CONFLICT" ? "Conflict — unsaved work preserved" : "Save failed");
        setError(body.error ?? "Autosave failed.");
        return false;
      }
      setData((current) =>
        current
          ? {
              ...current,
              tale: state.tale,
              draft: {
                ...current.draft,
                autosaveVersion: body.autosaveVersion ?? current.draft.autosaveVersion + 1,
                savedAt: body.savedAt ?? new Date().toISOString(),
                validationState: "STALE",
              },
            }
          : current,
      );
      setDirty(false);
      setSaveState(`Saved at ${new Date(body.savedAt ?? Date.now()).toLocaleTimeString()}`);
      return true;
    },
    [data, taleId],
  );
  useEffect(() => {
    if (!draft || !dirty) return;
    const timer = setTimeout(() => void save(draft), 1100);
    return () => clearTimeout(timer);
  }, [draft, dirty, save]);

  function change(mutator: (next: DraftState) => void) {
    if (!draft) return;
    const next = clone(draft);
    mutator(next);
    setPast((items) => [...items.slice(-24), draft]);
    setFuture([]);
    setDraft(next);
    setDirty(true);
    setSaveState("Unsaved changes");
    setValidation(null);
  }
  function undo() {
    if (!draft || !past.length) return;
    const previous = past.at(-1)!;
    setPast(past.slice(0, -1));
    setFuture([draft, ...future]);
    setDraft(previous);
    setDirty(true);
    setSaveState("Unsaved changes");
  }
  function redo() {
    if (!draft || !future.length) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, draft]);
    setDraft(next);
    setDirty(true);
    setSaveState("Unsaved changes");
  }

  const selected = useMemo(
    () =>
      draft?.chapters
        .flatMap((chapter) => chapter.blocks.map((block) => ({ chapter, block })))
        .find((item) => item.block.id === selectedId) ?? null,
    [draft, selectedId],
  );
  const selectedDefinition = data?.registry.find((item) => item.type === selected?.block.blockType);
  const referencedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!draft) return ids;
    const assetIds = new Set(data?.assets.map((asset) => asset.id) ?? []);
    const visit = (value: unknown) => {
      if (typeof value === "string" && assetIds.has(value)) ids.add(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit(draft.tale.coverAssetId);
    draft.chapters.forEach((chapter) => {
      visit(chapter.coverAssetId);
      chapter.blocks.forEach((block) => visit(block.configuration));
    });
    return ids;
  }, [data, draft]);
  const assetContexts = useMemo(() => {
    const contexts = new Map<string, Set<string>>();
    const add = (id: string | null | undefined, context: string) => {
      if (!id) return;
      const values = contexts.get(id) ?? new Set<string>();
      values.add(context);
      contexts.set(id, values);
    };
    add(draft?.tale.coverAssetId, "TALE");
    draft?.chapters.forEach((chapter) => {
      add(chapter.coverAssetId, "CHAPTER");
      const visit = (value: unknown) => {
        if (typeof value === "string" && data?.assets.some((asset) => asset.id === value)) add(value, "CHAPTER");
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") Object.values(value).forEach(visit);
      };
      chapter.blocks.forEach((block) => visit(block.configuration));
    });
    data?.locations.forEach((item) => {
      add(item.mapAssetId, "LOCATION");
      add(item.displayAssetId, "LOCATION");
    });
    data?.artifacts.forEach((item) => {
      add(item.artworkAssetId, "ARTIFACT");
      add(item.revealVideoAssetId, "ARTIFACT");
      add(item.modelAssetId, "ARTIFACT");
    });
    return contexts;
  }, [data, draft]);
  const recentAssetIds = useMemo(() => new Set(data?.assets.slice(0, 12).map((asset) => asset.id) ?? []), [data]);
  const filteredAssets = useMemo(() => {
    const query = assetSearch.toLocaleLowerCase();
    return (
      data?.assets
        .filter((asset) =>
          `${asset.displayName} ${asset.description ?? ""} ${asset.tags.join(" ")} ${asset.roles.join(" ")}`
            .toLocaleLowerCase()
            .includes(query),
        )
        .filter((asset) => assetMedia === "ALL" || asset.mediaType === assetMedia)
        .filter((asset) => assetRole === "ALL" || asset.roles.includes(assetRole))
        .filter((asset) => assetTag === "ALL" || asset.tags.includes(assetTag))
        .filter(
          (asset) =>
            assetCollection === "ALL" || asset.collectionItems.some((item) => item.collectionId === assetCollection),
        )
        .filter(
          (asset) =>
            assetUsage === "ALL" ||
            (assetUsage === "USED"
              ? referencedIds.has(asset.id)
              : assetUsage === "UNUSED"
                ? !referencedIds.has(asset.id)
                : recentAssetIds.has(asset.id)),
        )
        .filter((asset) => assetContext === "ALL" || assetContexts.get(asset.id)?.has(assetContext))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()) ?? []
    );
  }, [
    assetCollection,
    assetContext,
    assetContexts,
    assetMedia,
    assetRole,
    assetSearch,
    assetTag,
    assetUsage,
    data,
    recentAssetIds,
    referencedIds,
  ]);
  const filteredRegistry = useMemo(() => {
    const query = blockSearch.toLocaleLowerCase();
    return (
      data?.registry.filter((item) =>
        `${item.displayName} ${item.description} ${item.category}`.toLocaleLowerCase().includes(query),
      ) ?? []
    );
  }, [blockSearch, data]);
  const filteredLocations = useMemo(
    () =>
      (data?.locations ?? [])
        .filter((item) =>
          `${item.name} ${item.region ?? ""} ${item.playerFacingDescription ?? ""}`
            .toLocaleLowerCase()
            .includes(librarySearch.toLocaleLowerCase()),
        )
        .sort((left, right) =>
          librarySort === "region"
            ? (left.region ?? "").localeCompare(right.region ?? "") || left.name.localeCompare(right.name)
            : left.name.localeCompare(right.name),
        ),
    [data, librarySearch, librarySort],
  );
  const filteredArtifacts = useMemo(
    () =>
      (data?.artifacts ?? [])
        .filter((item) =>
          `${item.name} ${item.shortDescription ?? ""} ${item.loreDescription ?? ""}`
            .toLocaleLowerCase()
            .includes(librarySearch.toLocaleLowerCase()),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [data, librarySearch],
  );

  const recordUsageCount = (id: string) =>
    draft?.chapters.reduce(
      (count, chapter) =>
        count + chapter.blocks.filter((block) => JSON.stringify(block.configuration).includes(`"${id}"`)).length,
      0,
    ) ?? 0;

  function addBlock(type: string, chapterIndex: number, blockIndex?: number) {
    const definition = data?.registry.find((item) => item.type === type);
    if (!definition) return;
    const id = crypto.randomUUID();
    change((next) =>
      next.chapters[chapterIndex].blocks.splice(blockIndex ?? next.chapters[chapterIndex].blocks.length, 0, {
        id,
        blockType: type,
        title: definition.defaultTitle,
        configuration: clone(definition.defaultConfiguration),
        presentation: {},
        completion: {},
        creatorNotes: "",
        isEnabled: true,
        schemaVersion: definition.schemaVersion,
      }),
    );
    setSelectedId(id);
  }
  function moveBlock(blockId: string, chapterIndex: number, blockIndex: number) {
    change((next) => {
      let found: Block | undefined;
      for (const chapter of next.chapters) {
        const index = chapter.blocks.findIndex((block) => block.id === blockId);
        if (index >= 0) found = chapter.blocks.splice(index, 1)[0];
      }
      if (found)
        next.chapters[chapterIndex].blocks.splice(
          Math.min(blockIndex, next.chapters[chapterIndex].blocks.length),
          0,
          found,
        );
    });
  }
  function drop(event: React.DragEvent, chapterIndex: number, blockIndex: number) {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/x-tall-tale")) as {
        kind: string;
        type?: string;
        id?: string;
      };
      if (payload.kind === "library" && payload.type) addBlock(payload.type, chapterIndex, blockIndex);
      if (payload.kind === "block" && payload.id) moveBlock(payload.id, chapterIndex, blockIndex);
    } catch {}
  }
  function dndEnd(event: DragEndEvent) {
    if (!event.over || !draft) return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    if (activeId === overId) return;
    let chapterIndex = -1;
    let blockIndex = -1;
    if (overId.startsWith("drop:")) {
      const [, chapter, block] = overId.split(":");
      chapterIndex = Number(chapter);
      blockIndex = Number(block);
    } else {
      chapterIndex = draft.chapters.findIndex((chapter) => chapter.blocks.some((block) => block.id === overId));
      blockIndex = draft.chapters[chapterIndex]?.blocks.findIndex((block) => block.id === overId) ?? -1;
    }
    if (chapterIndex < 0 || blockIndex < 0) return;
    if (activeId.startsWith("library:")) addBlock(activeId.slice("library:".length), chapterIndex, blockIndex);
    else moveBlock(activeId, chapterIndex, blockIndex);
  }
  function updateSelected(mutator: (block: Block) => void) {
    if (!selectedId) return;
    change((next) => {
      const block = next.chapters.flatMap((chapter) => chapter.blocks).find((candidate) => candidate.id === selectedId);
      if (block) mutator(block);
    });
  }

  async function validate() {
    if (!draft || !data) return;
    if (dirty && !(await save(draft, false))) return;
    setSaveState("Validating…");
    const response = await fetch(`/api/studio/tales/${taleId}/validate`, {
      method: "POST",
      headers: { "x-csrf-token": data.csrfToken },
    });
    const body = (await response.json()) as typeof validation & { error?: string };
    if (!response.ok || !body) {
      setError(body?.error ?? "Validation failed.");
      return;
    }
    setValidation(body);
    setSaveState(body.valid ? "Draft validation passed" : "Draft validation failed");
  }
  async function publish() {
    if (!draft || !data) return;
    if (dirty && !(await save(draft, false))) return;
    const notes = window.prompt("Release notes for this immutable version:", "Phase 1 authoring release");
    if (notes === null || !window.confirm("Publish this saved draft as a new immutable player version?")) return;
    setSaveState("Publishing…");
    const response = await fetch(`/api/studio/tales/${taleId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": data.csrfToken },
      body: JSON.stringify({ releaseNotes: notes }),
    });
    const body = (await response.json()) as { versionLabel?: string; validation?: typeof validation; error?: string };
    if (!response.ok) {
      setError(body.error ?? "Publishing failed.");
      if (body.validation) setValidation(body.validation);
      setSaveState("Publish failed");
      return;
    }
    setSaveState(`Published as version ${body.versionLabel}`);
    await load();
  }
  async function preview(blockId?: string) {
    if (!draft || !data) return;
    if (dirty && !(await save(draft, false))) return;
    const response = await fetch(`/api/studio/tales/${taleId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": data.csrfToken },
      body: JSON.stringify({ blockId }),
    });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) return setError(body.error ?? "Preview could not be started.");
    window.open(body.url, "_blank", "noopener,noreferrer");
  }

  async function taleAction(action: "duplicate" | "archive") {
    if (!data) return;
    if (action === "archive" && !window.confirm("Archive this Tall Tale? Published sessions remain pinned and safe."))
      return;
    const response = await fetch(`/api/studio/tales/${taleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": data.csrfToken },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) return setError(body.error ?? `The tale could not be ${action}d.`);
    window.location.assign(action === "duplicate" && body.id ? `/studio/tales/${body.id}` : "/studio");
  }

  async function versionAction(version: Version, action: "preview" | "restore") {
    if (!data) return;
    if (
      action === "restore" &&
      !window.confirm(
        `Copy version ${version.versionLabel} into a new editable draft? The immutable release and current draft history will remain intact.`,
      )
    )
      return;
    const response = await fetch(`/api/studio/tales/${taleId}/versions/${version.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": data.csrfToken },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok) return setError(body.error ?? `Version ${version.versionLabel} could not be ${action}ed.`);
    if (action === "preview" && body.url) window.open(body.url, "_blank", "noopener,noreferrer");
    else {
      setSelectedId(null);
      await load();
      setSaveState(`Version ${version.versionLabel} copied into a new draft`);
    }
  }

  async function showAssetUsages(asset: Asset) {
    const response = await fetch(`/api/studio/assets/${asset.id}`, { cache: "no-store" });
    const body = (await response.json()) as { usages?: Array<{ label: string; field?: string }>; error?: string };
    if (!response.ok) return setError(body.error ?? "Asset usages could not be loaded.");
    window.alert(
      body.usages?.length
        ? `${asset.displayName} is used by:\n${body.usages.map((item) => `• ${item.label}${item.field ? ` (${item.field})` : ""}`).join("\n")}`
        : `${asset.displayName} is not referenced by the current draft.`,
    );
  }

  async function upload(files: FileList | null) {
    if (!files?.length || !data) return;
    const form = new FormData();
    for (const file of Array.from(files)) form.append("files", file);
    setSaveState(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`);
    const response = await fetch(`/api/studio/tales/${taleId}/assets`, {
      method: "POST",
      headers: { "x-csrf-token": data.csrfToken },
      body: form,
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Upload failed.");
      setSaveState("Upload failed");
      return;
    }
    await load();
    setAssetDrawer(true);
  }

  async function replaceAsset(asset: Asset, files: FileList | null) {
    const file = files?.[0];
    if (!file || !data) return;
    if (!window.confirm(`Replace ${asset.displayName} while preserving its logical asset identity?`)) return;
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/studio/assets/${asset.id}`, {
      method: "PUT",
      headers: { "x-csrf-token": data.csrfToken },
      body: form,
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setError(body.error ?? "Asset replacement failed.");
    await load();
  }

  async function editAsset(asset: Asset) {
    if (!data) return;
    const displayName = window.prompt("Display name:", asset.displayName);
    if (displayName === null) return;
    const description = window.prompt("Description:", asset.description ?? "");
    if (description === null) return;
    const tags = window.prompt("Comma-separated tags:", asset.tags.join(", "));
    if (tags === null) return;
    const roles = window.prompt("Comma-separated roles:", asset.roles.join(", "));
    if (roles === null) return;
    const collectionIds = window.prompt(
      `Collection IDs (comma-separated). Available: ${data.collections.map((item) => `${item.name}=${item.id}`).join("; ") || "none"}`,
      asset.collectionItems.map((item) => item.collectionId).join(", "),
    );
    if (collectionIds === null) return;
    const response = await fetch(`/api/studio/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": data.csrfToken },
      body: JSON.stringify({
        displayName,
        description,
        tags: tags.split(",").map((item) => item.trim()),
        roles: roles
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        collectionIds: collectionIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setError(body.error ?? "Asset metadata could not be saved.");
    await load();
  }

  async function libraryAction(
    entity: "collection" | "location" | "artifact",
    action: "create" | "update" | "archive",
    id?: string,
  ) {
    if (!data) return;
    let values: JsonObject = {};
    if (action === "create" || action === "update") {
      const existing =
        entity === "collection"
          ? data.collections.find((item) => item.id === id)
          : entity === "location"
            ? data.locations.find((item) => item.id === id)
            : data.artifacts.find((item) => item.id === id);
      const name = window.prompt(`${action === "create" ? "Name the new" : "Rename"} ${entity}:`, existing?.name);
      if (!name) return;
      values = { name };
      if (entity === "collection") {
        values.description = window.prompt("Collection description (optional):", existing?.description ?? "") ?? "";
        values.collectionType =
          window.prompt(
            "Collection type (GENERAL, LOCATION_REFERENCE, NEGATIVE_REFERENCE, or ARTIFACT):",
            existing?.collectionType ?? "GENERAL",
          ) ?? "GENERAL";
      }
      if (entity === "location") {
        values.region = window.prompt("Region (optional):", existing?.region ?? "") ?? "";
        values.playerFacingDescription =
          window.prompt("Player-facing description:", existing?.playerFacingDescription ?? "") ?? "";
        values.captainNotes = window.prompt("Private Captain notes:", existing?.captainNotes ?? "") ?? "";
        values.referenceCollectionId =
          window.prompt("Reference collection ID (optional):", existing?.referenceCollectionId ?? "") ?? "";
      }
      if (entity === "artifact") {
        values.ordinaryGameObjectLabel =
          window.prompt("Ordinary in-game object (optional):", existing?.ordinaryGameObjectLabel ?? "") ?? "";
        values.shortDescription = window.prompt("Short description:", existing?.shortDescription ?? "") ?? "";
        values.loreDescription = window.prompt("Lore description:", existing?.loreDescription ?? "") ?? "";
      }
    } else if (!window.confirm(`Archive this ${entity}?`)) return;
    const response = await fetch(`/api/studio/tales/${taleId}/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": data.csrfToken },
      body: JSON.stringify({ entity, action, id, data: values }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setError(body.error ?? "Library update failed.");
    await load();
  }

  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <section>
          <h1>Creator authentication required</h1>
          <Link className="brass-button" href="/quartermaster">
            Open Quartermaster login
          </Link>
        </section>
      </main>
    );
  if (!data || !draft) return <main className="studio-loading">{error || "Unrolling the Tall Tale chart…"}</main>;

  const nav = ["story", "settings", "assets", "locations", "artifacts", "versions"] as const;
  return (
    <main className="tale-editor">
      <header className="editor-topbar">
        <div>
          <Link href="/studio">← Studio</Link>
          <span className="draft-mark">Draft</span>
          <h1>{draft.tale.title}</h1>
        </div>
        <div className="editor-history">
          <button disabled={!past.length} onClick={undo} aria-label="Undo last edit">
            ↶ Undo
          </button>
          <button disabled={!future.length} onClick={redo} aria-label="Redo edit">
            ↷ Redo
          </button>
        </div>
        <p
          className={`save-state ${saveState.includes("failed") || saveState.includes("Conflict") ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {saveState}
        </p>
        <div className="editor-primary-actions">
          <button disabled={!selected} onClick={() => setPreviewBlock(true)}>
            Preview Block
          </button>
          <button onClick={() => void preview()}>Full Tale Preview</button>
          <button disabled={!selected} onClick={() => void preview(selected?.block.id)}>
            Play From Here
          </button>
          <button onClick={() => void validate()}>Validate</button>
          <button className="publish-button" onClick={() => void publish()}>
            Publish
          </button>
          <details className="editor-more">
            <summary>More</summary>
            <div>
              <Link href={`/studio/tales/${taleId}/settings`}>Tale settings</Link>
              <Link href={`/studio/tales/${taleId}/versions`}>Version history</Link>
              <button onClick={() => void taleAction("duplicate")}>Duplicate tale</button>
              <button className="danger" onClick={() => void taleAction("archive")}>
                Archive tale
              </button>
            </div>
          </details>
        </div>
      </header>
      <nav className="editor-section-nav" aria-label="Tall Tale authoring sections">
        {nav.map((item) => (
          <Link
            key={item}
            className={initialSection === item ? "active" : ""}
            href={item === "story" ? `/studio/tales/${taleId}` : `/studio/tales/${taleId}/${item}`}
          >
            {item}
          </Link>
        ))}
      </nav>
      {error && (
        <div className="editor-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {validation && (
        <aside className={`validation-panel ${validation.valid ? "valid" : "invalid"}`}>
          <header>
            <strong>
              {validation.valid
                ? "Draft is publishable"
                : `${validation.errors.length} blocking issue${validation.errors.length === 1 ? "" : "s"}`}
            </strong>
            <button onClick={() => setValidation(null)}>Close</button>
          </header>
          {[...validation.errors, ...validation.warnings].map((issue, index) => (
            <button key={`${issue.message}-${index}`} onClick={() => issue.blockId && setSelectedId(issue.blockId)}>
              {issue.message}
            </button>
          ))}
        </aside>
      )}
      {initialSection === "story" && (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={dndEnd}>
          <div className="editor-workbench">
            <aside className="block-library">
              <div>
                <p className="eyebrow">Block library</p>
                <h2>Story pieces</h2>
                <p>Build, navigate, and inspect the complete story flow.</p>
              </div>
              <div className="library-tabs" role="tablist" aria-label="Story tools">
                {(["blocks", "chapters", "outline"] as const).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={libraryTab === tab}
                    className={libraryTab === tab ? "active" : ""}
                    onClick={() => setLibraryTab(tab)}
                  >
                    {tab === "blocks" ? "Blocks" : tab === "chapters" ? "Chapters" : "Outline"}
                  </button>
                ))}
              </div>
              {libraryTab === "blocks" && (
                <>
                  <input
                    className="block-search"
                    type="search"
                    value={blockSearch}
                    onChange={(event) => setBlockSearch(event.target.value)}
                    placeholder="Search blocks"
                    aria-label="Search story blocks"
                  />
                  {[...new Set(filteredRegistry.map((item) => item.category))].map((category) => (
                    <details key={category} open>
                      <summary>{category}</summary>
                      {filteredRegistry
                        .filter((item) => item.category === category)
                        .map((item) => (
                          <DraggableLibraryItem key={item.type} item={item} onAdd={() => addBlock(item.type, 0)} />
                        ))}
                    </details>
                  ))}
                </>
              )}
              {libraryTab === "chapters" && (
                <nav className="chapter-navigator" aria-label="Chapter navigator">
                  {draft.chapters.map((chapter, index) => (
                    <button
                      key={chapter.id}
                      onClick={() =>
                        document.getElementById(`chapter-${chapter.id}`)?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{chapter.title}</strong>
                      <small>{chapter.blocks.length} blocks</small>
                    </button>
                  ))}
                </nav>
              )}
              {libraryTab === "outline" && (
                <ol className="story-outline">
                  {draft.chapters.flatMap((chapter) =>
                    chapter.blocks.map((block, index) => (
                      <li key={block.id}>
                        <button onClick={() => setSelectedId(block.id)}>
                          <span>{index + 1}</span>
                          <strong>{block.title}</strong>
                          <small>{block.blockType}</small>
                        </button>
                      </li>
                    )),
                  )}
                </ol>
              )}
            </aside>
            <section className="story-canvas" aria-label="Story timeline">
              <header>
                <div>
                  <p className="eyebrow">Vertical story graph</p>
                  <h2>
                    {draft.chapters.length} chapter{draft.chapters.length === 1 ? "" : "s"}
                  </h2>
                </div>
                <button
                  onClick={() =>
                    change((next) =>
                      next.chapters.push({
                        id: crypto.randomUUID(),
                        title: `Chapter ${next.chapters.length + 1}`,
                        subtitle: "",
                        description: "",
                        coverAssetId: null,
                        estimatedDuration: null,
                        isOptional: false,
                        metadata: {},
                        blocks: [],
                      }),
                    )
                  }
                >
                  + Add chapter
                </button>
              </header>
              {draft.chapters.map((chapter, chapterIndex) => (
                <article className="chapter-timeline" id={`chapter-${chapter.id}`} key={chapter.id}>
                  <header>
                    <span>{String(chapterIndex + 1).padStart(2, "0")}</span>
                    <input
                      value={chapter.title}
                      aria-label={`Chapter ${chapterIndex + 1} title`}
                      onChange={(event) =>
                        change((next) => {
                          next.chapters[chapterIndex].title = event.target.value;
                        })
                      }
                    />
                    <div>
                      <button
                        onClick={() =>
                          setCollapsedChapters((items) =>
                            items.includes(chapter.id)
                              ? items.filter((id) => id !== chapter.id)
                              : [...items, chapter.id],
                          )
                        }
                        aria-expanded={!collapsedChapters.includes(chapter.id)}
                        aria-label={`${collapsedChapters.includes(chapter.id) ? "Expand" : "Collapse"} ${chapter.title}`}
                      >
                        {collapsedChapters.includes(chapter.id) ? "+" : "−"}
                      </button>
                      <button
                        disabled={chapterIndex === 0}
                        onClick={() =>
                          change((next) => {
                            const [item] = next.chapters.splice(chapterIndex, 1);
                            next.chapters.splice(chapterIndex - 1, 0, item);
                          })
                        }
                        aria-label="Move chapter up"
                      >
                        ↑
                      </button>
                      <button
                        disabled={chapterIndex === draft.chapters.length - 1}
                        onClick={() =>
                          change((next) => {
                            const [item] = next.chapters.splice(chapterIndex, 1);
                            next.chapters.splice(chapterIndex + 1, 0, item);
                          })
                        }
                        aria-label="Move chapter down"
                      >
                        ↓
                      </button>
                    </div>
                  </header>
                  {!collapsedChapters.includes(chapter.id) && (
                    <SortableContext
                      items={chapter.blocks.map((block) => block.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <DropZone id={`drop:${chapterIndex}:0`} onDrop={(event) => drop(event, chapterIndex, 0)} />
                      {!chapter.blocks.length && <div className="empty-chapter">Drop the first story block here.</div>}
                      {chapter.blocks.map((block, blockIndex) => {
                        const definition = data.registry.find((item) => item.type === block.blockType);
                        return (
                          <SortableStoryBlock key={block.id} id={block.id}>
                            {(attributes, listeners) => (
                              <>
                                <article
                                  className={`timeline-block ${selectedId === block.id ? "selected" : ""}`}
                                  onClick={() => setSelectedId(block.id)}
                                >
                                  <button
                                    className="drag-handle"
                                    {...attributes}
                                    {...listeners}
                                    onClick={(event) => event.stopPropagation()}
                                    aria-label={`Move ${block.title}. Press Space to pick up, arrow keys to move, and Space to drop.`}
                                  >
                                    ⠿
                                  </button>
                                  <span className="block-icon" aria-hidden="true">
                                    {definition?.icon ?? "?"}
                                  </span>
                                  <div>
                                    <small>{definition?.displayName ?? block.blockType}</small>
                                    <strong>{block.title}</strong>
                                    <p>
                                      {String(
                                        block.configuration.heading ??
                                          block.configuration.prompt ??
                                          block.configuration.caption ??
                                          block.configuration.body ??
                                          definition?.description ??
                                          "",
                                      ).slice(0, 130)}
                                    </p>
                                  </div>
                                  <div className="block-move">
                                    <button
                                      disabled={blockIndex === 0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        moveBlock(block.id, chapterIndex, blockIndex - 1);
                                      }}
                                      aria-label="Move block up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      disabled={
                                        blockIndex === chapter.blocks.length - 1 &&
                                        chapterIndex === draft.chapters.length - 1
                                      }
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (blockIndex < chapter.blocks.length - 1)
                                          moveBlock(block.id, chapterIndex, blockIndex + 2);
                                        else
                                          moveBlock(block.id, Math.min(chapterIndex + 1, draft.chapters.length - 1), 0);
                                      }}
                                      aria-label="Move block down"
                                    >
                                      ↓
                                    </button>
                                  </div>
                                </article>
                                <DropZone
                                  id={`drop:${chapterIndex}:${blockIndex + 1}`}
                                  onDrop={(event) => drop(event, chapterIndex, blockIndex + 1)}
                                />
                              </>
                            )}
                          </SortableStoryBlock>
                        );
                      })}
                      <button className="chapter-add" onClick={() => addBlock("narrative", chapterIndex)}>
                        + Add block
                      </button>
                    </SortableContext>
                  )}
                </article>
              ))}
            </section>
            <aside className={`block-inspector ${selected ? "has-selection" : "empty"}`}>
              {selected && selectedDefinition ? (
                <>
                  <header>
                    <button
                      className="inspector-mobile-close"
                      onClick={() => setSelectedId(null)}
                      aria-label="Close block inspector"
                    >
                      ×
                    </button>
                    <p className="eyebrow">{selectedDefinition.displayName}</p>
                    <input
                      value={selected.block.title}
                      aria-label="Block title"
                      onChange={(event) =>
                        updateSelected((block) => {
                          block.title = event.target.value;
                        })
                      }
                    />
                  </header>
                  <div className="inspector-fields">
                    {selectedDefinition.fields.map((field) => (
                      <Field
                        key={field.key}
                        field={field}
                        value={selected.block.configuration[field.key]}
                        assets={data.assets}
                        locations={data.locations}
                        artifacts={data.artifacts}
                        onChange={(value) =>
                          updateSelected((block) => {
                            block.configuration[field.key] = value;
                          })
                        }
                      />
                    ))}
                    {selected.block.blockType === "imageTransformation" && (
                      <AlignmentEditor
                        value={selected.block.configuration.alignment}
                        assets={data.assets}
                        beforeId={String(selected.block.configuration.beforeAssetId ?? "")}
                        afterId={String(selected.block.configuration.afterAssetId ?? "")}
                        onChange={(value) =>
                          updateSelected((block) => {
                            block.configuration.alignment = value;
                          })
                        }
                      />
                    )}
                    <label>
                      <span>Private creator notes</span>
                      <textarea
                        rows={5}
                        value={selected.block.creatorNotes ?? ""}
                        onChange={(event) =>
                          updateSelected((block) => {
                            block.creatorNotes = event.target.value;
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="inspector-danger">
                    <button
                      onClick={() => {
                        const id = selected.block.id;
                        change((next) => {
                          const chapter = next.chapters.find((item) => item.id === selected.chapter.id);
                          if (chapter) {
                            const source = chapter.blocks.find((item) => item.id === id);
                            if (source)
                              chapter.blocks.splice(chapter.blocks.indexOf(source) + 1, 0, {
                                ...clone(source),
                                id: crypto.randomUUID(),
                                title: `${source.title} Copy`,
                              });
                          }
                        });
                      }}
                    >
                      Duplicate block
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Delete “${selected.block.title}”?`)) return;
                        change((next) => {
                          for (const chapter of next.chapters)
                            chapter.blocks = chapter.blocks.filter((block) => block.id !== selected.block.id);
                        });
                        setSelectedId(null);
                      }}
                    >
                      Delete block
                    </button>
                  </div>
                </>
              ) : (
                <div className="inspector-empty">
                  <span>☞</span>
                  <h2>Select a story block</h2>
                  <p>Its content, presentation, verification, assets, and private notes will appear here.</p>
                </div>
              )}
            </aside>
          </div>
        </DndContext>
      )}
      {previewBlock && selected && (
        <div className="block-preview-backdrop" role="presentation" onMouseDown={() => setPreviewBlock(false)}>
          <section
            className="block-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">Isolated player preview</p>
                <h2 id="block-preview-title">{selected.block.title}</h2>
              </div>
              <button onClick={() => setPreviewBlock(false)} aria-label="Close block preview">
                ×
              </button>
            </header>
            <div className="block-preview-toolbar">
              <div role="group" aria-label="Preview viewport">
                <button
                  className={previewViewport === "desktop" ? "active" : ""}
                  onClick={() => setPreviewViewport("desktop")}
                >
                  Desktop
                </button>
                <button
                  className={previewViewport === "mobile" ? "active" : ""}
                  onClick={() => setPreviewViewport("mobile")}
                >
                  Mobile
                </button>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={previewReducedMotion}
                  onChange={(event) => setPreviewReducedMotion(event.target.checked)}
                />
                Reduced motion
              </label>
              <button onClick={() => setPreviewReplay((value) => value + 1)}>Replay block</button>
            </div>
            <div
              className={`block-preview-viewport ${previewViewport} ${previewReducedMotion ? "reduced-motion" : ""}`}
            >
              <PublishedBlockView
                key={previewReplay}
                block={selected.block}
                assets={data.assets.map((asset) => ({
                  id: asset.id,
                  displayName: asset.displayName,
                  url: `/api/media/${asset.id}?variant=PREVIEW&version=draft:${data.draft.id}`,
                }))}
              />
            </div>
            <aside className="block-preview-validation">
              <strong>Validation</strong>
              {validation ? (
                [...validation.errors, ...validation.warnings].filter((issue) => issue.blockId === selected.block.id)
                  .length ? (
                  [...validation.errors, ...validation.warnings]
                    .filter((issue) => issue.blockId === selected.block.id)
                    .map((issue, index) => <p key={`${issue.message}-${index}`}>{issue.message}</p>)
                ) : (
                  <p>No reported issue for this block in the last draft validation.</p>
                )
              ) : (
                <p>Run Validate to show schema and connection issues beside this preview.</p>
              )}
            </aside>
          </section>
        </div>
      )}
      {initialSection === "settings" && (
        <section className="editor-single-panel settings-panel">
          <header>
            <p className="eyebrow">Tale identity</p>
            <h2>Settings</h2>
          </header>
          <div className="settings-grid">
            <label>
              <span>Title</span>
              <input
                value={draft.tale.title}
                onChange={(event) =>
                  change((next) => {
                    next.tale.title = event.target.value;
                  })
                }
              />
            </label>
            <label>
              <span>Address</span>
              <input
                value={draft.tale.slug}
                onChange={(event) =>
                  change((next) => {
                    next.tale.slug = event.target.value.toLocaleLowerCase();
                  })
                }
              />
            </label>
            <label>
              <span>Subtitle</span>
              <input
                value={draft.tale.subtitle ?? ""}
                onChange={(event) =>
                  change((next) => {
                    next.tale.subtitle = event.target.value;
                  })
                }
              />
            </label>
            <label>
              <span>Visibility</span>
              <select
                value={draft.tale.visibility}
                onChange={(event) =>
                  change((next) => {
                    next.tale.visibility = event.target.value;
                  })
                }
              >
                <option value="PRIVATE">Private</option>
                <option value="UNLISTED">Unlisted</option>
                <option value="PUBLIC">Public</option>
              </select>
            </label>
            <label className="wide">
              <span>Short description</span>
              <textarea
                value={draft.tale.shortDescription ?? ""}
                onChange={(event) =>
                  change((next) => {
                    next.tale.shortDescription = event.target.value;
                  })
                }
              />
            </label>
            <label className="wide">
              <span>Long description</span>
              <textarea
                rows={8}
                value={draft.tale.longDescription ?? ""}
                onChange={(event) =>
                  change((next) => {
                    next.tale.longDescription = event.target.value;
                  })
                }
              />
            </label>
            <label>
              <span>Estimated minutes</span>
              <input
                type="number"
                value={draft.tale.estimatedDuration ?? ""}
                onChange={(event) =>
                  change((next) => {
                    next.tale.estimatedDuration = event.target.value ? Number(event.target.value) : null;
                  })
                }
              />
            </label>
            <label>
              <span>Cover asset</span>
              <select
                value={draft.tale.coverAssetId ?? ""}
                onChange={(event) =>
                  change((next) => {
                    next.tale.coverAssetId = event.target.value || null;
                  })
                }
              >
                <option value="">No cover</option>
                {data.assets
                  .filter((asset) => asset.mediaType === "IMAGE")
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.displayName}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </section>
      )}
      {initialSection === "assets" && (
        <LibraryPanel
          title="Asset Library"
          eyebrow="Reusable media"
          action={
            <>
              <button onClick={() => setAssetDrawer(true)}>Upload media</button>
              <button onClick={() => void libraryAction("collection", "create")}>New collection</button>
            </>
          }
        >
          <div className="asset-search">
            <input
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Search names, tags, and roles"
            />
            <span>{filteredAssets.length} assets</span>
          </div>
          <div className="asset-filters" aria-label="Asset filters">
            <select value={assetMedia} onChange={(event) => setAssetMedia(event.target.value)} aria-label="Media type">
              <option value="ALL">All media</option>
              {[...new Set(data.assets.map((asset) => asset.mediaType))].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <select value={assetContext} onChange={(event) => setAssetContext(event.target.value)} aria-label="Used by">
              <option value="ALL">Any context</option>
              <option value="TALE">Tale cover</option>
              <option value="CHAPTER">Chapter / block</option>
              <option value="LOCATION">Location</option>
              <option value="ARTIFACT">Artifact</option>
            </select>
            <select value={assetRole} onChange={(event) => setAssetRole(event.target.value)} aria-label="Asset role">
              <option value="ALL">All roles</option>
              {[...new Set(data.assets.flatMap((asset) => asset.roles))].sort().map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
            <select value={assetTag} onChange={(event) => setAssetTag(event.target.value)} aria-label="Asset tag">
              <option value="ALL">All tags</option>
              {[...new Set(data.assets.flatMap((asset) => asset.tags))].sort().map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </select>
            <select
              value={assetCollection}
              onChange={(event) => setAssetCollection(event.target.value)}
              aria-label="Collection"
            >
              <option value="ALL">All collections</option>
              {data.collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
            <select value={assetUsage} onChange={(event) => setAssetUsage(event.target.value)} aria-label="Asset usage">
              <option value="ALL">All usage</option>
              <option value="RECENT">Recently added</option>
              <option value="USED">Used</option>
              <option value="UNUSED">Unused</option>
            </select>
          </div>
          <div className="asset-grid">
            {filteredAssets.slice(0, assetLimit).map((asset) => (
              <article key={asset.id}>
                {asset.mediaType === "IMAGE" ? (
                  <img loading="lazy" src={`/api/media/${asset.id}?variant=THUMBNAIL`} alt="" />
                ) : (
                  <div className="asset-kind">{asset.mediaType}</div>
                )}
                <h3>{asset.displayName}</h3>
                <p>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : asset.mimeType}</p>
                <div>
                  {asset.roles.map((role) => (
                    <span key={role}>{role}</span>
                  ))}
                  {asset.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <div className="asset-card-actions">
                  <button onClick={() => void editAsset(asset)}>Edit metadata</button>
                  <button onClick={() => void showAssetUsages(asset)}>View usages</button>
                  <a href={`/api/media/${asset.id}?variant=ORIGINAL&download=1`}>Download original</a>
                  <label className="asset-replace">
                    Replace file
                    <input type="file" onChange={(event) => void replaceAsset(asset, event.target.files)} />
                  </label>
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Archive ${asset.displayName}? Referenced assets will be protected.`)) return;
                    const response = await fetch(`/api/studio/assets/${asset.id}`, {
                      method: "DELETE",
                      headers: { "x-csrf-token": data.csrfToken },
                    });
                    const body = (await response.json()) as { usages?: Array<{ label: string }>; error?: string };
                    if (!response.ok)
                      setError(
                        body.usages?.length
                          ? `Still used by: ${body.usages.map((item) => item.label).join(", ")}`
                          : (body.error ?? "Could not archive asset."),
                      );
                    else await load();
                  }}
                >
                  Archive
                </button>
              </article>
            ))}
          </div>
          {assetLimit < filteredAssets.length && (
            <button className="asset-show-more" onClick={() => setAssetLimit((value) => value + 24)}>
              Show 24 more assets
            </button>
          )}
          <h3>Collections</h3>
          <div className="record-list">
            {data.collections.map((item) => (
              <article key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.collectionType}</span>
                <button onClick={() => void libraryAction("collection", "update", item.id)}>Edit</button>
                <button onClick={() => void libraryAction("collection", "archive", item.id)}>Delete</button>
              </article>
            ))}
          </div>
        </LibraryPanel>
      )}
      {initialSection === "locations" && (
        <LibraryPanel
          title="Locations"
          eyebrow="Destinations and verification references"
          action={<button onClick={() => void libraryAction("location", "create")}>Create location</button>}
        >
          <p className="panel-note">
            Reference and negative-reference collections can be prepared now for the future vision helper. Recognition
            is not active in Phase 1.
          </p>
          <div className="library-filters">
            <input
              type="search"
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              placeholder="Search locations"
            />
            <select value={librarySort} onChange={(event) => setLibrarySort(event.target.value as "name" | "region")}>
              <option value="name">Sort by name</option>
              <option value="region">Sort by region</option>
            </select>
          </div>
          <div className="record-grid">
            {filteredLocations.map((item) => (
              <article key={item.id}>
                <p className="card-kicker">{item.region || "Uncharted region"}</p>
                <h3>{item.name}</h3>
                <p>{item.playerFacingDescription || "No player description yet."}</p>
                <small>
                  {item.referenceCollectionId ? "Reference collection assigned" : "No verification references"}
                </small>
                <small>Used by {recordUsageCount(item.id)} story blocks</small>
                <button onClick={() => void libraryAction("location", "update", item.id)}>Edit</button>
                <button onClick={() => void libraryAction("location", "create", item.id)}>Duplicate</button>
                <button onClick={() => void libraryAction("location", "archive", item.id)}>Archive</button>
              </article>
            ))}
          </div>
        </LibraryPanel>
      )}
      {initialSection === "artifacts" && (
        <LibraryPanel
          title="Artifacts"
          eyebrow="Lore and collection rewards"
          action={<button onClick={() => void libraryAction("artifact", "create")}>Create artifact</button>}
        >
          <div className="library-filters">
            <input
              type="search"
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              placeholder="Search artifacts"
            />
            <select value={librarySort} onChange={(event) => setLibrarySort(event.target.value as "name" | "region")}>
              <option value="name">Sort by name</option>
            </select>
          </div>
          <div className="record-grid">
            {filteredArtifacts.map((item) => (
              <article key={item.id}>
                <p className="card-kicker">{item.ordinaryGameObjectLabel || "Story object"}</p>
                <h3>{item.name}</h3>
                <p>{item.shortDescription || item.loreDescription || "No lore has been written."}</p>
                <small>Used by {recordUsageCount(item.id)} story blocks</small>
                <button onClick={() => void libraryAction("artifact", "update", item.id)}>Edit</button>
                <button onClick={() => void libraryAction("artifact", "create", item.id)}>Duplicate</button>
                <button onClick={() => void libraryAction("artifact", "archive", item.id)}>Archive</button>
              </article>
            ))}
          </div>
        </LibraryPanel>
      )}
      {initialSection === "versions" && (
        <LibraryPanel
          title="Version History"
          eyebrow="Immutable releases"
          action={<button onClick={() => void publish()}>Publish current draft</button>}
        >
          <div className="version-list">
            {!data.versions.length && <p>No published version exists yet.</p>}
            {data.versions.map((version) => (
              <article key={version.id}>
                <span className={version.isCurrent ? "current" : ""}>v{version.versionLabel}</span>
                <div>
                  <strong>{new Date(version.publishedAt).toLocaleString()}</strong>
                  <p>{version.releaseNotes || "No release notes."}</p>
                </div>
                <small>
                  {version.activeSessions} pinned session{version.activeSessions === 1 ? "" : "s"}
                </small>
                <div className="version-actions">
                  <button onClick={() => void versionAction(version, "preview")}>Preview release</button>
                  <button onClick={() => void versionAction(version, "restore")}>Copy into new draft</button>
                </div>
              </article>
            ))}
          </div>
        </LibraryPanel>
      )}
      {(assetDrawer || initialSection === "assets") && (
        <aside className={`asset-drawer ${assetDrawer ? "open" : "page-open"}`} aria-label="Asset drawer">
          <header>
            <div>
              <p className="eyebrow">Media hold</p>
              <h2>Upload and reuse assets</h2>
            </div>
            <button onClick={() => setAssetDrawer(false)} aria-label="Close asset drawer">
              ×
            </button>
          </header>
          <label
            className="upload-drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void upload(event.dataTransfer.files);
            }}
          >
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf"
              onChange={(event) => void upload(event.target.files)}
            />
            <strong>Drop files or choose from this device</strong>
            <span>Originals are preserved; image thumbnails and player variants are generated.</span>
          </label>
          <div className="drawer-filters">
            <input
              type="search"
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Search media"
            />
            <select
              value={assetUsage}
              onChange={(event) => setAssetUsage(event.target.value)}
              aria-label="Drawer usage filter"
            >
              <option value="ALL">All media</option>
              <option value="RECENT">Recent</option>
              <option value="UNUSED">Unused</option>
            </select>
            <select
              value={assetCollection}
              onChange={(event) => setAssetCollection(event.target.value)}
              aria-label="Drawer collection filter"
            >
              <option value="ALL">All collections</option>
              {data.collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>
          <div className="drawer-assets">
            {filteredAssets.slice(0, 24).map((asset) => (
              <button
                key={asset.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData(
                    "application/x-tall-tale-asset",
                    JSON.stringify({ id: asset.id, mediaType: asset.mediaType }),
                  );
                }}
                onClick={() => {
                  if (selected)
                    updateSelected((block) => {
                      const firstAssetField = selectedDefinition?.fields.find(
                        (field) =>
                          field.kind === "asset" &&
                          (!field.mediaTypes?.length || field.mediaTypes.includes(asset.mediaType)),
                      );
                      if (firstAssetField) block.configuration[firstAssetField.key] = asset.id;
                    });
                }}
              >
                <span>
                  {asset.mediaType === "IMAGE" ? (
                    <img loading="lazy" src={`/api/media/${asset.id}?variant=THUMBNAIL`} alt="" />
                  ) : (
                    asset.mediaType
                  )}
                </span>
                <strong>{asset.displayName}</strong>
              </button>
            ))}
          </div>
        </aside>
      )}
    </main>
  );
}

function DraggableLibraryItem({ item, onAdd }: { item: RegistryItem; onAdd: () => void }) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `library:${item.type}`,
    data: { kind: "library", type: item.type },
    attributes: { roleDescription: "sortable story block" },
  });
  return (
    <article
      ref={setNodeRef}
      className={isDragging ? "dnd-dragging" : ""}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      <span aria-hidden="true">{item.icon}</span>
      <div>
        <strong>{item.displayName}</strong>
        <small>{item.description}</small>
      </div>
      <button onClick={onAdd} aria-label={`Add ${item.displayName} to first chapter`}>
        Add
      </button>
    </article>
  );
}

function SortableStoryBlock({
  id,
  children,
}: {
  id: string;
  children: (attributes: DraggableAttributes, listeners: DraggableSyntheticListeners) => React.ReactNode;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "dnd-dragging" : ""}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(attributes, listeners)}
    </div>
  );
}

function DropZone({ id, onDrop }: { id: string; onDrop: (event: React.DragEvent) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`timeline-drop ${isOver ? "dnd-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
      }}
      onDrop={onDrop}
    >
      <span>Drop here</span>
    </div>
  );
}

function Field({
  field,
  value,
  assets,
  locations,
  artifacts,
  onChange,
}: {
  field: InspectorField;
  value: unknown;
  assets: Asset[];
  locations: LibraryRecord[];
  artifacts: LibraryRecord[];
  onChange: (value: unknown) => void;
}) {
  const label = (
    <span>
      {field.label}
      {field.required && <b aria-label="required"> *</b>}
    </span>
  );
  if (field.kind === "textarea")
    return (
      <label>
        {label}
        <textarea rows={5} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
        {field.help && <small>{field.help}</small>}
      </label>
    );
  if (field.kind === "boolean")
    return (
      <label className="check-field">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
    );
  if (field.kind === "number")
    return (
      <label>
        {label}
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        />
      </label>
    );
  if (field.kind === "select")
    return (
      <label>
        {label}
        <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.kind === "asset")
    return (
      <label
        className="asset-field-drop"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("application/x-tall-tale-asset")) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          try {
            const dropped = JSON.parse(event.dataTransfer.getData("application/x-tall-tale-asset")) as {
              id?: string;
              mediaType?: string;
            };
            if (
              dropped.id &&
              assets.some(
                (asset) =>
                  asset.id === dropped.id && (!field.mediaTypes?.length || field.mediaTypes.includes(asset.mediaType)),
              )
            )
              onChange(dropped.id);
          } catch {}
        }}
      >
        {label}
        <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">No asset selected</option>
          {assets
            .filter((asset) => !field.mediaTypes?.length || field.mediaTypes.includes(asset.mediaType))
            .map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.displayName} · {asset.mediaType.toLocaleLowerCase()}
              </option>
            ))}
        </select>
        <small>Choose an asset or drag one here from the media drawer.</small>
      </label>
    );
  if (field.kind === "location" || field.kind === "artifact") {
    const records = field.kind === "location" ? locations : artifacts;
    return (
      <label>
        {label}
        <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">Choose {field.kind}</option>
          {records.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.kind === "json")
    return (
      <label>
        {label}
        <textarea
          rows={5}
          defaultValue={JSON.stringify(
            value ?? (["acceptedAnswers", "hints", "choices"].includes(field.key) ? [] : {}),
            null,
            2,
          )}
          onBlur={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
              event.target.setCustomValidity("");
            } catch {
              event.target.setCustomValidity("Enter valid JSON.");
              event.target.reportValidity();
            }
          }}
        />
      </label>
    );
  return (
    <label>
      {label}
      <input value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
      {field.help && <small>{field.help}</small>}
    </label>
  );
}

function AlignmentEditor({
  value,
  assets,
  beforeId,
  afterId,
  onChange,
}: {
  value: unknown;
  assets: Asset[];
  beforeId: string;
  afterId: string;
  onChange: (value: JsonObject) => void;
}) {
  const alignment =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : { x: 0, y: 0, scale: 1, rotation: 0, opacity: 50, focalX: 50, focalY: 50 };
  const before = assets.find((asset) => asset.id === beforeId);
  const after = assets.find((asset) => asset.id === afterId);
  const set = (key: string, next: number) => onChange({ ...alignment, [key]: next });
  return (
    <fieldset className="alignment-editor">
      <legend>Before / after alignment</legend>
      <div className="alignment-stage">
        {before && <img src={`/api/media/${before.id}?variant=PREVIEW`} alt="Before alignment reference" />}
        {after && (
          <img
            src={`/api/media/${after.id}?variant=PREVIEW`}
            alt="After alignment reference"
            style={{
              opacity: Number(alignment.opacity ?? 50) / 100,
              transform: `translate(${Number(alignment.x ?? 0)}px, ${Number(alignment.y ?? 0)}px) scale(${Number(alignment.scale ?? 1)}) rotate(${Number(alignment.rotation ?? 0)}deg)`,
            }}
          />
        )}
      </div>
      {(
        [
          ["opacity", 0, 100, 1],
          ["x", -200, 200, 1],
          ["y", -200, 200, 1],
          ["scale", 0.5, 2, 0.01],
          ["rotation", -20, 20, 0.5],
        ] as const
      ).map(([key, min, max, step]) => (
        <label key={key}>
          <span>
            {key} <b>{String(alignment[key] ?? (key === "scale" ? 1 : 0))}</b>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={Number(alignment[key] ?? (key === "scale" ? 1 : 0))}
            onChange={(event) => set(key, Number(event.target.value))}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => onChange({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 50, focalX: 50, focalY: 50 })}
      >
        Reset alignment
      </button>
    </fieldset>
  );
}

function LibraryPanel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="editor-single-panel library-panel">
      <header>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
