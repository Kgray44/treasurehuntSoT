import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { db } from "@/lib/db";
import type { PublishedTaleSnapshot } from "@/tall-tale/types";

const require = createRequire(import.meta.url);
const { VisionBuildEngine } = require("../apps/companion/vision-build-engine.cjs") as {
  VisionBuildEngine: new (options: Record<string, unknown>) => {
    build(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};
const { sha256, stableStringify } = require("../apps/companion/vision-engine-contract.cjs") as {
  sha256(value: string): string;
  stableStringify(value: unknown): string;
};
const { createSyntheticPilots } = require("../apps/companion/vision-pilots.cjs") as {
  createSyntheticPilots(): Array<{
    id: string;
    buildInput: Record<string, unknown> & {
      waypoint: { id: string; versionId: string; versionNumber: number; type: string };
    };
    frameSets: Map<string, unknown>;
  }>;
};

const fixtureSlug = "b5-vision-integration-demo";
const buildId = "build_b5_validation_fixture_01";

async function main() {
  const creator = await db.gameMasterUser.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const waypoint = await db.visionWaypoint.findFirstOrThrow({
    where: { versions: { some: { publishedAt: { not: null } } } },
    include: {
      versions: {
        where: { publishedAt: { not: null } },
        orderBy: { versionNumber: "asc" },
        take: 1,
      },
    },
  });
  const version = waypoint.versions[0];
  const pilot = createSyntheticPilots()[0];
  const buildInput = structuredClone(pilot.buildInput);
  buildInput.waypoint = {
    id: waypoint.id,
    versionId: version.id,
    versionNumber: version.versionNumber,
    type: waypoint.type,
  };
  const inputHash = sha256(stableStringify(buildInput));
  let report: Record<string, unknown>;
  const existingBuild = await db.visionBuildJob.findUnique({ where: { id: buildId } });
  if (existingBuild) report = JSON.parse(existingBuild.report) as Record<string, unknown>;
  else {
    report = await new VisionBuildEngine({ preferred: ["CPU_CLASSICAL"] }).build({
      buildId,
      builtAt: "2026-07-18T00:00:00.000Z",
      buildInput,
      inputHash,
      provider: "CPU_CLASSICAL",
      resolveFrameSet: async (asset: { id: string }) => pilot.frameSets.get(asset.id),
    });
  }
  const runtimePackage = report.package as {
    manifest: { packageId: string; packageHash: string };
  };
  if (!runtimePackage?.manifest?.packageId || !runtimePackage.manifest.packageHash)
    throw new Error("The production B-4 fixture build did not return an immutable package.");
  const certification = (report.certification ?? {}) as {
    reliabilityGrade?: string;
    approvedRuntimeModes?: string[];
    metrics?: Record<string, unknown>;
  };
  if (!existingBuild)
    await db.visionBuildJob.create({
      data: {
        id: buildId,
        waypointVersionId: version.id,
        executionTarget: "LOCAL",
        engineMetadata: JSON.stringify({ fixture: true, productionEngine: true }),
        processingStage: "COMPLETE",
        status: "COMPLETED",
        progress: 1,
        inputSchemaVersion: 1,
        buildInput: JSON.stringify(buildInput),
        inputHash,
        packageId: runtimePackage.manifest.packageId,
        packageHash: runtimePackage.manifest.packageHash,
        report: JSON.stringify(report),
        providerMetadata: JSON.stringify(report.provider ?? {}),
        reliabilityGrade: certification.reliabilityGrade ?? "UNSAFE",
        automaticEligibility: false,
        completedAt: new Date(),
      },
    });
  const artifact = await db.visionBuildArtifact.upsert({
    where: {
      waypointVersionId_contentHash_artifactType: {
        waypointVersionId: version.id,
        contentHash: runtimePackage.manifest.packageHash,
        artifactType: "RUNTIME_PACKAGE",
      },
    },
    update: { buildJobId: buildId },
    create: {
      waypointVersionId: version.id,
      buildJobId: buildId,
      artifactType: "RUNTIME_PACKAGE",
      storageReference: `companion://vision-packages/${runtimePackage.manifest.packageId}`,
      contentHash: runtimePackage.manifest.packageHash,
      fileSize: Buffer.byteLength(JSON.stringify(runtimePackage)),
      schemaVersion: 1,
    },
  });
  const priorCertification = await db.visionCertificationRun.findFirst({
    where: { reportReference: `fixture://${buildId}` },
  });
  if (!priorCertification)
    await db.visionCertificationRun.create({
      data: {
        waypointVersionId: version.id,
        buildArtifactId: artifact.id,
        validationPartitionHash: sha256(`${inputHash}:validation`),
        lockedTestPartitionHash: sha256(`${inputHash}:locked`),
        thresholds: JSON.stringify(report.calibration ?? {}),
        profile: "BALANCED",
        metrics: JSON.stringify({
          ...(certification.metrics ?? {}),
          fieldEvidenceStatus: "MISSING",
          syntheticFixture: true,
          seaOfThievesClaim: false,
        }),
        observedFalseResults: JSON.stringify({ syntheticOnly: true }),
        reliabilityGrade: certification.reliabilityGrade ?? "UNSAFE",
        approvedRuntimeModes: JSON.stringify(["SHADOW"]),
        reportReference: `fixture://${buildId}`,
        completedAt: new Date(),
      },
    });
  const stageId = "b5_fixture_vision_stage";
  const revealId = "b5_fixture_reveal_stage";
  const completeId = "b5_fixture_complete_stage";
  const tale =
    (await db.tallTale.findUnique({ where: { slug: fixtureSlug } })) ??
    (await db.tallTale.create({
      data: {
        slug: fixtureSlug,
        title: "B-5 Governed Vision Integration",
        subtitle: "Synthetic replay acceptance voyage",
        shortDescription: "Exercises the real B-4 engine without claiming Sea of Thieves field evidence.",
        theme: "CARTOGRAPHERS_TABLE",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        creatorId: creator.id,
      },
    }));
  const now = new Date().toISOString();
  const snapshot: PublishedTaleSnapshot = {
    schemaVersion: 1,
    tale: {
      id: tale.id,
      slug: tale.slug,
      title: tale.title,
      subtitle: tale.subtitle,
      shortDescription: tale.shortDescription,
      longDescription: tale.longDescription,
      coverAssetId: tale.coverAssetId,
      theme: tale.theme,
      visibility: tale.visibility,
      playerCountMin: tale.playerCountMin,
      playerCountMax: tale.playerCountMax,
      estimatedDuration: tale.estimatedDuration,
      contentWarnings: tale.contentWarnings,
    },
    chapters: [
      {
        id: "b5_fixture_chapter",
        title: "The Governed Bearing",
        subtitle: "A synthetic replay, never field evidence",
        description: null,
        coverAssetId: null,
        estimatedDuration: 5,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: stageId,
        completionBlockId: completeId,
        blocks: [
          {
            id: stageId,
            chapterId: "b5_fixture_chapter",
            blockType: "visionWaypoint",
            title: "Inspect the Governed Landmark",
            internalLabel: null,
            configuration: {
              prompt: "Hold to inspect the governed landmark.",
              waypointVersionId: version.id,
              verificationProvider: "visionLocation",
              runtimeMode: "CAPTAIN_CONFIRMED",
              scanMode: "HOLD",
              holdDurationMs: 1_000,
              captureDurationMs: 5_000,
              sampleFps: 10,
              minimumFrames: 6,
              successEvent: "b5.fixture.reveal",
              insufficientMessage: "Show more of the surrounding landmark.",
              ambiguousMessage: "Include another landmark.",
              notAtTargetMessage: "This is not the governed destination.",
              systemErrorMessage: "The verifier is unavailable; progress remains safe.",
              captainFallbackEnabled: true,
              offlineBehavior: "RETRY_WHEN_ONLINE",
              completionMode: "visionLocation",
            },
            presentation: { spreadMode: "right", transitionOut: "page-turn" },
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 0,
            nextBlockId: revealId,
            connections: [
              {
                targetBlockId: revealId,
                connectionType: "DEFAULT",
                conditionExpression: null,
                label: null,
                orderIndex: 0,
              },
            ],
          },
          {
            id: revealId,
            chapterId: "b5_fixture_chapter",
            blockType: "narrative",
            title: "The governed mark is true",
            internalLabel: null,
            configuration: { body: "The story engine owns this reveal after the Captain approves." },
            presentation: { spreadMode: "two-page", transitionIn: "ink-settle" },
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 1,
            nextBlockId: completeId,
            connections: [
              {
                targetBlockId: completeId,
                connectionType: "DEFAULT",
                conditionExpression: null,
                label: null,
                orderIndex: 0,
              },
            ],
          },
          {
            id: completeId,
            chapterId: "b5_fixture_chapter",
            blockType: "taleComplete",
            title: "Fixture complete",
            internalLabel: null,
            configuration: { completionMode: "playerConfirmation" },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 2,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: now,
  };
  const contentSnapshot = JSON.stringify(snapshot);
  const checksum = createHash("sha256").update(contentSnapshot).digest("hex");
  let published = await db.publishedTaleVersion.findFirst({
    where: { taleId: tale.id, versionLabel: "b5-fixture" },
  });
  if (!published)
    published = await db.publishedTaleVersion.create({
      data: {
        taleId: tale.id,
        versionNumber: 1,
        versionLabel: "b5-fixture",
        publishedBy: creator.id,
        releaseNotes: "Validation-only synthetic replay fixture.",
        contentSnapshot,
        checksum,
        isCurrent: true,
      },
    });
  await db.tallTale.update({
    where: { id: tale.id },
    data: { status: "PUBLISHED", latestPublishedVersionId: published.id },
  });
  process.stdout.write(
    `${JSON.stringify({
      fixtureSlug,
      taleId: tale.id,
      versionId: published.id,
      waypointId: waypoint.id,
      waypointVersionId: version.id,
      packageId: runtimePackage.manifest.packageId,
      packageHash: runtimePackage.manifest.packageHash,
      statement: "Synthetic production-engine fixture; not Sea of Thieves field evidence.",
    })}\n`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
