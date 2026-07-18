export type JsonObject = Record<string, unknown>;

export type InspectorField = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "boolean" | "select" | "asset" | "location" | "artifact" | "json";
  required?: boolean;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  mediaTypes?: string[];
};

export type StudioBlockInput = {
  id: string;
  blockType: string;
  title: string;
  internalLabel?: string | null;
  configuration: JsonObject;
  presentation?: JsonObject;
  completion?: JsonObject;
  creatorNotes?: string | null;
  isEnabled?: boolean;
  schemaVersion?: number;
};

export type StudioChapterInput = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  coverAssetId?: string | null;
  estimatedDuration?: number | null;
  isOptional?: boolean;
  metadata?: JsonObject;
  blocks: StudioBlockInput[];
};

export type StudioDraftInput = {
  autosaveVersion: number;
  tale: {
    title: string;
    slug: string;
    subtitle?: string | null;
    shortDescription?: string | null;
    longDescription?: string | null;
    coverAssetId?: string | null;
    theme?: string;
    visibility?: string;
    playerCountMin?: number;
    playerCountMax?: number;
    estimatedDuration?: number | null;
    contentWarnings?: string | null;
  };
  chapters: StudioChapterInput[];
};

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  chapterId?: string;
  blockId?: string;
  assetId?: string;
  field?: string;
};

export type DraftValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  checkedAt: string;
};

export type PublishedBlock = StudioBlockInput & {
  chapterId: string;
  orderIndex: number;
  nextBlockId: string | null;
  connections: Array<{
    targetBlockId: string;
    connectionType: string;
    label?: string | null;
    conditionExpression?: string | null;
    orderIndex: number;
  }>;
};

export type PublishedChapter = Omit<StudioChapterInput, "blocks"> & {
  orderIndex: number;
  entryBlockId: string | null;
  completionBlockId: string | null;
  blocks: PublishedBlock[];
};

export type PublishedTaleSnapshot = {
  schemaVersion: 1;
  tale: {
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
  };
  chapters: PublishedChapter[];
  assets: Array<{
    id: string;
    mediaType: string;
    displayName: string;
    description: string | null;
    mimeType: string;
    width: number | null;
    height: number | null;
    roles: string[];
    variants?: Array<{ id: string; role: string; mimeType: string; processingState: string }>;
  }>;
  locations: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
  publishedAt: string;
};

export type VerificationProviderType =
  | "captainManual"
  | "playerConfirmation"
  | "textAnswer"
  | "timer"
  | "visionLocation"
  | "visionObject"
  | "externalWebhook";

export type VerificationSubmission = {
  schemaVersion: 1;
  eventId: string;
  idempotencyKey: string;
  eventType: "verification.observation" | "verification.result";
  providerType: VerificationProviderType;
  providerInstanceId?: string;
  sessionId: string;
  publishedVersionId: string;
  blockId: string;
  verificationRequestId: string;
  observedAt: string;
  result: "match" | "notMatch" | "uncertain";
  confidence?: number;
  evidence?: JsonObject;
};

export function parseJsonObject(value: string | null | undefined): JsonObject {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
