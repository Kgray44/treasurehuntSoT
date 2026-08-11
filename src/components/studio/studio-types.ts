import type { InspectorField, JsonObject } from "@/chronicle/types";

export type Block = {
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
  /** Legacy mirror only; canonical BlockConnection remains the edge authority. */
  nextBlockId?: string | null;
  connections?: Array<{
    targetBlockId: string;
    connectionType: string;
    label?: string | null;
    conditionExpression?: string | null;
    orderIndex?: number;
  }>;
};

export type Chapter = {
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

export type Tale = {
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

export type RegistryItem = {
  type: string;
  displayName: string;
  category: string;
  icon: string;
  description: string;
  defaultTitle: string;
  defaultConfiguration: JsonObject;
  defaultPresentation?: JsonObject;
  defaultCompletion?: JsonObject;
  fields: InspectorField[];
  schemaVersion: number;
};

export type Asset = {
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

export type LibraryRecord = {
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

export type Version = {
  id: string;
  versionLabel: string;
  publishedAt: string;
  publishedBy: string;
  releaseNotes: string | null;
  isCurrent: boolean;
  activeSessions: number;
};

export type VersionComparison = {
  left: { label: string };
  right: { label: string };
  summary: Record<string, number>;
  changes: Array<{ type: string; path: string; before?: string; after?: string }>;
  compatibilityWarnings: string[];
};

export type EditorData = {
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

export type DraftState = { tale: Tale; chapters: Chapter[] };

export type UploadEntry = {
  id: string;
  name: string;
  state: "queued" | "uploading" | "ready" | "failed";
  detail?: string;
};

export type DeletedBlock = { chapterId: string; index: number; block: Block };
