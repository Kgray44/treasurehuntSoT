import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { getAuthoringAggregate } from "@/vision/authoring";

async function main() {
  const waypoint = await db.visionWaypoint.findFirst({
    where: { name: "B-1 Painted Lantern Waypoint" },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  assert.ok(waypoint, "The B-1 waypoint fixture must survive the B-3 migration.");
  const latest = waypoint.versions[0];
  assert.ok(latest, "The migrated waypoint needs a version.");
  assert.equal(latest.authoringRevision >= 1, true);
  assert.equal(latest.authoringMode, "GUIDED");
  assert.equal(latest.currentWizardStep, 1);

  const editable =
    latest.lifecycleStatus === "DRAFT"
      ? latest
      : await db.visionWaypointVersion.create({
          data: {
            waypointId: waypoint.id,
            versionNumber: latest.versionNumber + 1,
            parentVersionId: latest.id,
            lifecycleStatus: "DRAFT",
            verificationProfile: latest.verificationProfile,
            packageSchemaVersion: latest.packageSchemaVersion,
            draftConfiguration: latest.draftConfiguration,
            compatibilityMetadata: latest.compatibilityMetadata,
            createdBy: waypoint.ownerId,
          },
        });
  const aggregate = await getAuthoringAggregate(editable.id, waypoint.ownerId);
  assert.equal(aggregate.authoring.schemaVersion, 1);
  assert.equal(Array.isArray(aggregate.authoring.completedSteps), true);
  assert.equal(aggregate.dataHealth.readyToPrepare, false);
  assert.equal(
    aggregate.dataHealth.items.some((item) => item.code === "TARGET_REFERENCE_REQUIRED"),
    true,
  );

  const migratedCapture = await db.visionRecordingAsset.findFirst({ where: { waypointVersionId: editable.id } });
  if (migratedCapture) {
    assert.equal(typeof migratedCapture.role, "string");
    assert.equal(typeof migratedCapture.isUsable, "boolean");
    assert.equal(typeof migratedCapture.integrityState, "string");
  }

  console.log(
    JSON.stringify({
      area: "b3-authoring-migration",
      verified: true,
      waypointId: waypoint.id,
      versionId: editable.id,
      authoringRevision: editable.authoringRevision,
      guidedDefault: true,
      b1Preserved: true,
      b2AssetFieldsReadable: true,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
