import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { privateFailure } from "./core";

export type PrivateMigrationLedgerEntry = { id: string; sha256: string; path: string };
export async function discoverPrivateMigrations(root: string, prefix: string | RegExp) {
  const entries = await readdir(root, { withFileTypes: true });
  const selected = entries
    .filter(
      (entry) =>
        entry.isDirectory() && (typeof prefix === "string" ? entry.name.startsWith(prefix) : prefix.test(entry.name)),
    )
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    selected.map(async (id) => {
      const migrationPath = path.join(root, id, "migration.sql");
      const source = await readFile(migrationPath);
      return { id, sha256: createHash("sha256").update(source).digest("hex"), path: migrationPath };
    }),
  );
}
export function verifyPrivateMigrationLedger(
  expected: readonly PrivateMigrationLedgerEntry[],
  actual: readonly PrivateMigrationLedgerEntry[],
) {
  if (
    expected.length !== actual.length ||
    expected.some((item, index) => item.id !== actual[index]?.id || item.sha256 !== actual[index]?.sha256)
  )
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private migration ledger drift was detected.");
  return { status: "CURRENT" as const, count: actual.length };
}
export function privateMigrationStatus(input: {
  expected: readonly PrivateMigrationLedgerEntry[];
  applied: readonly { id: string; sha256: string }[];
}) {
  const applied = new Map(input.applied.map((item) => [item.id, item.sha256]));
  return input.expected.map((item) => ({
    id: item.id,
    state: !applied.has(item.id) ? "PENDING" : applied.get(item.id) === item.sha256 ? "APPLIED" : ("DRIFT" as const),
  }));
}
