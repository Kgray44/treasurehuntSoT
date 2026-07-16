import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const acceptance = process.argv.includes("--acceptance");

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
      events: { orderBy: { sequence: "asc" } },
      snapshots: true,
      awards: true,
      auditLogs: true,
      saveStates: true,
      playerAccesses: true,
    },
  });
  assert(campaign, "the development campaign is missing");
  assert(campaign.chapters.length >= 4, "the Command Center requires multiple development chapters");
  assert(campaign.artifacts.length >= 2, "multiple development artifacts are required");
  assert(campaign.mapLocations.length >= 2, "multiple development map locations are required");
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
  assert(campaign.awards.length <= campaign.artifacts.length, "an artifact may only be awarded once");

  if (!acceptance) {
    assert(campaign.currentSequence === 0, "a fresh validation database must start at sequence zero");
    assert(campaign.chapters[0].state === "LOCKED", "a fresh chapter must be locked");
  } else {
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
    assert(campaign.awards.length === 1, "acceptance run must persist one artifact award");
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
