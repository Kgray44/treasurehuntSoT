import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const proofId = "platform-backfill-proof";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Platform backfill verification failed: ${message}`);
}

async function prepare() {
  const tale = await db.chronicle.findUniqueOrThrow({
    where: { slug: "development-studio-voyage" },
    include: { versions: { where: { isCurrent: true }, take: 1 } },
  });
  const version = tale.versions[0];
  assert(version, "the development version is missing");
  const snapshot = JSON.parse(version.contentSnapshot) as { chapters: Array<{ blocks: Array<{ id: string }> }> };
  const blockId = snapshot.chapters.flatMap((chapter) => chapter.blocks)[0]?.id;
  assert(blockId, "the development version has no playable block");
  if (await db.taleSession.findUnique({ where: { id: proofId } })) {
    console.log("Platform backfill proof row already exists; no duplicate was created.");
    return;
  }
  const gm = await db.gameMasterUser.findUniqueOrThrow({ where: { username: process.env.GM_USERNAME ?? "kato" } });
  const now = new Date(Date.now() - 60_000);
  await db.taleSession.create({
    data: {
      id: proofId,
      taleId: tale.id,
      publishedVersionId: version.id,
      ownerLabel: "Migrated Mariner",
      captainId: gm.id,
      accessTokenHash: createHash("sha256").update(proofId).digest("hex"),
      status: "COMPLETED",
      currentBlockId: blockId,
      currentSequence: 1,
      startedAt: now,
      completedAt: new Date(),
      events: {
        create: {
          publishedVersionId: version.id,
          blockId,
          eventType: "blockEntered",
          sourceType: "legacyPlayer",
          idempotencyKey: `${proofId}:block-entered`,
          sequence: 1,
          payload: JSON.stringify({ legacyProof: true }),
        },
      },
    },
  });
  console.log(`Prepared legacy-shaped playthrough ${proofId} without a platform membership.`);
}

async function verify() {
  const session = await db.taleSession.findUnique({
    where: { id: proofId },
    include: { memberships: true, revealStates: true, events: true },
  });
  assert(session, "the original playthrough identifier was not preserved");
  assert(session.memberships.length === 1, "the legacy playthrough did not receive exactly one membership");
  assert(session.memberships[0].status === "COMPLETED_MEMBER", "completed state was not preserved in membership state");
  assert(
    session.revealStates.some((state) => state.contentType === "BLOCK" && state.contentKey === session.currentBlockId),
    "visited content was not backfilled into reveal history",
  );
  assert(
    session.events.some((event) => event.idempotencyKey === `${proofId}:block-entered`),
    "the original event history was not preserved",
  );
  assert(session.voyageName === "Migrated Mariner", "the legacy owner label was not carried into the voyage name");
  assert(session.launchedAt?.getTime() === session.startedAt.getTime(), "the historical launch time was not preserved");
  console.log(
    `Platform backfill verified for ${proofId}: identity, membership, reveal history, and event history are intact.`,
  );
}

async function main() {
  if (process.argv.includes("--prepare")) await prepare();
  else if (process.argv.includes("--verify")) await verify();
  else throw new Error("Use --prepare or --verify.");
}

main().finally(() => db.$disconnect());
