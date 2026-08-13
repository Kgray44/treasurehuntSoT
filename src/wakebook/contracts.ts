import { z } from "zod";

export const archiveSortSchema = z.enum(["NEWEST", "OLDEST"]);
export type ArchiveSort = z.infer<typeof archiveSortSchema>;

export const timingQualitySchema = z.enum(["EXACT", "ESTIMATED", "UNAVAILABLE", "NOT_APPLICABLE"]);
export type TimingQuality = z.infer<typeof timingQualitySchema>;
export type HistoricalQuality = TimingQuality;

export type HistoricalSource =
  | "PUBLISHED_VERSION"
  | "SESSION_FACT"
  | "MEMBERSHIP_FACT"
  | "WAYFARER_RECORD"
  | "ARTIFACT_GRANT_RECEIPT"
  | "PERSONAL_ARTIFACT_RECORD"
  | "ACHIEVEMENT_EVIDENCE"
  | "OWNER_ANNOTATION"
  | "CONSENT_RECORD"
  | "AUTHORIZED_MEDIA_REFERENCE"
  | "DERIVED_VERSIONED_METRIC";

export const lifecycleFilterSchema = z.enum([
  "INVITED",
  "ACCEPTED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "REVOKED",
  "REMOVED",
  "CANCELLED",
  "ABANDONED",
  "ARCHIVED",
]);

export const participationRoleSchema = z.enum(["PLAYER", "CAPTAIN"]);

const optionalBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const optionalBoundedText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(80).optional(),
);

const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : Number(value)),
    z.number().int().min(minimum).max(maximum).optional(),
  );

export const archiveQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: optionalInteger(1, 24).default(12),
    search: optionalBoundedText,
    status: lifecycleFilterSchema.optional(),
    year: optionalInteger(1900, 2200),
    role: participationRoleSchema.optional(),
    hasMemories: optionalBoolean,
    hasKeepsake: optionalBoolean,
    hasArtifacts: optionalBoolean,
    sort: archiveSortSchema.default("NEWEST"),
  })
  .strict();

export type ArchiveQuery = z.infer<typeof archiveQuerySchema>;

export function parseArchiveQuery(searchParams: URLSearchParams): ArchiveQuery {
  const input = Object.fromEntries(
    [
      "cursor",
      "limit",
      "search",
      "status",
      "year",
      "role",
      "hasMemories",
      "hasKeepsake",
      "hasArtifacts",
      "sort",
    ].flatMap((key) => {
      const value = searchParams.get(key);
      return value === null ? [] : [[key, value] as const];
    }),
  );
  return archiveQuerySchema.parse(input);
}

export type ArchiveChronology = {
  archiveDate: string | null;
  year: number | null;
  dateQuality: "EXACT" | "UNAVAILABLE";
};

export type SafeHistoricalCover = {
  href: string;
  alt: string;
} | null;

export type JourneyArchiveItem = {
  id: string;
  chronology: ArchiveChronology;
  chronicle: {
    historicalTitle: string;
    historicalCover: SafeHistoricalCover;
    publishedVersionId: string;
    publishedVersionLabel: string | null;
    publishedVersionChecksum: string;
  };
  lifecycle: { status: string; humanLabel: string };
  participation: { role: string; humanRole: string; crewRole: string | null };
  crewPreview: Array<{
    historicalDisplayName: string;
    avatarAlt: string | null;
    role: string;
    humanRole: string;
    crewRole: string | null;
  }>;
  timing: {
    primary: { seconds: number | null; quality: TimingQuality; humanLabel: string };
  };
  outcome: { label: string; quality: "EXACT" | "SAFE_GENERIC" | "UNAVAILABLE" };
  progress: { completedChapterCount: number; chapterEvidenceAvailable: boolean };
  context: {
    memoryCount: number;
    sharedArtifactCount: number;
    personalArtifactCount: number;
    hasKeepsake: boolean;
    hasReflection: boolean;
  };
  dataQuality: "COMPLETE" | "PARTIAL";
  warnings: string[];
  review?: { href: string; state: "AVAILABLE_AFTER_VERIFIED_COMPLETION" };
};

export type ArchiveYearGroup = {
  key: string;
  year: number | null;
  label: string;
  totalCount: number;
  completedCount: number;
  displayedCount: number;
  exactRecordedSeconds: number | null;
  items: JourneyArchiveItem[];
};

export type InvitationArchiveItem = {
  id: string;
  chronicleTitle: string;
  lifecycle: { status: string; humanLabel: string };
  chronology: ArchiveChronology;
  editionLabel: string | null;
  replaced: boolean;
};

export type JourneyArchiveResponse = {
  groups: ArchiveYearGroup[];
  invitations: InvitationArchiveItem[];
  nextCursor: string | null;
  resultCount: number;
  pageCount: number;
  filtersApplied: boolean;
  projection: {
    examined: number;
    created: number;
    updated: number;
    failures: number;
  };
  warnings: string[];
};

export type VoyageDetail = {
  id: string;
  chronology: ArchiveChronology & {
    startedAt: string | null;
    joinedAt: string | null;
    completedAt: string | null;
  };
  chronicle: JourneyArchiveItem["chronicle"];
  lifecycle: JourneyArchiveItem["lifecycle"];
  participation: JourneyArchiveItem["participation"] & { historicalDisplayName: string };
  outcome: JourneyArchiveItem["outcome"];
  attribution: {
    creator: HistoricalAttribution;
    captain: HistoricalAttribution;
  };
  timing: {
    definitionVersion: string;
    wallClock: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    active: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    paused: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    connected: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    interactive: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    captainWait: { seconds: number | null; quality: TimingQuality; humanLabel: string };
  };
  chapters: Array<{
    id: string;
    title: string;
    completedAt: string;
    sequence: number;
    quality: "EXACT" | "UNAVAILABLE";
    source: "SESSION_FACT";
  }>;
  optionalObjectives: HistoricalObjectiveSummary;
  choices: SafeChoiceContext;
  crew: Array<{
    historicalDisplayName: string;
    avatarAlt: string | null;
    role: string;
    humanRole: string;
    crewRole: string | null;
    joinedAt: string | null;
    completedAt: string | null;
    removedAt: string | null;
    isHistoricalCaptain: boolean;
    quality: "EXACT" | "UNAVAILABLE";
  }>;
  artifacts: {
    sharedVoyageContext: Array<{ name: string; revealedAt: string; source: "SESSION_FACT" }>;
    personalRecords: Array<{
      id: string;
      name: string;
      state: string;
      humanState: string;
      grantedAt: string | null;
      witnessedAt: string | null;
      sourceBlockId: string | null;
      collectionKey: string | null;
      assemblyKey: string | null;
      componentRole: string | null;
      source: "PERSONAL_ARTIFACT_RECORD";
    }>;
    assemblies: Array<{
      id: string;
      key: string;
      name: string;
      status: string;
      completedAt: string | null;
      source: "PERSONAL_ARTIFACT_RECORD";
    }>;
  };
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    state: string;
    earnedAt: string | null;
    definitionVersion: number;
    source: "ACHIEVEMENT_EVIDENCE";
  }>;
  reflection: {
    favoriteChapterId: string | null;
    favoriteClueReference: string | null;
    favoriteMomentReference: string | null;
    favoriteArtifactReference: string | null;
    privateNote: string | null;
  } | null;
  memories: Array<{
    id: string;
    title: string;
    body: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: string;
    updatedAt: string;
    media: Array<MemoryMediaReference>;
  }>;
  keepsake: KeepsakePresentationContract | null;
  provenance: {
    historyRecordId: string;
    sourcePlaythroughId: string;
    sourceMembershipId: string | null;
    publishedVersionId: string;
    publishedVersionChecksum: string;
    metricDefinitionVersion: string;
    projectionStatus: string;
    projectionReason: string | null;
    lastDerivedAt: string;
    fields: Array<{ label: string; quality: HistoricalQuality; source: HistoricalSource }>;
  };
  dataQuality: "COMPLETE" | "PARTIAL";
  warnings: string[];
  review?: JourneyArchiveItem["review"];
  comparison?: { href: string; state: "COMPARE" | "UP_TO_DATE" };
};

export type HistoricalAttribution = {
  historicalLabel: string | null;
  roleLabel: "Creator" | "Captain";
  quality: HistoricalQuality;
  source: "PUBLISHED_VERSION" | "MEMBERSHIP_FACT" | "UNAVAILABLE";
  explanation: string | null;
};

export type HistoricalObjectiveSummary = {
  available: boolean;
  completedCount: number | null;
  totalCount: number | null;
  objectives: Array<{ label: string; completed: boolean; quality: HistoricalQuality }>;
  explanation: string | null;
  quality: HistoricalQuality;
  source: HistoricalSource;
};

export type SafeChoiceContext = {
  available: boolean;
  items: Array<{
    label: string;
    chapterTitle: string | null;
    kind: "CHOICE" | "HINT" | "REJOIN" | "CHECKPOINT" | "ATTEMPT";
    detail: string | null;
    quality: HistoricalQuality;
  }>;
  explanation: string | null;
  quality: HistoricalQuality;
  source: HistoricalSource;
};

export type MemoryMediaReference = {
  id: string;
  kind: string;
  description: string | null;
  state:
    | "AVAILABLE"
    | "LOADING"
    | "UNAVAILABLE"
    | "QUARANTINED"
    | "WITHDRAWN"
    | "EXPIRED"
    | "CONSENT_REVOKED"
    | "UNSUPPORTED"
    | "DELIVERY_ERROR";
  deliveryHref: string | null;
};

export type KeepsakePresentationContract = {
  status: string;
  humanStatus: string;
  generatedAt: string;
  regeneratedAt: string | null;
  participantCount: number;
  consent: Array<{
    scope: string;
    state: string;
    historicalLabel: string | null;
    decidedAt: string | null;
  }>;
  state: "READY" | "INCOMPLETE_CONSENT" | "DEGRADED" | "UNAVAILABLE";
  explanation: string | null;
};
