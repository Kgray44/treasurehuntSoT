import { describe, expect, it } from "vitest";
import { privateMigrationStatus, verifyPrivateMigrationLedger } from "@/private-content/migration-ledger";
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
});
