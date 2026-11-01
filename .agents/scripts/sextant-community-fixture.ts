/** Adopt the accepted Homeport public fixture once inside the nonce-owned Sextant database. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { labTool } from "../../scripts/device-lab/host";
import { seedSextantExperience } from "./sextant-experience-fixture";
import { getHomeportListingDetail } from "../../src/community/homeport";

const manifestPath = "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_Fixture_Manifest.json";
const producerPath = "scripts/homeport/seed-phase4-fixture.mjs";
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function seedSextantCommunityExperience() {
  // This guard verifies absolute owned path, generic profile, nonce and canonical
  // database identity marker before any Homeport fixture inspection or writes.
  const player = await seedSextantExperience();
  const manifestBytes = await readFile(manifestPath);
  const producerBytes = await readFile(producerPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
    fixtureVersion: string;
    publicListings: string[];
    ineligibleListings: string[];
    accounts: Array<{ id: string }>;
    publicCreators: string[];
    collections: string[];
    guides: string[];
    voyageLogs: string[];
  };
  if (manifest.fixtureVersion !== "homeport-phase4-synthetic-v1") throw new Error("SEXTANT_COMMUNITY_MANIFEST_REFUSED");
  const identity = { manifestSha256: digest(manifestBytes), producerSha256: digest(producerBytes) };
  const nonce = process.env.FOREVER_VALIDATION_NONCE_HASH!;
  const directory = path.dirname(process.env.DATABASE_URL!.slice(5));
  const markerId = `sextant-homeport-community-${nonce}`;
  const marker = await db.platformAuditEvent.findUnique({ where: { id: markerId } });
  if (marker && (marker.action !== "SEXTANT_COMMUNITY_FIXTURE_READY" || marker.metadata !== JSON.stringify(identity)))
    throw new Error("SEXTANT_COMMUNITY_EXISTING_MARKER_MISMATCH");
  if (!marker) {
    // The existing producer uses upserts. Invoke it only on a pristine prefix,
    // never to reset a failed fixture or a previous browser mutation.
    const prefix = { startsWith: "hp4-" };
    // Cover every model the fixed producer upserts, including its alternate
    // unique keys. A partial or foreign collision must be preserved even if
    // the producer's UserAccount row was never created.
    const collisions = await Promise.all([
      db.gameMasterUser.count({ where: { OR: [{ id: prefix }, { username: prefix }] } }),
      db.userAccount.count({ where: { OR: [{ id: prefix }, { legacyGameMasterId: prefix }] } }),
      db.playerProfile.count({ where: { OR: [{ id: prefix }, { accountId: prefix }, { normalizedHandle: prefix }] } }),
      db.accountRoleAssignment.count({ where: { OR: [{ id: prefix }, { accountId: prefix }] } }),
      db.communityProfile.count({
        where: { OR: [{ id: prefix }, { accountId: prefix }, { normalizedHandle: { in: manifest.publicCreators } }] },
      }),
      db.chronicle.count({ where: { OR: [{ id: prefix }, { slug: prefix }] } }),
      db.publishedTaleVersion.count({ where: { OR: [{ id: prefix }, { taleId: prefix }] } }),
      db.communityListing.count({
        where: { OR: [{ id: prefix }, { slug: { in: [...manifest.publicListings, ...manifest.ineligibleListings] } }] },
      }),
      db.communityListingDiscoveryMetadata.count({ where: { OR: [{ id: prefix }, { listingId: prefix }] } }),
      db.communityListingAggregate.count({ where: { listingId: prefix } }),
      db.communitySearchDocument.count({ where: { OR: [{ id: prefix }, { listingId: prefix }] } }),
      db.communityRelease.count({ where: { OR: [{ id: prefix }, { listingId: prefix }] } }),
      db.communityEditorialFeature.count({
        where: {
          OR: [
            { id: prefix },
            { placement: "HARBOR_HOME", subjectType: "COMMUNITY_LISTING", subjectId: "hp4-listing-lantern-coast" },
          ],
        },
      }),
      db.communityAssetReference.count({
        where: { OR: [{ id: prefix }, { storageKey: "homeport-phase4-synthetic/failed-glass-beacon.glb" }] },
      }),
      db.communityCollection.count({ where: { OR: [{ id: prefix }, { slug: { in: manifest.collections } }] } }),
      db.communityCollectionItem.count({ where: { OR: [{ id: prefix }, { collectionId: prefix }] } }),
      db.communityGuideContent.count({ where: { OR: [{ id: prefix }, { slug: { in: manifest.guides } }] } }),
      db.communityVoyageKeepsake.count({ where: { OR: [{ id: prefix }, { ownerAccountId: prefix }] } }),
      db.communityVoyageLog.count({ where: { OR: [{ id: prefix }, { slug: { in: manifest.voyageLogs } }] } }),
      db.communityBadgeDefinition.count({ where: { OR: [{ id: prefix }, { key: "hp4-accessible-cartographer" }] } }),
      db.communityProfileBadgeGrant.count({ where: { OR: [{ id: prefix }, { profileId: prefix }] } }),
      db.communitySave.count({ where: { OR: [{ id: prefix }, { accountId: prefix }] } }),
      db.communityCreatorFollow.count({
        where: { OR: [{ id: prefix }, { followerAccountId: prefix }, { creatorProfileId: prefix }] },
      }),
      db.communityBlock.count({
        where: { OR: [{ id: prefix }, { blockerAccountId: prefix }, { blockedAccountId: prefix }] },
      }),
    ]);
    if (collisions.some(Boolean)) throw new Error("SEXTANT_COMMUNITY_PARTIAL_FIXTURE_PRESERVED");
    const attemptPath = path.join(directory, "sextant-community-bootstrap-attempt.json");
    const previousAttempt = await readFile(attemptPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (previousAttempt) throw new Error("SEXTANT_COMMUNITY_PREVIOUS_ATTEMPT_PRESERVED");
    const baseline = await db.taleSession.findUniqueOrThrow({
      where: { id: player.voyageId },
      select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
    });
    const edition = await db.publishedTaleVersion.findUniqueOrThrow({
      where: { id: player.versionId },
      select: { checksum: true, contentSnapshot: true },
    });
    await writeFile(attemptPath, JSON.stringify({ ...identity, nonce, status: "PRODUCER_STARTING" }), { flag: "wx" });
    let output: string;
    try {
      output = await labTool(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          'import path from "node:path";process.env.HOMEPORT_PHASE4_TASK_ROOT=path.dirname(process.env.DATABASE_URL.slice(5));await import("./scripts/homeport/seed-phase4-fixture.mjs");',
        ],
        60000,
      );
      await writeFile(path.join(directory, "sextant-community-bootstrap.original.log"), output, { flag: "wx" });
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; message?: string };
      await writeFile(
        path.join(directory, "sextant-community-bootstrap-failure.original.log"),
        `${failure.stdout ?? ""}\n${failure.stderr ?? ""}\n${failure.message ?? "Fixture producer failed"}\n`,
        { flag: "wx" },
      );
      throw error;
    }
    const receipt = JSON.parse(output.trim().split(/\r?\n/).at(-1)!);
    if (receipt.status !== "HOMEPORT_PHASE4_FIXTURE_READY" || receipt.fixtureChecksum !== identity.manifestSha256)
      throw new Error("SEXTANT_COMMUNITY_PRODUCER_RECEIPT_MISMATCH");
    const after = await db.taleSession.findUniqueOrThrow({
      where: { id: player.voyageId },
      select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
    });
    const afterEdition = await db.publishedTaleVersion.findUniqueOrThrow({
      where: { id: player.versionId },
      select: { checksum: true, contentSnapshot: true },
    });
    if (JSON.stringify(baseline) !== JSON.stringify(after) || JSON.stringify(edition) !== JSON.stringify(afterEdition))
      throw new Error("SEXTANT_COMMUNITY_CHANGED_PLAYER_BASELINE");
    await db.platformAuditEvent.create({
      data: {
        id: markerId,
        actorType: "SYSTEM",
        action: "SEXTANT_COMMUNITY_FIXTURE_READY",
        resourceType: "VALIDATION_FIXTURE",
        resourceId: nonce,
        correlationId: nonce,
        metadata: JSON.stringify(identity),
      },
    });
  }
  // Read through the production public projection on both first use and reuse.
  // A ready marker cannot make a now-private or moderated resource public.
  const publicListings = await Promise.all(manifest.publicListings.map((slug) => getHomeportListingDetail(slug)));
  const hiddenListings = await Promise.all(manifest.ineligibleListings.map((slug) => getHomeportListingDetail(slug)));
  if (
    publicListings.some((row) => !row || !row.release || row.release.semanticVersion !== "1.0.0") ||
    hiddenListings.some(Boolean)
  )
    throw new Error("SEXTANT_COMMUNITY_PUBLIC_RESOURCE_MISMATCH");
  return {
    ...identity,
    fixtureVersion: manifest.fixtureVersion,
    playerVoyageId: player.voyageId,
    playerVersionId: player.versionId,
    publicSlugs: manifest.publicListings,
    ineligibleSlugs: manifest.ineligibleListings,
  };
}
