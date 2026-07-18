import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
async function main() {
  const waypoints = await db.visionWaypoint.findMany({
    where: { name: "B-1 Painted Lantern Waypoint" },
    include: {
      versions: { include: { publication: true, buildArtifacts: true } },
      bindings: { include: { block: true, story: true } },
    },
  });
  if (waypoints.length !== 1) throw new Error(`Expected one B-1 waypoint, found ${waypoints.length}.`);
  const waypoint = waypoints[0];
  const published = waypoint.versions.find((version) => version.publishedAt && version.publication);
  if (!published?.publication) throw new Error("B-1 waypoint has no immutable publication.");
  if (!/^[a-f0-9]{64}$/.test(published.publication.packageHash)) throw new Error("B-1 package hash is malformed.");
  const artifact = published.buildArtifacts.find((item) => item.artifactType === "DEVELOPMENT_MOCK_PACKAGE");
  if (artifact?.contentHash !== published.publication.packageHash)
    throw new Error("B-1 publication and build artifact hashes differ.");
  if (waypoint.bindings.length !== 1) throw new Error(`Expected one B-1 binding, found ${waypoint.bindings.length}.`);
  const binding = waypoint.bindings[0];
  if (binding.story.slug !== "b1-vision-waypoint-demo" || binding.block.blockType !== "visionWaypoint")
    throw new Error("B-1 binding does not target the demo Vision block.");
  if (binding.waypointVersionId !== published.id) throw new Error("B-1 story is not pinned to the published version.");
  console.log(
    JSON.stringify({
      verified: true,
      waypointId: waypoint.id,
      waypointVersionId: published.id,
      packageHash: published.publication.packageHash,
      storyId: binding.storyId,
      blockId: binding.blockId,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
