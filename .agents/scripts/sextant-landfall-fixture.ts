/** Guarded synthetic Landfall data; browser journeys still use ordinary sign-in. */
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { ingestAsset } from "../../src/chronicle/assets";
import { getStudioTale, saveStudioDraft, studioDraftSchema } from "../../src/chronicle/studio-service";
import { snapshotFromStudio } from "../../src/chronicle/snapshot";
import type { PublishedTaleSnapshot } from "../../src/chronicle/types";
import { getDrydockBlockContract } from "../../src/drydock/contracts/registry";
import { validateLandfallDefinition } from "../../src/landfall/definition";
import { closureVoyage } from "../../tests/e2e/fixtures/landfall-closure";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";
import { sextantOwnedSyntheticOutbox } from "./sextant-account-recovery-fixture";
import { prepareSextantPhysicalContext, sextantGenericPhysicalDefinition } from "./sextant-landfall-physical-context";

type Variant = "default" | "1280-no-preference" | "1280-reduce" | "390-no-preference" | "390-reduce";
export type SextantLandfallKind = "physical" | "physical-landmark" | "virtual";

async function ownedAssetStorage() {
  // The canonical default belongs to this isolated checkout. Never borrow a configured store.
  if (process.env.CHRONICLE_ASSET_ROOT) throw new Error("SEXTANT_LANDFALL_CONFIGURED_ASSET_STORE_REFUSED");
  for (const directory of [path.resolve(".data"), path.resolve(".data/chronicle-assets")]) {
    try {
      const stat = await lstat(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory() || (await realpath(directory)) !== directory)
        throw new Error("SEXTANT_LANDFALL_ASSET_STORE_IDENTITY_REFUSED");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function seedSextantLandfallExperience(kind: SextantLandfallKind, variant: Variant = "default") {
  if (
    !["physical", "physical-landmark", "virtual"].includes(kind) ||
    !["default", "1280-no-preference", "1280-reduce", "390-no-preference", "390-reduce"].includes(variant)
  )
    throw new Error("SEXTANT_LANDFALL_CASE_REFUSED");
  // Reuse the exact HEAD-derived DB/nonce/HTTP preflight; no email is delivered.
  sextantOwnedSyntheticOutbox();
  await ownedAssetStorage();
  // The inherited fixture then verifies its database audit marker before mutation.
  const base = await seedSextantResourceExperiences(`landfall-${kind}-${variant}`);
  const suffix = `${kind}-${variant}`;
  const taleId = `sextant-landfall-chronicle-${suffix}`;
  const voyageId = `sextant-landfall-voyage-${suffix}`;
  if (
    (await db.chronicle.count({ where: { id: taleId } })) ||
    (await db.taleSession.count({ where: { id: voyageId } }))
  )
    throw new Error("SEXTANT_LANDFALL_EXISTING_CASE_REFUSED");
  const owner = await db.playerProfile.findUniqueOrThrow({ where: { accountId: base.ownerId } });
  const crew = await db.playerProfile.findUniqueOrThrow({ where: { accountId: base.crewAccountId } });
  const voyage = await closureVoyage(
    { id: base.ownerId, profileId: owner.id, token: "NOT_USED_FOR_AUTHENTICATION" },
    { id: base.crewAccountId, profileId: crew.id, token: "NOT_USED_FOR_AUTHENTICATION" },
    "livingChart",
    {
      virtual: kind === "virtual",
      image: kind === "virtual",
      contextual: kind === "virtual",
      offlineRegion: kind === "virtual",
      captain: true,
      ...(kind === "physical-landmark" ? { authoredDefinition: sextantGenericPhysicalDefinition(taleId) } : {}),
      fixtureIds: {
        tale: taleId,
        session: voyageId,
        chapter: `sextant-landfall-chapter-${suffix}`,
        active: `sextant-landfall-chart-${suffix}`,
        next: `sextant-landfall-ending-${suffix}`,
      },
    },
  );
  const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
  if (createHash("sha256").update(version.contentSnapshot).digest("hex") !== version.checksum)
    throw new Error("SEXTANT_LANDFALL_INITIAL_EDITION_MISMATCH");
  const snapshot = JSON.parse(version.contentSnapshot) as PublishedTaleSnapshot;
  const title = `Synthetic Sextant ${kind === "virtual" ? "island" : kind === "physical" ? "field" : "generic field"} Chart`;
  snapshot.tale.title = title;
  snapshot.tale.slug = `sextant-landfall-${suffix}`;
  const definition = structuredClone(voyage.definition);
  if (kind !== "virtual") {
    const buffer = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#305060" } })
      .png()
      .toBuffer();
    const { asset } = await ingestAsset(
      taleId,
      new File([new Uint8Array(buffer)], "synthetic-landmark.png", { type: "image/png" }),
      base.ownerId,
    );
    snapshot.assets.push({
      id: asset.id,
      mediaType: asset.mediaType,
      displayName: "Synthetic landmark reference",
      description: null,
      mimeType: asset.mimeType,
      width: 400,
      height: 300,
      roles: [],
      variants: asset.variants.map((variant) => ({
        id: variant.id,
        role: variant.role,
        checksum: variant.checksum,
        storageKey: variant.storageKey,
        mimeType: variant.mimeType,
        processingState: variant.processingState,
      })),
    });
    prepareSextantPhysicalContext(definition, asset.id, {
      worldspaceId: definition.worldspaces[0].id,
      waypointId: definition.waypoints[0].id,
    });
  }
  snapshot.landfall = validateLandfallDefinition(definition);
  // Finish this new synthetic edition before browser entry; existing baseline editions stay byte-identical.
  const bytes = JSON.stringify(snapshot);
  await db.publishedTaleVersion.update({
    where: { id: version.id },
    data: { contentSnapshot: bytes, checksum: createHash("sha256").update(bytes).digest("hex") },
  });
  await db.chronicle.update({ where: { id: taleId }, data: { title, slug: snapshot.tale.slug } });
  const draftChapters = structuredClone(snapshot.chapters);
  for (const chapter of draftChapters)
    for (const block of chapter.blocks) {
      if (!["livingChart", "taleComplete"].includes(block.blockType))
        throw new Error("SEXTANT_LANDFALL_DRAFT_BLOCK_REFUSED");
      const contract = getDrydockBlockContract(block.blockType)!;
      const configuration = structuredClone(contract.defaultConfiguration);
      if (block.blockType === "livingChart") {
        configuration.heading = block.configuration.heading;
        configuration.body = block.configuration.body;
        configuration.worldspaceId = block.configuration.worldspaceId;
      }
      block.schemaVersion = contract.currentVersion;
      block.configuration = contract.configurationSchema.parse(configuration);
      block.completion = structuredClone(contract.defaultCompletion);
      block.connections = block.nextBlockId
        ? [{ targetBlockId: block.nextBlockId, connectionType: "DEFAULT", orderIndex: 0 }]
        : [];
    }
  const draft = await db.taleDraft.create({
    data: {
      taleId,
      createdBy: owner.id,
      createdByAccountId: base.ownerId,
      landfallDefinition: JSON.stringify(snapshot.landfall),
    },
  });
  await db.chronicle.update({ where: { id: taleId }, data: { currentDraftRevisionId: draft.id } });
  await saveStudioDraft(
    taleId,
    studioDraftSchema.parse({
      autosaveVersion: draft.autosaveVersion,
      tale: snapshot.tale,
      chapters: draftChapters,
      landfall: snapshot.landfall,
    }),
    base.ownerId,
  );
  snapshotFromStudio(await getStudioTale(taleId));
  return {
    ...base,
    landfallVoyageId: voyageId,
    landfallTaleId: taleId,
    landfallVersionId: version.id,
    landfallTitle: title,
    kind,
  };
}
