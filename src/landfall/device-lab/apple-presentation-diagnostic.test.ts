// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appleBuildScope,
  appleBuildFailureSummary,
  applePresentationDiagnosticMetadata,
  applePresentationDiagnosticResult,
  applePresentationDiagnosticTemplate,
  applePresentationDiagnosticTests,
  hostedApplePresentationDiagnostic,
} from "../../../scripts/landfall/device-lab/apple-presentation-diagnostic";
import { dispatchLandfallHostedLab, parseHostedLabArguments } from "../../../scripts/landfall/device-lab/hosted";
import { combineApplePresentationSummaries } from "./apple-test-summary";

const io = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn(), rm: vi.fn(), labTool: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: io.mkdir, writeFile: io.writeFile, rm: io.rm }));
vi.mock("../../../scripts/landfall/device-lab/host", () => ({ labTool: io.labTool }));
const template = readFileSync(path.join(process.cwd(), ".agents/landfall-device-lab-hosted.yml"), "utf8");
const candidate = "a".repeat(40);
const onePass = () => ({
  result: "Passed",
  expectedFailures: 0,
  passedTests: 1,
  failedTests: 0,
  skippedTests: 0,
  totalTestCount: 1,
});
const selectedWorkflow = () =>
  applePresentationDiagnosticTemplate(template, true)
    .replaceAll("__RUN_APPLE_PRESENTATION__", "true")
    .replace(/__RUN_[A-Z_]+__/g, "false")
    .replaceAll("__CANDIDATE_SHA__", candidate);

describe("development-only two-test Apple presentation diagnostic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves default template bytes and ordinary build scopes", () => {
    for (const source of [template, template.replaceAll("\n", "\r\n")])
      expect(applePresentationDiagnosticTemplate(source, false)).toBe(source);
    expect(appleBuildScope(undefined, "primary-phone")).toBe("all");
    expect(appleBuildScope("all", "tablet")).toBe("all");
    expect(appleBuildScope("companion-only", "compatibility-phone")).toBe("companion-only");
    expect(applePresentationDiagnosticMetadata(false, template)).toBeUndefined();
    expect(
      hostedApplePresentationDiagnostic("ios-presentation", "closure", undefined, "primary-phone", undefined),
    ).toBe(false);
  });

  it("selects exactly the existing two UI methods and accepts only development primary-phone scope", () => {
    expect(applePresentationDiagnosticTests).toEqual([
      "LandfallCompanionUiTests/NativeLifecycleTests/testOwnedSimulatorLargeTextAndOrientation",
      "LandfallCompanionUiTests/NativeLifecycleTests/testOwnedSimulatorReducedMotionSetting",
    ]);
    expect(appleBuildScope("presentation-diagnostic", "primary-phone")).toBe("presentation-diagnostic");
    for (const profile of [undefined, "primary-phone"])
      expect(
        hostedApplePresentationDiagnostic("ios-presentation-diagnostic", "development", undefined, profile, undefined),
      ).toBe(true);
    expect(
      parseHostedLabArguments([
        candidate,
        "ios-presentation-diagnostic",
        "development",
        "--ios-runner",
        "macos-26-intel",
      ]).iosRunner,
    ).toBe("macos-26-intel");
    for (const profile of ["tablet", "compatibility-phone", "primary-phone,tablet", undefined])
      expect(() => appleBuildScope("presentation-diagnostic", profile)).toThrow(/PROFILE_INVALID/);
    for (const scope of ["motion-only", "", true, {}, 1])
      expect(() => appleBuildScope(scope, "primary-phone")).toThrow(/SCOPE_INVALID/);
    expect(() => appleBuildScope("presentation-diagnostic", "primary-phone", ["all"])).toThrow(/ARGUMENT_INVALID/);
    expect(appleBuildScope("all", "primary-phone", ["legacy-ignored"])).toBe("all");
  });

  it("rejects protected tiers, selectors, profiles and backend overrides before any tool or file mutation", async () => {
    for (const [tier, scenarios, profile, backend] of [
      ["closure", undefined, undefined, undefined],
      ["candidate", undefined, "primary-phone", undefined],
      ["development", "gps-perfect-walk", "primary-phone", undefined],
      ["development", "", undefined, undefined],
      ["development", undefined, "tablet", undefined],
      ["development", undefined, "primary-phone,compatibility-phone", undefined],
      ["development", undefined, undefined, "swangle"],
    ]) {
      await expect(
        dispatchLandfallHostedLab(
          candidate,
          process.cwd(),
          "ios-presentation-diagnostic",
          tier!,
          scenarios,
          profile,
          backend,
        ),
      ).rejects.toThrow(/DIAGNOSTIC_SCOPE_INVALID/);
    }
    expect(io.labTool).not.toHaveBeenCalled();
    expect(io.mkdir).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
    expect(io.rm).not.toHaveBeenCalled();
  });

  it("changes only the existing presentation job labels and command, preserving all bounds and other jobs", () => {
    const output = applePresentationDiagnosticTemplate(template, true);
    expect(
      output
        .replace("Diagnostic / iOS presentation / primary-phone", "Native / iOS presentation / primary-phone")
        .replace("apple-build.ts presentation-diagnostic", "apple-build.ts")
        .replace("landfall-ios-presentation-diagnostic-primary-phone-", "landfall-ios-presentation-primary-phone-"),
    ).toBe(template);
    expect(output.slice(0, output.indexOf("  apple-presentation:"))).toBe(
      template.slice(0, template.indexOf("  apple-presentation:")),
    );
    expect(output.slice(output.indexOf("  android:"))).toBe(template.slice(template.indexOf("  android:")));
    expect(applePresentationDiagnosticTemplate(template.replaceAll("\n", "\r\n"), true)).toBe(
      output.replaceAll("\n", "\r\n"),
    );
  });

  it("fails closed on missing, duplicated or altered diagnostic seams", () => {
    for (const invalid of [
      template.replace("  apple-presentation:", "  moved-presentation:"),
      template + "\n  apple-presentation:\n    timeout-minutes: 30\n",
      template.replace(
        "apple-build.ts\n      - uses: actions/upload-artifact",
        "apple-build.ts all\n      - uses: actions/upload-artifact",
      ),
      template.replace(
        "    name: Native / iOS presentation / primary-phone",
        "    timeout-minutes: 30\n    name: Native / iOS presentation / primary-phone",
      ),
      template.replace(
        "    name: Native / iOS presentation / primary-phone",
        "    name: Native / iOS presentation / tablet",
      ),
    ])
      expect(() => applePresentationDiagnosticTemplate(invalid, true)).toThrow();
  });

  it("binds diagnostic-only provenance to one enabled job and exact workflow bytes", () => {
    const workflow = selectedWorkflow();
    expect(applePresentationDiagnosticMetadata(true, workflow)).toMatchObject({
      kind: "IOS_PRESENTATION_DIAGNOSTIC_ONLY",
      role: "DEVELOPMENT_ONLY",
      qualification: false,
      strictFull31Satisfied: false,
      native29Repeated: false,
      tests: [...applePresentationDiagnosticTests],
      workflowSha256: createHash("sha256").update(workflow).digest("hex"),
    });
    for (const invalid of [
      workflow.replace("    if: false", "    if: true"),
      workflow.replace("apple-build.ts presentation-diagnostic", "apple-build.ts"),
      workflow.replace("Diagnostic / iOS presentation", "Native / iOS presentation"),
      workflow.replace(
        "landfall-ios-presentation-diagnostic-primary-phone-",
        "landfall-ios-presentation-primary-phone-",
      ),
      workflow.replace(
        "    name: Diagnostic / iOS presentation / primary-phone",
        "    timeout-minutes: 30\n    name: Diagnostic / iOS presentation / primary-phone",
      ),
    ])
      expect(() => applePresentationDiagnosticMetadata(true, invalid)).toThrow(/WORKFLOW_INVALID/);
  });

  it("requires both actual one-test passes and never synthesizes the strict 31-test gate", () => {
    const result = applePresentationDiagnosticResult(onePass(), onePass());
    expect(result).toMatchObject({
      passedTests: 2,
      failedTests: 0,
      skippedTests: 0,
      qualification: false,
      strictFull31Satisfied: false,
      native29Repeated: false,
      presentationAcceptance: false,
    });
    expect(() => combineApplePresentationSummaries(result, onePass())).toThrow(/COMPONENT_TESTS_REQUIRED/);
    for (const invalid of [
      { ...onePass(), result: "Failed", passedTests: 0, failedTests: 1 },
      { ...onePass(), passedTests: 0, skippedTests: 1 },
      { ...onePass(), passedTests: 30, totalTestCount: 30 },
      { ...onePass(), passedTests: "1" },
      { ...onePass(), expectedFailures: 1 },
      { ...onePass(), totalTestCount: 2 },
    ]) {
      expect(() => applePresentationDiagnosticResult(invalid, onePass())).toThrow(/TESTS_REQUIRED/);
      expect(() => applePresentationDiagnosticResult(onePass(), invalid)).toThrow(/TESTS_REQUIRED/);
    }
  });

  it("retains a passing last component as diagnostic failure without publishing generic success", () => {
    const component = JSON.stringify(onePass());
    const failure = appleBuildFailureSummary(true, component);
    expect(failure.file).toBe("presentation-diagnostic-failure-component-summary.json");
    expect(failure.file).not.toBe("test-summary.json");
    expect(JSON.parse(failure.content)).toMatchObject({
      result: "FAIL",
      qualification: false,
      strictFull31Satisfied: false,
      componentSummary: component,
    });
    expect(appleBuildFailureSummary(false, component)).toEqual({ file: "test-summary.json", content: component });
    expect(JSON.parse(appleBuildFailureSummary(true, "XCRESULT_NOT_CREATED").content).componentSummary).toBe(
      "XCRESULT_NOT_CREATED",
    );
  });
});
