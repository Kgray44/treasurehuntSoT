import { describe, expect, it } from "vitest";
import { backupOverdue, privateScheduleKey } from "@/private-content/scheduling";
describe("Phase 3 scheduling policy", () => {
  it("uses one durable key per scheduled window and detects overdue backup evidence", () => {
    expect(privateScheduleKey("BACKUP_CREATE", "2026-07-25")).toBe("BACKUP_CREATE:2026-07-25");
    expect(() => privateScheduleKey("BACKUP_CREATE", "../unsafe")).toThrow();
    expect(backupOverdue({ lastVerifiedAt: new Date(0), now: new Date(10_000), maximumAgeMs: 1000 })).toBe(true);
  });
});
