import { z } from "zod";
import type { ArchiveChronology, ArchiveSort, TimingQuality } from "@/wakebook/contracts";

const cursorSchema = z
  .object({
    v: z.literal(1),
    sort: z.enum(["NEWEST", "OLDEST"]),
    date: z.string().datetime().nullable(),
    id: z.string().min(1).max(191),
  })
  .strict();

export type ArchiveCursor = z.infer<typeof cursorSchema>;

export function archiveChronology(
  completedAt: Date | null,
  startedAt: Date | null,
  joinedAt: Date | null,
): ArchiveChronology {
  const archiveDate = completedAt ?? startedAt ?? joinedAt;
  return archiveDate
    ? { archiveDate: archiveDate.toISOString(), year: archiveDate.getUTCFullYear(), dateQuality: "EXACT" }
    : { archiveDate: null, year: null, dateQuality: "UNAVAILABLE" };
}

export function encodeArchiveCursor(cursor: ArchiveCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeArchiveCursor(value: string, expectedSort: ArchiveSort): ArchiveCursor {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Archive cursor is invalid.");
  }
  const cursor = cursorSchema.safeParse(decoded);
  if (!cursor.success || cursor.data.sort !== expectedSort) throw new Error("Archive cursor is invalid.");
  return cursor.data;
}

export function compareArchiveIdentity(
  left: { chronology: ArchiveChronology; id: string },
  right: { chronology: ArchiveChronology; id: string },
  sort: ArchiveSort,
) {
  const leftTime = left.chronology.archiveDate ? Date.parse(left.chronology.archiveDate) : null;
  const rightTime = right.chronology.archiveDate ? Date.parse(right.chronology.archiveDate) : null;
  if (leftTime === null && rightTime !== null) return 1;
  if (leftTime !== null && rightTime === null) return -1;
  if (leftTime !== rightTime) {
    const difference = (leftTime ?? 0) - (rightTime ?? 0);
    return sort === "NEWEST" ? -difference : difference;
  }
  return sort === "NEWEST" ? right.id.localeCompare(left.id) : left.id.localeCompare(right.id);
}

export function isAfterArchiveCursor(
  item: { chronology: ArchiveChronology; id: string },
  cursor: ArchiveCursor | null,
  sort: ArchiveSort,
) {
  if (!cursor) return true;
  return (
    compareArchiveIdentity(
      item,
      {
        id: cursor.id,
        chronology: {
          archiveDate: cursor.date,
          year: cursor.date ? new Date(cursor.date).getUTCFullYear() : null,
          dateQuality: cursor.date ? "EXACT" : "UNAVAILABLE",
        },
      },
      sort,
    ) > 0
  );
}

const humanLabels: Record<string, string> = {
  INVITED: "Invited",
  VIEWED: "Invitation viewed",
  ACCEPTED: "Invitation accepted",
  ACTIVE: "In progress",
  READY: "Ready to begin",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  COMPLETED_MEMBER: "Completed",
  DECLINED: "Invitation declined",
  EXPIRED: "Invitation expired",
  REVOKED: "Invitation withdrawn",
  REPLACED: "Invitation replaced",
  REMOVED: "Removed from the Voyage",
  CANCELLED: "Voyage cancelled",
  ABANDONED: "Voyage abandoned",
  ARCHIVED: "Archived",
};

export function presentLifecycle(status: string) {
  return { status, humanLabel: humanLabels[status] ?? "History status unavailable" };
}

export function presentRole(role: string) {
  if (role === "CAPTAIN") return "Captain and player";
  if (role === "PLAYER") return "Player";
  return "Voyage participant";
}

export function presentOutcome(outcome: string) {
  if (outcome === "COMPLETED" || outcome.startsWith("COMPLETED:"))
    return { label: "Completed", quality: "SAFE_GENERIC" as const };
  const label = humanLabels[outcome];
  return label
    ? { label, quality: "EXACT" as const }
    : { label: "Outcome unavailable", quality: "UNAVAILABLE" as const };
}

export function presentArtifactState(state: string) {
  const labels: Record<string, string> = {
    OWNED: "In your Artifact Cabinet",
    GRANTED: "Granted to you",
    DISCOVERED: "Discovered",
    WITNESSED: "Witnessed",
    REVOKED: "No longer in your Cabinet",
    ARCHIVED: "Archived in your Cabinet",
  };
  return labels[state] ?? "Recorded in your Artifact Cabinet";
}

export function normalizeTimingQuality(value: string | null | undefined, seconds: number | null): TimingQuality {
  if (value === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (value === "ESTIMATED" && seconds !== null) return "ESTIMATED";
  if (value === "EXACT" && seconds !== null) return "EXACT";
  return "UNAVAILABLE";
}

export function formatDuration(seconds: number | null, quality: TimingQuality) {
  if (quality === "NOT_APPLICABLE") return "Not applicable";
  if (seconds === null || quality === "UNAVAILABLE") return "Duration unavailable";
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const value = hours ? `${hours} hr${remainder ? ` ${remainder} min` : ""}` : `${remainder} min`;
  return quality === "ESTIMATED" ? `Approx. ${value}` : value;
}

export function presentTiming(seconds: number | null, accuracy: string | null | undefined) {
  const quality = normalizeTimingQuality(accuracy, seconds);
  return { seconds, quality, humanLabel: formatDuration(seconds, quality) };
}

export function presentKeepsakeStatus(status: string) {
  if (status === "READY") return "Private Keepsake ready";
  if (status === "REDACTED") return "Private Keepsake updated for consent";
  return "Private Keepsake available";
}

export function invitationArchiveDate(input: {
  createdAt: Date;
  viewedAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  status: string;
}) {
  const terminal =
    input.status === "ACCEPTED"
      ? input.acceptedAt
      : input.status === "DECLINED"
        ? input.declinedAt
        : input.status === "REVOKED"
          ? input.revokedAt
          : input.status === "EXPIRED"
            ? input.expiresAt
            : null;
  const date = terminal ?? input.viewedAt ?? input.createdAt;
  return { archiveDate: date.toISOString(), year: date.getUTCFullYear(), dateQuality: "EXACT" as const };
}
