import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createStudioTale, getStudioTale, saveStudioDraft } from "../../src/chronicle/studio-service";
import { publishedSourceChecksum, snapshotFromStudio } from "../../src/chronicle/snapshot";

// Seed only the saved Chronicle and its synthetic Drydock evidence. Publication still runs through the product.
export async function createChronicleFixture(
  ownerId: string,
  suffix: string,
  options: { withLocation?: boolean } = {},
) {
  const source = await createStudioTale({
    creatorId: ownerId,
    title: "Synthetic Harbor Tale",
    slug: `sc07-tale-${suffix}`,
    initialChapterTitle: "Opening",
  });
  const initial = await getStudioTale(source.id);
  const passageId = randomUUID();
  await saveStudioDraft(
    source.id,
    {
      autosaveVersion: initial.draft.autosaveVersion,
      tale: { ...initial.tale, visibility: "PRIVATE" },
      chapters: [
        {
          ...initial.draft.chapters[0],
          blocks: [
            {
              id: passageId,
              blockType: "narrative",
              title: "Welcome",
              configuration: { heading: "Welcome", body: "A fictional harbor awaits." },
              presentation: {},
              completion: { mode: "playerConfirmation" },
              isEnabled: true,
              schemaVersion: 2,
            },
          ],
        },
      ],
    },
    ownerId,
  );
  if (options.withLocation)
    await db.taleLocation.create({
      data: { taleId: source.id, name: "Synthetic harbor location", slug: "synthetic-harbor-location" },
    });
  const version = await freezeChronicleFixture(source.id, ownerId, suffix);
  return { source, version };
}

export async function freezeChronicleFixture(taleId: string, ownerId: string, suffix: string) {
  const snapshot = snapshotFromStudio(await getStudioTale(taleId));
  const checksum = publishedSourceChecksum(snapshot);
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: taleId,
      versionNumber: 1,
      versionLabel: "1.0",
      publishedBy: ownerId,
      publishedByAccountId: ownerId,
      contentSnapshot: JSON.stringify(snapshot),
      checksum,
      isCurrent: true,
    },
  });
  await db.drydockPublishingEvidence.create({
    data: {
      publishedVersionId: version.id,
      sourceChecksum: checksum,
      schemaVersion: 1,
      schemaRegistryVersion: 1,
      ruleCatalogVersion: 1,
      validationRunId: `synthetic-${suffix}`,
      requiredSuitePolicyVersion: "synthetic-test",
      compatibilityPolicyVersion: "synthetic-test",
      compatibilityDigest: "a".repeat(64),
      externalEvidenceDigest: "b".repeat(64),
      evidence: "{}",
      digest: randomUUID().replaceAll("-", "") + "c".repeat(32),
    },
  });
  await db.chronicle.update({
    where: { id: taleId },
    data: { status: "PUBLISHED", latestPublishedVersionId: version.id },
  });
  return version;
}
