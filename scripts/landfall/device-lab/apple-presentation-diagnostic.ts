import { createHash } from "node:crypto";

export const applePresentationDiagnosticTests = [
  "LandfallCompanionUiTests/NativeLifecycleTests/testOwnedSimulatorLargeTextAndOrientation",
  "LandfallCompanionUiTests/NativeLifecycleTests/testOwnedSimulatorReducedMotionSetting",
] as const;

export function appleBuildScope(value: unknown, profile: unknown, extraArguments: readonly string[] = []) {
  const scope = value ?? "all";
  if (scope !== "all" && scope !== "companion-only" && scope !== "presentation-diagnostic")
    throw new Error("LANDFALL_APPLE_BUILD_SCOPE_INVALID");
  if (scope === "presentation-diagnostic" && profile !== "primary-phone")
    throw new Error("LANDFALL_APPLE_PRESENTATION_DIAGNOSTIC_PROFILE_INVALID");
  if (scope === "presentation-diagnostic" && extraArguments.length !== 0)
    throw new Error("LANDFALL_APPLE_PRESENTATION_DIAGNOSTIC_ARGUMENT_INVALID");
  return scope;
}

/** A passing last component must never masquerade as successful full-suite proof. */
export function appleBuildFailureSummary(diagnostic: boolean, componentSummary: string) {
  if (!diagnostic) return { file: "test-summary.json", content: componentSummary };
  return {
    file: "presentation-diagnostic-failure-component-summary.json",
    content: JSON.stringify(
      {
        schemaVersion: 1,
        role: "DEVELOPMENT_ONLY",
        qualification: false,
        strictFull31Satisfied: false,
        result: "FAIL",
        componentSummary,
      },
      null,
      2,
    ),
  };
}

/** This target diagnoses two UI tests; it cannot consume closure authority. */
export function hostedApplePresentationDiagnostic(
  target: unknown,
  tier: unknown,
  scenarios: unknown,
  profile: unknown,
  graphicsBackend: unknown,
) {
  if (target !== "ios-presentation-diagnostic") return false;
  if (
    tier !== "development" ||
    scenarios !== undefined ||
    (profile !== undefined && profile !== "primary-phone") ||
    graphicsBackend !== undefined
  )
    throw new Error("LANDFALL_HOSTED_PRESENTATION_DIAGNOSTIC_SCOPE_INVALID");
  return true;
}

function presentationJob(workflow: string) {
  const matches = [...workflow.matchAll(/^  apple-presentation:\r?\n/gm)];
  if (matches.length !== 1) throw new Error("LANDFALL_PRESENTATION_DIAGNOSTIC_TEMPLATE_AMBIGUOUS");
  const start = matches[0].index! + matches[0][0].length;
  const next = /^  [A-Za-z0-9_-]+:\r?$/m.exec(workflow.slice(start));
  const end = next ? start + next.index : workflow.length;
  return { start, end, body: workflow.slice(start, end) };
}

/** Omission preserves every template byte. An explicit probe changes one job. */
export function applePresentationDiagnosticTemplate(template: string, diagnostic: boolean) {
  if (!diagnostic) return template;
  const job = presentationJob(template);
  let body = job.body;
  const replacements = [
    ["    name: Native / iOS presentation / primary-phone", "    name: Diagnostic / iOS presentation / primary-phone"],
    [
      "      - run: npx --no-install tsx scripts/landfall/device-lab/apple-build.ts",
      "      - run: npx --no-install tsx scripts/landfall/device-lab/apple-build.ts presentation-diagnostic",
    ],
    [
      "          name: landfall-ios-presentation-primary-phone-__CANDIDATE_SHA__",
      "          name: landfall-ios-presentation-diagnostic-primary-phone-__CANDIDATE_SHA__",
    ],
  ];
  if (
    [...body.matchAll(/^    timeout-minutes: 30\r?$/gm)].length !== 1 ||
    [...body.matchAll(/^      LANDFALL_LAB_PROFILE: primary-phone\r?$/gm)].length !== 1
  )
    throw new Error("LANDFALL_PRESENTATION_DIAGNOSTIC_TEMPLATE_INVALID");
  for (const [original, replacement] of replacements) {
    const lines = body.split(/\r?\n/).filter((line) => line === original);
    if (lines.length !== 1) throw new Error("LANDFALL_PRESENTATION_DIAGNOSTIC_TEMPLATE_INVALID");
    body = body.replace(original, replacement);
  }
  return template.slice(0, job.start) + body + template.slice(job.end);
}

export function applePresentationDiagnosticMetadata(diagnostic: boolean, workflow: string) {
  if (!diagnostic) return undefined;
  const job = presentationJob(workflow);
  if (
    !/^    if: true\r?$/m.test(job.body) ||
    !/^    name: Diagnostic \/ iOS presentation \/ primary-phone\r?$/m.test(job.body) ||
    [...job.body.matchAll(/^    timeout-minutes: 30\r?$/gm)].length !== 1 ||
    [...job.body.matchAll(/^      LANDFALL_LAB_PROFILE: primary-phone\r?$/gm)].length !== 1 ||
    !/^          name: landfall-ios-presentation-diagnostic-primary-phone-[a-f0-9]{40}\r?$/m.test(job.body) ||
    !/^      - run: npx --no-install tsx scripts\/landfall\/device-lab\/apple-build.ts presentation-diagnostic\r?$/m.test(
      job.body,
    ) ||
    [...workflow.matchAll(/^    if: true\r?$/gm)].length !== 1
  )
    throw new Error("LANDFALL_PRESENTATION_DIAGNOSTIC_WORKFLOW_INVALID");
  return {
    kind: "IOS_PRESENTATION_DIAGNOSTIC_ONLY" as const,
    role: "DEVELOPMENT_ONLY" as const,
    qualification: false,
    strictFull31Satisfied: false,
    native29Repeated: false,
    profile: "primary-phone" as const,
    tests: [...applePresentationDiagnosticTests],
    workflowSha256: createHash("sha256").update(workflow).digest("hex"),
  };
}

function onePassingTest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const summary = value as Record<string, unknown>;
  return (
    summary.result === "Passed" &&
    summary.expectedFailures === 0 &&
    summary.passedTests === 1 &&
    summary.failedTests === 0 &&
    summary.skippedTests === 0 &&
    summary.totalTestCount === 1
  );
}

/** Separate diagnostic proof never enters the strict 30+1 qualification combiner. */
export function applePresentationDiagnosticResult(largeText: unknown, motion: unknown) {
  if (!onePassingTest(largeText) || !onePassingTest(motion))
    throw new Error("LANDFALL_APPLE_PRESENTATION_DIAGNOSTIC_TESTS_REQUIRED");
  return {
    schemaVersion: 1,
    role: "DEVELOPMENT_ONLY" as const,
    scope: "TWO_PRESENTATION_TESTS_ONLY" as const,
    qualification: false,
    strictFull31Satisfied: false,
    native29Repeated: false,
    presentationAcceptance: false,
    result: "PASS" as const,
    passedTests: 2,
    failedTests: 0,
    skippedTests: 0,
    tests: [...applePresentationDiagnosticTests],
    componentSummaries: ["native-test-summary.json", "reduced-motion-test-summary.json"],
    physicalAssistiveTechnologyProven: false,
    limits: [
      "Only the two selected UI methods executed; the 29 companion tests did not repeat.",
      "This diagnostic cannot replace the strict full 31-test presentation gate or form a synthetic aggregate with another run.",
      "Simulator presentation is not physical assistive technology, native AR, joined Player or owner acceptance.",
    ],
  };
}
