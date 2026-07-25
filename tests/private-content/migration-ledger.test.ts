import { describe, expect, it, vi } from "vitest";
import { privateMigrationStatus, verifyPrivateMigrationLedger } from "@/private-content/migration-ledger";
import { assessPrivateMigrationRun, runPrivateMigrations } from "@/private-content/migration-runner";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
describe("Phase 3 migration ledger", () => {
  const migrations = [
    { id: "20260725130000_project_sealed_hold_phase3_operations_control", sha256: "a".repeat(64), path: "safe" },
  ];
  it("reports pending, applied, and drift without running runtime credentials", () => {
    expect(verifyPrivateMigrationLedger(migrations, migrations)).toEqual({ status: "CURRENT", count: 1 });
    expect(privateMigrationStatus({ expected: migrations, applied: [] })).toEqual([
      { id: migrations[0].id, state: "PENDING" },
    ]);
    expect(
      privateMigrationStatus({ expected: migrations, applied: [{ id: migrations[0].id, sha256: "b".repeat(64) }] }),
    ).toEqual([{ id: migrations[0].id, state: "DRIFT" }]);
  });
  it("runs only pending immutable migrations in order and rejects altered or missing history", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-hold-ledger-"));
    const first = path.join(root, "001.sql");
    const second = path.join(root, "002.sql");
    await writeFile(first, "-- synthetic 1\n");
    await writeFile(second, "-- synthetic 2\n");
    const entries = [
      { id: "001", sha256: createHash("sha256").update("-- synthetic 1\n").digest("hex"), path: first },
      { id: "002", sha256: createHash("sha256").update("-- synthetic 2\n").digest("hex"), path: second },
    ];
    const applied: Array<{ id: string; sha256: string }> = [];
    const executor = {
      execute: vi.fn().mockResolvedValue(undefined),
      applied: vi.fn().mockImplementation(async () => applied),
      record: vi.fn().mockImplementation(async (entry) => applied.push({ id: entry.id, sha256: entry.sha256 })),
    };
    await expect(runPrivateMigrations({ migrations: entries, executor })).resolves.toMatchObject({
      applied: ["001", "002"],
    });
    expect(executor.execute).toHaveBeenNthCalledWith(1, "-- synthetic 1\n");
    await expect(runPrivateMigrations({ migrations: entries, executor })).resolves.toMatchObject({ applied: [] });
    expect(assessPrivateMigrationRun({ expected: entries, applied: [{ id: "001", sha256: "wrong" }] })).toContainEqual({
      id: "001",
      state: "DRIFT",
    });
    await expect(
      runPrivateMigrations({
        migrations: entries,
        executor: { ...executor, applied: async () => [{ id: "999", sha256: "x" }] },
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_CONTENT_CONFIGURATION_INVALID" });
  });
});
