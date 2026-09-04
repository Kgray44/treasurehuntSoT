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
    firstSharedVoyage: { id: string; title: string; date: string | null } | null;
    latestSharedVoyage: { id: string; title: string; date: string | null } | null;
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
      db.playerChronicleParticipantSnapshot.findMany({
        where: { record: { playerProfileId }, projectionEligibility: "ONLY_ME" },
        select: {
          participantProfileId: true,
          sourceMembershipId: true,
          displayNameSnapshot: true,
          tombstoneState: true,
          participationRole: true,
          crewRoleSnapshot: true,
          record: {
            select: {
              id: true,
              sourceMembershipId: true,
              chronicleTitleSnapshot: true,
              completedAt: true,
              startedAt: true,
              joinedAt: true,
            },
          },
        },
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
    people: projectSharedHistory(peopleRows),
  };
}

export function projectSharedHistory(
  rows: Array<{
    participantProfileId: string | null;
    sourceMembershipId: string;
    displayNameSnapshot: string;
    tombstoneState: string;
    participationRole: string;
    crewRoleSnapshot: string | null;
    record: {
      id: string;
      sourceMembershipId: string | null;
      chronicleTitleSnapshot: string;
      completedAt: Date | null;
      startedAt: Date | null;
      joinedAt: Date | null;
    };
  }>,
) {
  const people = new Map<
    string,
    {
      label: string;
      role: string;
      availability: "HISTORICAL" | "LIMITED";
      voyages: Array<{ id: string; title: string; date: string | null }>;
    }
  >();
  for (const row of rows) {
    // The owner snapshot belongs to the same source membership as the record;
    // People tells the shared-history story, never the owner back to themself.
    if (row.sourceMembershipId === row.record.sourceMembershipId) continue;
    const key = row.participantProfileId ?? `${row.tombstoneState}:${row.displayNameSnapshot}`;
    const chronology = archiveChronology(row.record.completedAt, row.record.startedAt, row.record.joinedAt);
    const person = people.get(key) ?? {
      label: row.tombstoneState === "ACTIVE" ? row.displayNameSnapshot : "Former crew member",
      role: row.crewRoleSnapshot || presentRole(row.participationRole),
      availability: row.tombstoneState === "ACTIVE" ? "HISTORICAL" : "LIMITED",
      voyages: [],
    };
    if (!person.voyages.some((voyage) => voyage.id === row.record.id)) {
      person.voyages.push({
        id: row.record.id,
        title: row.record.chronicleTitleSnapshot,
        date: chronology.dateQuality === "EXACT" ? chronology.archiveDate : null,
      });
    }
    people.set(key, person);
  }
  return [...people.values()]
    .map((person) => {
      const datedVoyages = person.voyages
        .filter((voyage): voyage is typeof voyage & { date: string } => Boolean(voyage.date))
        .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
      return {
        label: person.label,
        role: person.role,
        voyageCount: person.voyages.length,
        availability: person.availability,
        firstSharedVoyage: datedVoyages.at(0) ?? null,
        latestSharedVoyage: datedVoyages.at(-1) ?? null,
      };
    })
    .sort((left, right) => right.voyageCount - left.voyageCount || left.label.localeCompare(right.label));
}
