import { describe, expect, it } from "vitest";
import { tideglassDiagnosticProjection } from "../../src/tideglass/diagnostics";
import { compareExactEditions } from "../../src/tideglass/service";
import { baseSnapshot, clone, edition, FixtureRepository } from "./fixtures";

describe("Tideglass diagnostic projection", () => {
  it("contains only bounded operational evidence and never the immutable snapshot", async () => {
    const source = edition("edition-a", baseSnapshot());
    const targetSnapshot = clone(baseSnapshot());
    targetSnapshot.tale.title = "Safe changed title";
    const target = edition("edition-b", targetSnapshot);
    const result = await compareExactEditions(
      new FixtureRepository([source, target]),
      { kind: "ACCOUNT", accountId: "creator" },
      { chronicleId: "chronicle-tideglass", sourceEditionId: source.id, targetEditionId: target.id },
      { correlationId: "diagnostic-correlation", cache: null },
    );
    const diagnostic = tideglassDiagnosticProjection(result);
    expect(diagnostic).toMatchObject({
      available: true,
      chronicleId: "chronicle-tideglass",
      sourceEditionId: "edition-a",
      targetEditionId: "edition-b",
      correlationId: "diagnostic-correlation",
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/contentSnapshot|safe changed title|configuration|private/i);
  });

  it("retains only a bounded failure code when no authorized result exists", () => {
    expect(tideglassDiagnosticProjection({ ok: false, code: "EDITION_NOT_AUTHORIZED", message: "ignored" })).toEqual({
      available: false,
      failureCode: "EDITION_NOT_AUTHORIZED",
      correlationId: null,
    });
  });
});
