import { db } from "../../src/lib/db";
import { diagnosticProjection } from "../../src/tideglass/comparison";
import { compareExactEditions, prismaTideglassEditionRepository } from "../../src/tideglass/service";

function flags(args: string[]) {
  const values = new Map<string, string>();
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === "--json") {
      json = true;
      continue;
    }
    if (!["--account", "--chronicle", "--from", "--to"].includes(item)) throw new Error(`Unknown argument: ${item}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${item}.`);
    values.set(item, value);
    index += 1;
  }
  return { values, json };
}

async function main() {
  const parsed = flags(process.argv.slice(2));
  const accountId = parsed.values.get("--account");
  const chronicleId = parsed.values.get("--chronicle");
  const sourceEditionId = parsed.values.get("--from");
  const targetEditionId = parsed.values.get("--to");
  if (!accountId || !chronicleId || !sourceEditionId || !targetEditionId)
    throw new Error(
      "Usage: npm run tideglass:compare -- --account <trusted-local-account-id> --chronicle <id> --from <edition-id> --to <edition-id> [--json]",
    );

  const result = await compareExactEditions(
    prismaTideglassEditionRepository,
    { kind: "ACCOUNT", accountId },
    { chronicleId, sourceEditionId, targetEditionId },
  );
  if (!result.ok) {
    process.stderr.write(`${JSON.stringify(result)}\n`);
    process.exitCode = 1;
    return;
  }
  const projection = diagnosticProjection(result.value);
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    [
      `Tideglass ${projection.status}`,
      `Comparison: ${projection.comparisonId}`,
      `Editions: ${projection.pair.source.editionId} -> ${projection.pair.target.editionId}`,
      `Changes: ${projection.receipt.changeCount}`,
      `Digest: ${projection.receipt.deterministicChangeSetDigest}`,
    ].join("\n") + "\n",
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Tideglass diagnostic failed."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
