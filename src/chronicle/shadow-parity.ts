import { db } from "@/lib/db";
import { parseJsonArray, parseJsonObject, type JsonObject } from "@/chronicle/types";
import { LEGACY_COMPANION_DOMAIN, LEGACY_COMPANION_MIGRATION_VERSION } from "@/chronicle/legacy-companion-migration";

export type ShadowMismatch = Readonly<{
  campaignSlug: string;
  field:
    | "chapter-state"
    | "artifact-inventory"
    | "side-quest-state"
    | "map-reveal"
    | "route-reveal"
    | "player-membership"
    | "session-lifecycle"
    | "event-sequence"
    | "presentation-acknowledgement";
  expected: unknown;
  actual: unknown;
  explanation: string;
}>;

export type ShadowParityReport = Readonly<{
  campaignSlug: string;
  mapped: boolean;
  semanticMatch: boolean;
  mismatches: ShadowMismatch[];
}>;

function sourceLifecycle(status: string, complete: boolean) {
  if (status === "PAUSED") return "PAUSED";
  if (complete || status === "COMPLETE" || status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED" || status === "ABANDONED") return status;
  return "ACTIVE";
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mismatch(
  report: ShadowMismatch[],
  campaignSlug: string,
  field: ShadowMismatch["field"],
  expected: unknown,
  actual: unknown,
  explanation: string,
) {
  if (!same(expected, actual)) report.push({ campaignSlug, field, expected, actual, explanation });
}

/**
 * Read-only Stage C parity check. It compares only semantic projections and
 * intentionally ignores generated IDs, timestamps, hashes, and presentation
 * formatting. This module is tooling; production request paths never use the
 * Campaign graph as a business-state source.
 */
export async function shadowCompareLegacyCampaign(campaignSlug: string): Promise<ShadowParityReport> {
  const campaign = await db.campaign.findUnique({
    where: { slug: campaignSlug },
    include: {
      chapters: { orderBy: { ordinal: "asc" } },
      artifacts: { orderBy: { key: "asc" }, include: { awards: true } },
      sideQuests: { orderBy: { key: "asc" } },
      mapLocations: { orderBy: { key: "asc" } },
      mapRoutes: { orderBy: { key: "asc" } },
      events: { orderBy: { sequence: "asc" } },
      playerAccesses: { include: { viewedContent: true } },
    },
  });
  if (!campaign) throw new Error(`No legacy Campaign has slug ${campaignSlug}.`);
  const sessionReference = await db.legacyEntityReference.findFirst({
    where: {
      sourceDomain: LEGACY_COMPANION_DOMAIN,
      sourceModel: "Campaign",
      sourceId: campaign.id,
      canonicalModel: "TaleSession",
      migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
    },
  });
  if (!sessionReference)
    return {
      campaignSlug,
      mapped: false,
      semanticMatch: false,
      mismatches: [
        {
          campaignSlug,
          field: "session-lifecycle",
          expected: "mapped Chronicle Session",
          actual: null,
          explanation: "The Campaign has no canonical session provenance mapping.",
        },
      ],
    };
  const [session, ceremonies] = await Promise.all([
    db.taleSession.findUniqueOrThrow({
      where: { id: sessionReference.canonicalId },
      include: { events: { orderBy: { sequence: "asc" } }, memberships: true, revealStates: true },
    }),
    db.viewedCeremony.findMany({ where: { campaignId: campaign.id } }),
  ]);
  const variables = parseJsonObject(session.variables);
  const legacy = (variables.legacy && typeof variables.legacy === "object" ? variables.legacy : {}) as JsonObject;
  const chapters = (legacy.chapters && typeof legacy.chapters === "object" ? legacy.chapters : {}) as Record<
    string,
    unknown
  >;
  const sideQuests = (legacy.sideQuests && typeof legacy.sideQuests === "object" ? legacy.sideQuests : {}) as Record<
    string,
    unknown
  >;
  const routes = (legacy.routes && typeof legacy.routes === "object" ? legacy.routes : {}) as Record<string, unknown>;
  const inventory = new Set(parseJsonArray<string>(session.inventory));
  const artifactReferences = await db.legacyEntityReference.findMany({
    where: {
      sourceDomain: LEGACY_COMPANION_DOMAIN,
      sourceModel: "Artifact",
      sourceId: { in: campaign.artifacts.map((artifact) => artifact.id) },
      canonicalModel: "TaleArtifact",
      migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
    },
  });
  const artifactIds = new Map(artifactReferences.map((reference) => [reference.sourceId, reference.canonicalId]));
  const acknowledgementCount = session.revealStates.filter((state) =>
    state.contentType.startsWith("acknowledgement:"),
  ).length;
  const sourceAcknowledgements =
    campaign.playerAccesses.reduce((total, access) => total + access.viewedContent.length, 0) + ceremonies.length;
  const mismatches: ShadowMismatch[] = [];

  mismatch(
    mismatches,
    campaign.slug,
    "chapter-state",
    campaign.chapters.map((chapter) => [chapter.ordinal, chapter.state]),
    campaign.chapters.map((chapter) => [chapter.ordinal, String(chapters[String(chapter.ordinal)] ?? "LOCKED")]),
    "Chapter state must remain equivalent after migration.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "artifact-inventory",
    campaign.artifacts.filter((artifact) => artifact.awards.length > 0).map((artifact) => artifact.key),
    campaign.artifacts
      .filter((artifact) => inventory.has(artifactIds.get(artifact.id) ?? ""))
      .map((artifact) => artifact.key),
    "Awarded artifact ownership must be represented by canonical inventory.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "side-quest-state",
    campaign.sideQuests.map((quest) => [quest.key, quest.state]),
    campaign.sideQuests.map((quest) => [
      quest.key,
      (sideQuests[quest.key] as JsonObject | undefined)?.state ?? "HIDDEN",
    ]),
    "Side-quest state must be preserved in canonical session variables.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "map-reveal",
    campaign.mapLocations.filter((location) => Boolean(location.revealedAt)).map((location) => location.key),
    session.revealStates
      .filter((state) => state.contentType === "map-location")
      .map((state) => state.contentKey)
      .sort(),
    "Revealed locations must be represented by canonical RevealState.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "route-reveal",
    campaign.mapRoutes.filter((route) => Boolean(route.revealedAt)).map((route) => route.key),
    campaign.mapRoutes.filter((route) => routes[route.key] === "REVEALED").map((route) => route.key),
    "Revealed routes must be preserved in canonical session variables.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "player-membership",
    campaign.playerAccesses.length,
    session.memberships.length,
    "Every legacy Player access record must map to one canonical membership.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "session-lifecycle",
    sourceLifecycle(
      campaign.status,
      campaign.chapters.some((chapter) => chapter.state === "COMPLETE"),
    ),
    session.status,
    "Lifecycle state must preserve active, paused, completed, cancelled, and abandoned semantics.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "event-sequence",
    campaign.events.map((event) => event.sequence),
    session.events.filter((event) => event.sourceType === "legacy-companion").map((event) => event.sequence),
    "Imported legacy event sequence must remain monotonic and complete.",
  );
  mismatch(
    mismatches,
    campaign.slug,
    "presentation-acknowledgement",
    sourceAcknowledgements,
    acknowledgementCount,
    "Viewed-content acknowledgement count must be preserved without advancing progression.",
  );
  return { campaignSlug, mapped: true, semanticMatch: mismatches.length === 0, mismatches };
}
