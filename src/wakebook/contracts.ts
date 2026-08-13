import { z } from "zod";

export const archiveSortSchema = z.enum(["NEWEST", "OLDEST"]);
export type ArchiveSort = z.infer<typeof archiveSortSchema>;

export const timingQualitySchema = z.enum(["EXACT", "ESTIMATED", "UNAVAILABLE", "NOT_APPLICABLE"]);
export type TimingQuality = z.infer<typeof timingQualitySchema>;

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
  timing: {
    definitionVersion: string;
    wallClock: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    active: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    paused: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    connected: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    interactive: { seconds: number | null; quality: TimingQuality; humanLabel: string };
    captainWait: { seconds: number | null; quality: TimingQuality; humanLabel: string };
  };
  chapters: Array<{ title: string; completedAt: string; quality: "EXACT" | "UNAVAILABLE" }>;
  optionalObjectives: { available: boolean; explanation: string | null };
  choices: { available: boolean; explanation: string | null };
  crew: Array<{
    historicalDisplayName: string;
    avatarAlt: string | null;
    role: string;
    humanRole: string;
    crewRole: string | null;
    joinedAt: string | null;
    completedAt: string | null;
    removedAt: string | null;
  }>;
  artifacts: {
    sharedVoyageContext: Array<{ name: string; revealedAt: string }>;
    personalRecords: Array<{
      id: string;
      name: string;
      state: string;
      humanState: string;
      grantedAt: string | null;
    }>;
  };
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
  }>;
  keepsake: { status: string; humanStatus: string; generatedAt: string; participantCount: number } | null;
  provenance: {
    publishedVersionId: string;
    publishedVersionChecksum: string;
    metricDefinitionVersion: string;
    projectionStatus: string;
    projectionReason: string | null;
  };
  dataQuality: "COMPLETE" | "PARTIAL";
  warnings: string[];
  review?: JourneyArchiveItem["review"];
  comparison?: { href: string; state: "COMPARE" | "UP_TO_DATE" };
};
