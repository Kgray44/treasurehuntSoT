import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { seedSc07Experience } from "../../tests/fixtures/sc07-experience";

const profile = "sc07-community";
const contract = "harborlight.sc07.creator-community.experience";

async function main() {
  const candidate = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const plan = JSON.parse(await readFile("artifacts/sounding-line/product-experience-plan.json", "utf8"));
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : "";
  const ownedRoot = path.resolve("artifacts/sounding-line", `${profile}-${candidate.slice(0, 12)}`);
  const nonce = createHash("sha256").update(`sounding-line:${candidate}:${profile}`).digest("hex");
  const password = process.env.SC07_EXPERIENCE_PASSWORD ?? "";
  if (
    plan.candidateSha !== candidate ||
    plan.fixtureProfile !== profile ||
    plan.contracts?.length !== 1 ||
    plan.contracts[0]?.id !== contract ||
    plan.contracts[0]?.experience?.fixtureProfile !== profile ||
    process.env.SOUNDING_LINE_SUITE_PROFILE !== profile ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.FOREVER_VALIDATION_NONCE_HASH !== nonce ||
    !path.isAbsolute(databasePath) ||
    path.dirname(path.resolve(databasePath)) !== ownedRoot ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(path.basename(databasePath)) ||
    password.length < 24
  )
    throw new Error("SC07_EXPERIENCE_OWNED_FIXTURE_REQUIRED");

  if (path.dirname(await realpath(databasePath)) !== ownedRoot)
    throw new Error("SC07_EXPERIENCE_DATABASE_OUTSIDE_OWNED_ROOT");
  const markers = await db.platformAuditEvent.count({
    where: {
      action: "VALIDATION_DATABASE_IDENTITY",
      resourceType: "VALIDATION_DATABASE",
      resourceId: nonce,
      correlationId: nonce,
    },
  });
  if (markers !== 1) throw new Error("SC07_EXPERIENCE_DATABASE_IDENTITY_REQUIRED");

  const seeded = await seedSc07Experience(password);
  const devices = Object.fromEntries(
    Object.entries(seeded).map(([device, fixture]) => [
      device,
      {
        publisherEmail: fixture.publisher.email,
        moderatorEmail: fixture.moderator.email,
        installerEmail: fixture.installer.email,
        pendingTitle: fixture.pending.title,
        publisherCredit: fixture.pending.publisherCredit,
        savedOption: `STORY_BLOCK_PRESET:${fixture.saved.itemId}`,
        unsupportedOption: `STORY_BLOCK_PRESET:${fixture.unsupported.itemId}`,
        pendingReviewPath: `/admin/community/${fixture.pending.listingId}`,
        pendingChecksum: fixture.pending.packageChecksum,
        approvedTitle: fixture.approved.title,
        approvedPublicPath: `/community/${fixture.approved.slug}`,
        approvedChecksum: fixture.approved.packageChecksum,
        submissionSlug: `sc07-experience-${device.toLowerCase()}-submitted`,
        licenseKey: fixture.licenseKey,
      },
    ]),
  );
  await writeFile(`${databasePath}.sc07-experience.json`, JSON.stringify({ candidate, devices }) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
