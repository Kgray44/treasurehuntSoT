import { db } from "@/lib/db";
import { archiveChronology, presentLifecycle, presentRole, presentTiming } from "@/wakebook/presentation";

export type WakebookInsights = {
  freshness: "CURRENT" | "PARTIAL";
  notice: string | null;
  metrics: {
    definitionVersions: string[];
    voyageCount: number;
    completedCount: number;
    exactDurationSeconds: number | null;
    durationCoverage: "EXACT" | "MIXED" | "UNAVAILABLE";
    firstJourneyAt: string | null;
    latestJourneyAt: string | null;
  };
  timeline: Array<{
    id: string;
    title: string;
    date: string | null;
    dateQuality: "EXACT" | "UNAVAILABLE";
    lifecycle: string;
    duration: string;
  }>;
  people: Array<{
    label: string;
    role: string;
    voyageCount: number;
    availability: "HISTORICAL" | "LIMITED";
  }>;
};

/** Owner-scoped, read-only Phase 3 projection. No runtime or profile data is joined. */
export async function queryWakebookInsights(playerProfileId: string): Promise<WakebookInsights> {
  const where = { playerProfileId };
  const [count, completedCount, exactDuration, durationRecords, dateRange, versions, timelineRows, peopleRows] =
    await Promise.all([
      db.playerChronicleRecord.count({ where }),
      db.playerChronicleRecord.count({
        where: { ...where, lifecycleStatus: "COMPLETED" },
      }),
      db.playerChronicleRecord.aggregate({
        where: {
          ...where,
          wallClockAccuracy: "EXACT",
          wallClockSeconds: { not: null },
        },
        _sum: { wallClockSeconds: true },
      }),
      db.playerChronicleRecord.count({
        where: {
          ...where,
          wallClockAccuracy: "EXACT",
          wallClockSeconds: { not: null },
        },
      }),
      db.playerChronicleRecord.aggregate({
        where,
        _min: { completedAt: true, startedAt: true, joinedAt: true },
        _max: { completedAt: true, startedAt: true, joinedAt: true },
      }),
      db.playerChronicleRecord.groupBy({
        by: ["metricDefinitionVersion"],
        where,
        orderBy: { metricDefinitionVersion: "asc" },
      }),
      db.playerChronicleRecord.findMany({
        where,
        orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }, { joinedAt: "desc" }, { id: "desc" }],
        take: 36,
        select: {
          id: true,
          chronicleTitleSnapshot: true,
          lifecycleStatus: true,
          completedAt: true,
          startedAt: true,
          joinedAt: true,
          wallClockSeconds: true,
          wallClockAccuracy: true,
        },
      }),
      db.playerChronicleParticipantSnapshot.groupBy({
        by: ["displayNameSnapshot", "tombstoneState", "participationRole", "crewRoleSnapshot"],
        where: { record: { playerProfileId }, projectionEligibility: "ONLY_ME" },
        _count: { historyRecordId: true },
        orderBy: { _count: { historyRecordId: "desc" } },
        take: 40,
      }),
    ]);

  const dates = timelineRows
    .map((row) => archiveChronology(row.completedAt, row.startedAt, row.joinedAt).archiveDate)
    .filter((value): value is string => Boolean(value));
  const exactDurationSeconds = exactDuration._sum.wallClockSeconds ?? null;
  return {
    freshness: "CURRENT",
    notice: null,
    metrics: {
      definitionVersions: versions.map((version) => version.metricDefinitionVersion),
      voyageCount: count,
      completedCount,
      exactDurationSeconds: durationRecords === count && count > 0 ? exactDurationSeconds : null,
      durationCoverage: !count ? "UNAVAILABLE" : durationRecords === count ? "EXACT" : "MIXED",
      firstJourneyAt:
        dates.at(-1) ??
        dateRange._min.completedAt?.toISOString() ??
        dateRange._min.startedAt?.toISOString() ??
        dateRange._min.joinedAt?.toISOString() ??
        null,
      latestJourneyAt:
        dates.at(0) ??
        dateRange._max.completedAt?.toISOString() ??
        dateRange._max.startedAt?.toISOString() ??
        dateRange._max.joinedAt?.toISOString() ??
        null,
    },
    timeline: timelineRows.map((row) => {
      const chronology = archiveChronology(row.completedAt, row.startedAt, row.joinedAt);
      return {
        id: row.id,
        title: row.chronicleTitleSnapshot,
        date: chronology.archiveDate,
        dateQuality: chronology.dateQuality,
        lifecycle: presentLifecycle(row.lifecycleStatus).humanLabel,
        duration: presentTiming(row.wallClockSeconds, row.wallClockAccuracy).humanLabel,
      };
    }),
    people: peopleRows.map((person) => ({
      label: person.tombstoneState === "ACTIVE" ? person.displayNameSnapshot : "Former crew member",
      role: person.crewRoleSnapshot || presentRole(person.participationRole),
      voyageCount: person._count.historyRecordId,
      availability: person.tombstoneState === "ACTIVE" ? "HISTORICAL" : "LIMITED",
    })),
  };
}
