import { db } from "@/lib/db";
import { migrateLegacyCompanion, type LegacyMigrationMode } from "@/chronicle/legacy-companion-migration";

function usage() {
  return [
    "Usage: npm run migrate:legacy-companion -- [--dry-run|--verify] [--campaign <slug>] [--continue-on-error]",
    "The command never prints source story, credentials, raw event payloads, or audit metadata.",
  ].join("\n");
}

function optionsFrom(argv: string[]) {
  let mode: LegacyMigrationMode = "execute";
  let campaignSlug: string | undefined;
  let failFast = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") mode = "dry-run";
    else if (token === "--verify") mode = "verify";
    else if (token === "--continue-on-error") failFast = false;
    else if (token === "--campaign") {
      const candidate = argv[index + 1];
      if (!candidate || candidate.startsWith("--")) throw new Error("--campaign requires a legacy Campaign slug.");
      campaignSlug = candidate;
      index += 1;
    } else if (token === "--help" || token === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${token}`);
  }
  return { mode, campaignSlug, failFast };
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  const report = await migrateLegacyCompanion(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.failures.length || report.checksumMismatches.length) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Legacy migration failed."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
