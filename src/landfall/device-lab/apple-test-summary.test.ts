// @vitest-environment node
import { describe, expect, it } from "vitest";
import { combineApplePresentationSummaries } from "./apple-test-summary";

const summary = (passedTests: number, skippedTests = 0) => ({
  result: "Passed",
  expectedFailures: 0,
  passedTests,
  skippedTests,
  failedTests: 0,
  totalTestCount: passedTests + skippedTests,
});
describe("independent Apple presentation bundle collection", () => {
  it("retains the current thirty native passes and separate real Reduced Motion pass", () => {
    const native = { ...summary(30, 1), devicesAndConfigurations: ["first bundle"], statistics: ["first only"] };
    const combined = combineApplePresentationSummaries(native, { ...summary(1), finishTime: 123 });
    expect(combined).toMatchObject({
      passedTests: 31,
      failedTests: 0,
      skippedTests: 1,
      totalTestCount: 32,
      finishTime: 123,
    });
    expect(combined.devicesAndConfigurations).toBeUndefined();
    expect(combined.statistics).toBeUndefined();
    expect(native.passedTests).toBe(30);
    expect(native.devicesAndConfigurations).toEqual(["first bundle"]);
  });
  it.each([25, 29])("rejects an incomplete first bundle with %i passes", (passes) => {
    expect(() => combineApplePresentationSummaries(summary(passes, 1), summary(1))).toThrow(/COMPONENT_TESTS_REQUIRED/);
  });
  it("preserves a failed Reduced Motion obligation instead of accepting thirty earlier passes", () => {
    const failed = { ...summary(0), failedTests: 1, totalTestCount: 1, result: "Failed" };
    expect(() => combineApplePresentationSummaries(summary(30, 1), failed)).toThrow(/COMPONENT_TESTS_REQUIRED/);
  });
  it.each([
    { ...summary(30, 1), skippedTests: 2, totalTestCount: 32 },
    { ...summary(30, 1), totalTestCount: 30 },
    { ...summary(30, 1), failedTests: 1, totalTestCount: 32 },
    { ...summary(30, 1), passedTests: "30" },
    { ...summary(30, 1), expectedFailures: 1 },
  ])("rejects invalid or incomplete original component counts", (invalid) => {
    expect(() => combineApplePresentationSummaries(invalid, summary(1))).toThrow(/COMPONENT_TESTS_REQUIRED/);
  });
  it("does not replace an unexecuted or skipped Reduced Motion test with an expected pass", () => {
    expect(() => combineApplePresentationSummaries(summary(30, 1), summary(0, 1))).toThrow(/COMPONENT_TESTS_REQUIRED/);
  });
});
