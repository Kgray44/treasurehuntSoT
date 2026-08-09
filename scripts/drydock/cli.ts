import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import { canonicalChecksum } from "../../src/drydock/canonical";
import { parseDrydockBlock } from "../../src/drydock/contracts/parser";
import { serializeDrydockBlockContractRegistry } from "../../src/drydock/contracts/registry";
import type { DrydockAuthoredBlockInput } from "../../src/drydock/contracts/model";
import { sanitizedIssueProjection } from "../../src/drydock/issues";
import { drydockProviderRegistry } from "../../src/drydock/providers";

const command = process.argv[2] ?? "help";

function print(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function inputBlocks(path: string): DrydockAuthoredBlockInput[] {
  const absolute = resolve(process.cwd(), path);
  const bytes = readFileSync(absolute);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("DRYDOCK_INPUT_SIZE_LIMIT");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("DRYDOCK_INPUT_INVALID");
  const candidate = parsed as { blocks?: unknown[] };
  return (candidate.blocks ?? [candidate]) as DrydockAuthoredBlockInput[];
}

function validate(blocks: readonly DrydockAuthoredBlockInput[]) {
  const results = blocks.map((block) => {
    const parsed = parseDrydockBlock(block);
    return {
      id: block.id,
      blockType: block.blockType,
      valid: parsed.success,
      migrationsApplied: parsed.migrationsApplied,
      compatibilityStatus: parsed.success ? "CURRENT" : parsed.compatibilityStatus,
      issues: parsed.issues.map(sanitizedIssueProjection),
      ...(parsed.success
        ? {
            schemaVersion: parsed.block.schemaVersion,
            checksum: canonicalChecksum(parsed.block),
          }
        : {}),
    };
  });
  print({ schemaVersion: 1, valid: results.every((result) => result.valid), checked: results.length, results });
  if (results.some((result) => !result.valid)) process.exitCode = 1;
}

if (command === "registry") print({ schemaVersion: 1, contracts: serializeDrydockBlockContractRegistry() });
else if (command === "migrations")
  print({
    schemaVersion: 1,
    migrations: serializeDrydockBlockContractRegistry().flatMap((contract) => contract.migrations),
  });
else if (command === "versions")
  print({
    schemaVersion: 1,
    versions: serializeDrydockBlockContractRegistry().map((contract) => ({
      blockType: contract.type,
      currentVersion: contract.currentVersion,
      minimumReaderVersion: contract.minimumReaderVersion,
    })),
  });
else if (command === "validate-registry") {
  const contracts = serializeDrydockBlockContractRegistry();
  const identities = contracts.map((contract) => `${contract.type}:${contract.currentVersion}`);
  const valid = contracts.length === 23 && new Set(identities).size === identities.length;
  print({ schemaVersion: 1, valid, contractCount: contracts.length, identities });
  if (!valid) process.exitCode = 1;
} else if (command === "verify-migrations") {
  const results = (fixture.blocks as DrydockAuthoredBlockInput[]).map((block) => {
    const parsed = parseDrydockBlock(block);
    const expected = `drydock.${block.blockType}.v1-to-v2`;
    return {
      fixtureId: block.id,
      blockType: block.blockType,
      valid: parsed.success && parsed.migrationsApplied.length === 1 && parsed.migrationsApplied[0] === expected,
      expectedMigrationId: expected,
      observedMigrationIds: parsed.migrationsApplied,
    };
  });
  const valid = results.every((result) => result.valid);
  print({ schemaVersion: 1, valid, checked: results.length, results });
  if (!valid) process.exitCode = 1;
} else if (command === "providers")
  print({
    schemaVersion: 1,
    providers: Object.values(drydockProviderRegistry).map((provider) => ({
      id: provider.id,
      version: provider.version,
      owner: provider.owner,
      state: provider.state,
      privacyClass: provider.privacyClass,
      requiresFallback: provider.requiresFallback,
      captainOverride: provider.captainOverride,
    })),
  });
else if (command === "validate-fixtures") validate(fixture.blocks as DrydockAuthoredBlockInput[]);
else if (command === "canonicalize-fixtures") {
  const results = (fixture.blocks as DrydockAuthoredBlockInput[]).map((block) => {
    const parsed = parseDrydockBlock(block);
    if (!parsed.success) throw new Error(`DRYDOCK_FIXTURE_INVALID:${block.blockType}`);
    return {
      fixtureId: block.id,
      blockType: block.blockType,
      schemaVersion: parsed.block.schemaVersion,
      canonicalBytes: Buffer.byteLength(JSON.stringify(parsed.block), "utf8"),
      checksum: canonicalChecksum(parsed.block),
    };
  });
  print({ schemaVersion: 1, classification: fixture.classification, results });
} else if (command === "validate") {
  const path = process.argv[3];
  if (!path) throw new Error("Usage: npm run drydock:cli -- validate <json-path>");
  validate(inputBlocks(path));
} else
  print({
    commands: [
      "registry",
      "validate-registry",
      "versions",
      "migrations",
      "verify-migrations",
      "providers",
      "validate-fixtures",
      "canonicalize-fixtures",
      "validate <json-path>",
    ],
    privacy: "Diagnostics contain contract metadata and sanitized issues only.",
  });
