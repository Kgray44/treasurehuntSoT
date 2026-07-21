import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const db = new PrismaClient();
const acceptance = process.argv.includes("--acceptance");
const preset = process.argv.includes("--preset");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Database verification failed: ${message}`);
}

function eventKey(payload: string) {
  try {
    const value = JSON.parse(payload) as { key?: unknown };
    return typeof value.key === "string" ? value.key : null;
  } catch {
    return null;
  }
}

async function main() {
  const campaign = await db.campaign.findUnique({
    where: { slug: "development-forever-treasure" },
    include: {
      chapters: true,
      artifacts: true,
      mapLocations: true,
      mapRoutes: true,
      sideQuests: true,
      events: { orderBy: { sequence: "asc" } },
      snapshots: true,
      awards: true,
      auditLogs: true,
      saveStates: true,
      playerAccesses: true,
    },
  });
  assert(campaign, "the development campaign is missing");
  assert(campaign.chapters.length >= 5, "the complete development chapter set is required");
  assert(campaign.artifacts.length >= 5, "the complete development artifact set is required");
  assert(campaign.mapLocations.length >= 5, "the complete development map set is required");
  assert(campaign.mapRoutes.length >= 2, "development route segments are required");
  assert(campaign.sideQuests.length >= 4, "development side-quest states are required");
  assert(campaign.playerAccesses.length === 1, "exactly one development player access is required");
  assert(campaign.currentSequence === campaign.events.length, "campaign sequence must equal its ordered event count");
  assert(
    campaign.events.every((event, index) => event.sequence === index + 1),
    "event sequences must be contiguous",
  );
  assert(
    new Set(campaign.events.map((event) => event.sequence)).size === campaign.events.length,
    "event sequences must be unique",
  );
  assert(campaign.snapshots.length === campaign.events.length, "every progression event must have a campaign snapshot");
  assert(
    campaign.auditLogs.filter((entry) => entry.outcome === "SUCCEEDED" && entry.action !== "DEVELOPMENT_SEED").length >=
      campaign.events.length,
    "every progression event must have a successful audit record",
  );
  assert(campaign.awards.length <= campaign.artifacts.length, "artifact awards must remain unique");
  const studioTale = await db.chronicle.findUnique({
    where: { slug: "development-studio-voyage" },
    include: {
      drafts: { orderBy: { revisionNumber: "desc" }, include: { chapters: { include: { blocks: true } } } },
      versions: true,
    },
  });
  assert(studioTale, "the migrated Studio development tale is missing");
  assert(
    acceptance ? studioTale.drafts.length >= 1 : studioTale.drafts.length === 1,
    "the migrated tale requires its initial editable draft",
  );
  assert(studioTale.versions.length === 1, "the migrated tale requires one immutable published version");
  assert(
    studioTale.latestPublishedVersionId === studioTale.versions[0].id,
    "the player catalog must point to the current version",
  );
  assert(studioTale.drafts[0].chapters.length === 2, "the migrated Studio draft requires two chapters");
  assert(
    studioTale.drafts[0].chapters
      .flatMap((chapter) => chapter.blocks)
      .some((block) => block.blockType === "taleComplete"),
    "the migrated Studio draft requires a Tale Complete endpoint",
  );
  const snapshot = JSON.parse(studioTale.versions[0].contentSnapshot) as {
    schemaVersion?: number;
    chapters?: unknown[];
  };
  assert(
    snapshot.schemaVersion === 1 && Array.isArray(snapshot.chapters),
    "the published Studio snapshot must be schema-versioned",
  );
  assert(
    studioTale.versions.every(
      (version) => createHash("sha256").update(version.contentSnapshot).digest("hex") === version.checksum,
    ),
    "every published version checksum must match its immutable snapshot",
  );

  const [player, staff, platformSessions, platformAudits] = await Promise.all([
    db.playerProfile.findUnique({ where: { username: process.env.PLAYER_USERNAME ?? "sera" } }),
    db.gameMasterUser.findUnique({
      where: { username: process.env.GM_USERNAME ?? "kato" },
      include: { platformRoles: { where: { revokedAt: null } } },
    }),
    db.taleSession.findMany({ where: { previewMode: false }, include: { memberships: true, version: true } }),
    db.platformAuditEvent.findMany(),
  ]);
  assert(player?.passwordHash, "the returning Player development identity is missing");
  assert(staff, "the development staff identity is missing");
  for (const role of ["CAPTAIN", "CREATOR", "PUBLISHER"])
    assert(
      staff.platformRoles.some((assignment) => assignment.role === role),
      `the staff ${role} assignment is missing`,
    );
  assert(
    platformSessions.every((session) => session.memberships.length > 0),
    "every non-preview playthrough must have at least one membership after backfill",
  );
  assert(
    platformSessions.every(
      (session) => !session.publishedVersionId || session.version?.id === session.publishedVersionId,
    ),
    "every version-bound playthrough must still resolve its exact published version",
  );
  assert(
    platformAudits.every(
      (event) => !/password|pin|token|secret|cookie|credential|snapshot|payload/i.test(event.metadata),
    ),
    "platform audit metadata must not contain secret-bearing fields",
  );

  if (!acceptance && !preset) {
    assert(campaign.currentSequence === 0, "a fresh validation database must start at sequence zero");
    assert(campaign.chapters[0].state === "LOCKED", "a fresh chapter must be locked");
  } else if (acceptance) {
    const eventTypes = new Set(campaign.events.map((event) => event.type));
    for (const expected of [
      "CHAPTER_PREPARED",
      "CHAPTER_RELEASED",
      "ARTIFACT_AWARDED",
      "CAMPAIGN_PAUSED",
      "CAMPAIGN_RESUMED",
      "CHAPTER_SOLVED",
      "STATE_REVERTED",
    ]) {
      assert(eventTypes.has(expected), `acceptance run did not record ${expected}`);
    }
    const artifactKeys = new Set(campaign.artifacts.map((artifact) => artifact.key));
    assert(
      campaign.events.some(
        (event) => event.type === "ARTIFACT_AWARDED" && artifactKeys.has(eventKey(event.payload) ?? ""),
      ),
      "acceptance history must persist an artifact award for a campaign artifact",
    );
    const mapLocationKeys = new Set(campaign.mapLocations.map((location) => location.key));
    assert(
      campaign.events.some(
        (event) => event.type === "MAP_LOCATION_REVEALED" && mapLocationKeys.has(eventKey(event.payload) ?? ""),
      ),
      "acceptance history must persist a reveal for a campaign map location",
    );
    assert(campaign.saveStates.length > 0, "acceptance run must retain undo save states");
  }

  console.log(
    `Database verified: ${campaign.events.length} legacy events, ${campaign.auditLogs.length} legacy audit entries, ${platformSessions.length} playthroughs, ${platformAudits.length} platform audit entries; Studio version ${studioTale.versions[0].versionLabel}.`,
  );
}

main().finally(() => db.$disconnect());
