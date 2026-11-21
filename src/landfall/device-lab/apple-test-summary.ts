type AppleTestSummary = Record<string, unknown> & {
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalTestCount: number;
};

function passingSummary(value: unknown): value is AppleTestSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const summary = value as Record<string, unknown>;
  const counts = [summary.passedTests, summary.failedTests, summary.skippedTests, summary.totalTestCount];
  return (
    counts.every((count) => typeof count === "number" && Number.isInteger(count) && count >= 0) &&
    summary.result === "Passed" &&
    summary.failedTests === 0 &&
    summary.expectedFailures === 0 &&
    summary.totalTestCount === (summary.passedTests as number) + (summary.skippedTests as number)
  );
}

/** Join the two actual XCTest bundles only after each independently passes. */
export function combineApplePresentationSummaries(native: unknown, motion: unknown): AppleTestSummary {
  if (
    !passingSummary(native) ||
    !passingSummary(motion) ||
    native.passedTests !== 30 ||
    native.skippedTests > 1 ||
    motion.passedTests !== 1 ||
    motion.skippedTests !== 0
  )
    throw new Error("LANDFALL_APPLE_PRESENTATION_COMPONENT_TESTS_REQUIRED");
  const combined: AppleTestSummary = {
    ...native,
    passedTests: native.passedTests + motion.passedTests,
    failedTests: 0,
    skippedTests: native.skippedTests,
    totalTestCount: native.totalTestCount + motion.totalTestCount,
    finishTime: motion.finishTime,
    componentSummaries: ["native-test-summary.json", "reduced-motion-test-summary.json"],
  };
  // These describe only the original bundle, never the combined result.
  for (const field of ["devicesAndConfigurations", "testResults", "statistics", "topInsights"]) delete combined[field];
  return combined;
}
