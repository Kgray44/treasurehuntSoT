import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const acceptance = process.argv.includes("--acceptance");
const preset = process.argv.includes("--preset");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Database verification failed: ${message}`);
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
  assert(campaign.auditLogs.length === campaign.events.length, "every progression event must have an audit record");
  assert(campaign.awards.length <= campaign.artifacts.length, "artifact awards must remain unique");

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
    assert(campaign.awards.length >= 1, "acceptance run must persist an artifact award");
    assert(
      campaign.mapLocations.some((location) => location.revealedAt),
      "acceptance run must persist a released map location",
    );
    assert(campaign.saveStates.length > 0, "acceptance run must retain undo save states");
  }

  console.log(
    `Database verified: ${campaign.events.length} events, ${campaign.auditLogs.length} audit entries, sequence ${campaign.currentSequence}.`,
  );
}

main().finally(() => db.$disconnect());
