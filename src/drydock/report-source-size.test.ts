import { expect, it } from "vitest";
import { canonicalChecksum, canonicalJson } from "./canonical";
import { createDrydockValidationReport } from "./reports";

it("hashes a full authored source without copying it into the report or changing bounded canonical guards", () => {
  const source = {
    chapters: Array.from({ length: 40 }, (_, i) => ({
      id: `synthetic-${i}`,
      prose: "Invented room description. ".repeat(100),
    })),
  };
  expect(() => canonicalJson(source)).toThrow(/byte limit/);
  const report = createDrydockValidationReport({ source, issues: [], generatedAt: "2026-10-13T12:00:00.000Z" });
  expect(report.sourceChecksum).toBe(canonicalChecksum(source));
  expect(JSON.stringify(report)).not.toContain("Invented room description");
  const small = { schemaVersion: 1, chapters: [] };
  expect(createDrydockValidationReport({ source: small, issues: [] }).sourceChecksum).toBe(canonicalChecksum(small));
  expect(() => createDrydockValidationReport({ source: { value: Infinity }, issues: [] })).toThrow(/finite/);
});
