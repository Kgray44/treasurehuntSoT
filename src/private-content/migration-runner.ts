import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { PrivateMigrationLedgerEntry } from "./migration-ledger";
import { privateFailure } from "./core";

export type AppliedPrivateMigration = { id: string; sha256: string; appliedAt?: string };
export type PrivateMigrationExecutor = {
  /** This adapter is supplied only by the explicit migration command, never the web runtime. */
  execute(sql: string): Promise<void>;
  applied(): Promise<AppliedPrivateMigration[]>;
  record(entry: PrivateMigrationLedgerEntry): Promise<void>;
};

export function assessPrivateMigrationRun(input: {
  expected: readonly PrivateMigrationLedgerEntry[];
  applied: readonly AppliedPrivateMigration[];
}) {
  const expected = new Map(input.expected.map((entry) => [entry.id, entry]));
  const applied = new Map(input.applied.map((entry) => [entry.id, entry]));
  const rows = input.expected.map((entry) => {
    const present = applied.get(entry.id);
    return {
      id: entry.id,
      state: !present ? "PENDING" : present.sha256 === entry.sha256 ? "APPLIED" : ("DRIFT" as const),
    };
  });
  for (const entry of input.applied)
    if (!expected.has(entry.id)) rows.push({ id: entry.id, state: "MISSING" as const });
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Forward-only ledger runner. Historical bytes are verified before any SQL is
 * executed; an altered or missing historical migration therefore fails closed.
 */
export async function runPrivateMigrations(input: {
  migrations: readonly PrivateMigrationLedgerEntry[];
  executor: PrivateMigrationExecutor;
  dryRun?: boolean;
}) {
  const applied = await input.executor.applied();
  const status = assessPrivateMigrationRun({ expected: input.migrations, applied });
  if (status.some((item) => item.state === "DRIFT" || item.state === "MISSING"))
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private migration ledger drift was detected.");
  const pending = input.migrations.filter((entry) => !applied.some((item) => item.id === entry.id));
  if (input.dryRun) return { dryRun: true as const, pending: pending.map((entry) => entry.id), status };
  for (const entry of pending) {
    const bytes = await readFile(entry.path);
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
      throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private migration source drift was detected.");
    await input.executor.execute(bytes.toString("utf8"));
    await input.executor.record(entry);
  }
  return {
    dryRun: false as const,
    applied: pending.map((entry) => entry.id),
    status: assessPrivateMigrationRun({ expected: input.migrations, applied: [...applied, ...pending] }),
  };
}
