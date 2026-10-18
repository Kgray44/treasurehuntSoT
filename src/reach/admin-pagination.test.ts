// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AdmiraltyCurrentOperator } from "@/admiralty/authorization";
import type { ReachSqlStore, ReachStore } from "./admin-storage";
import { getReachAdminOverview } from "./admin-service";
import { createReachTelemetryReport } from "./telemetry";

const now = new Date("2026-10-17T23:00:00Z");
const actor = { capabilities: ["CONFIG_OBSERVE"] } as AdmiraltyCurrentOperator;
function snapshotFixture(rows: number, counted = rows) {
  const report = createReachTelemetryReport();
  report.model.packets = 1;
  report.model.accepted = 1;
  report.model.postureEligible = 1;
  const json = JSON.stringify(report);
  let delivered = 0,
    pages = 0;
  const query = vi.fn(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    if (sql.includes("SELECT revision, policy")) return [];
    if (sql.includes("SELECT COUNT(*)")) return [{ reports: BigInt(counted) }];
    if (sql.includes("FROM ReachPolicyChange")) return [];
    if (!sql.includes("SELECT id,report,receivedAt")) throw new Error("UNEXPECTED_TEST_QUERY");
    expect(values.at(-1)).toBe(1000);
    if (delivered) expect(sql).toContain("id < ?");
    const page = Array.from({ length: Math.min(1000, rows - delivered) }, (_, index) => ({
      id: String(rows - delivered - index).padStart(12, "0"),
      receivedAt: now,
      report: json,
    }));
    delivered += page.length;
    pages++;
    return page;
  });
  const transaction = vi.fn(async (callback: (store: ReachSqlStore) => Promise<unknown>) => callback(store));
  const store = {
    $queryRaw: query,
    $executeRaw: vi.fn(async () => 0),
    $transaction: transaction,
  } as unknown as ReachStore;
  return {
    store,
    transaction,
    query,
    get pages() {
      return pages;
    },
  };
}

describe("complete bounded-memory Reach reporting projection", () => {
  it("aggregates all10037 reports through keysetpages inside one serializable snapshot", async () => {
    const fixture = snapshotFixture(10037);
    const result = await getReachAdminOverview(actor, fixture.store, now);
    expect(result.data?.reporting).toMatchObject({
      state: "AVAILABLE",
      coverage: { totalReports: 10037, returnedReports: 10037, truncated: false, pagesRead: 11, pageSize: 1000 },
    });
    expect(result.data?.reporting.summary).toMatchObject({
      totalReports: 10037,
      acceptedReports: 10037,
      invalidReports: 0,
      totals: { model: { packets: 10037, accepted: 10037, postureEligible: 10037 } },
    });
    expect(fixture.pages).toBe(11);
    expect(fixture.transaction).toHaveBeenCalledTimes(1);
    expect(fixture.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 30000,
    });
    expect(JSON.stringify(result)).not.toContain('"report":');
  }, 20000);
  it("fails a count/page mismatch instead of returning partial global histograms", async () => {
    const fixture = snapshotFixture(2, 3);
    await expect(getReachAdminOverview(actor, fixture.store, now)).rejects.toThrow("REACH_REPORT_SNAPSHOT_MISMATCH");
    expect(fixture.pages).toBe(2);
  });
});
