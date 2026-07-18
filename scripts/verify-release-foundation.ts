import { db } from "../src/lib/db";

async function main() {
  try {
    const release = await db.visionRelease.findUnique({
      where: { id: "vision-b6-development-0.8.0" },
      include: {
        issues: true,
        compatibilityRules: true,
        testRuns: true,
      },
    });
    if (!release) throw new Error("The B-6 release baseline was not seeded.");
    const dataset = await db.visionDatasetManifest.findUnique({ where: { id: "vision-b6-synthetic-corpus" } });
    if (!dataset) throw new Error("The B-6 dataset manifest was not seeded.");
    const openBlockers = release.issues.filter(
      (issue) => issue.releaseBlocking && !["CLOSED", "RESOLVED"].includes(issue.status),
    );
    if (release.readinessStatus !== "NO_GO" || openBlockers.length < 1)
      throw new Error("Seeded B-6 readiness must remain NO_GO while release blockers are open.");
    if (release.issues.length !== 12) throw new Error(`Expected 12 B-6 issues, found ${release.issues.length}.`);
    if (release.compatibilityRules.length !== 11)
      throw new Error(`Expected 11 compatibility rules, found ${release.compatibilityRules.length}.`);
    if (!release.testRuns.some((run) => run.id === "b6-baseline-master-validation" && run.status === "PASS"))
      throw new Error("The observed pre-change validation evidence is missing.");
    if (!/^sha256:[a-f0-9]{64}$/.test(dataset.manifestHash))
      throw new Error("The persisted dataset manifest hash is invalid.");
    process.stdout.write(
      `${JSON.stringify({
        verified: true,
        releaseId: release.id,
        readiness: release.readinessStatus,
        openBlockers: openBlockers.length,
        issues: release.issues.length,
        compatibilityRules: release.compatibilityRules.length,
        datasetRevision: dataset.revision,
        datasetHash: dataset.manifestHash,
      })}\n`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((cause: unknown) => {
  console.error(cause);
  process.exitCode = 1;
});
