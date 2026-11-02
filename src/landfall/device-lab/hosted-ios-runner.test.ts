// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchLandfallHostedLab,
  hostedIosRunnerLabel,
  hostedIosRunnerMetadata,
  hostedIosRunnerTemplate,
  parseHostedLabArguments,
} from "../../../scripts/landfall/device-lab/hosted";

const io = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn(), rm: vi.fn(), labTool: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: io.mkdir, writeFile: io.writeFile, rm: io.rm }));
vi.mock("../../../scripts/landfall/device-lab/host", () => ({ labTool: io.labTool }));

const template = readFileSync(path.join(process.cwd(), ".agents/landfall-device-lab-hosted.yml"), "utf8");
const candidate = "a".repeat(40);

describe("explicit hosted iOS runner selection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves default bytes, legacy arguments and receipt metadata unchanged", () => {
    for (const source of [template, template.replaceAll("\n", "\r\n")])
      expect(hostedIosRunnerTemplate(source, undefined)).toBe(source);
    expect(hostedIosRunnerMetadata(undefined, template)).toBeUndefined();
    expect(hostedIosRunnerLabel(undefined, "all")).toBeUndefined();
    expect(
      parseHostedLabArguments([candidate, "android", "development", "gps-perfect-walk", "primary-phone", "swangle"]),
    ).toEqual({
      positional: [candidate, "android", "development", "gps-perfect-walk", "primary-phone", "swangle"],
      iosRunner: undefined,
    });
  });

  it("allowlists only standard verified labels on iOS-only targets", () => {
    for (const target of ["ios", "ios-presentation"])
      for (const runner of ["macos-latest", "macos-26", "macos-26-intel"])
        expect(hostedIosRunnerLabel(runner, target)).toBe(runner);
    for (const value of [
      "",
      "macos-26-large",
      "self-hosted",
      "macos-26\n    timeout-minutes: 999",
      "$(secret)",
      null,
      1,
      {},
    ])
      expect(() => hostedIosRunnerLabel(value, "ios")).toThrow("LANDFALL_HOSTED_IOS_RUNNER_INVALID");
    for (const target of [
      "all",
      "browser",
      "provider",
      "android",
      "android-radio",
      "android-journal",
      "android-background",
      undefined,
    ])
      expect(() => hostedIosRunnerLabel("macos-26-intel", target)).toThrow(
        "LANDFALL_HOSTED_IOS_RUNNER_TARGET_REQUIRED",
      );
  });

  it("changes only the three existing Apple labels, preserving suites and other jobs", () => {
    const source = template + "\n  other:\n    runs-on: macos-latest\n    steps: []\n";
    const output = hostedIosRunnerTemplate(source, "macos-26-intel");
    expect(output.match(/runs-on: macos-26-intel/g)).toHaveLength(3);
    expect(output.replaceAll("runs-on: macos-26-intel", "runs-on: macos-latest")).toBe(source);
    expect(output.slice(output.indexOf("  android:"))).toBe(source.slice(source.indexOf("  android:")));
    expect(output).toContain("  other:\n    runs-on: macos-latest\n");
    expect(hostedIosRunnerTemplate(source.replaceAll("\n", "\r\n"), "macos-26-intel")).toBe(
      output.replaceAll("\n", "\r\n"),
    );
  });

  it("fails closed for missing, duplicated, computed or changed Apple runner slots", () => {
    for (const source of [
      template.replace("  apple:", "  moved-apple:"),
      template + "\n  apple:\n    runs-on: macos-latest\n",
      template.replace("    runs-on: macos-latest", "    runs-on: macos-15"),
      template.replace("    runs-on: macos-latest", "    runs-on: ${{ inputs.runner }}"),
      template.replace("    runs-on: macos-latest", "    runs-on: macos-latest\n    runs-on: macos-latest"),
    ])
      expect(() => hostedIosRunnerTemplate(source, "macos-26-intel")).toThrow();
  });

  it("binds requested and effective environment metadata to actual workflow bytes", () => {
    const workflow = hostedIosRunnerTemplate(template, "macos-26-intel");
    const metadata = hostedIosRunnerMetadata("macos-26-intel", workflow);
    expect(metadata).toMatchObject({
      kind: "HOSTED_IOS_RUNNER_SELECTION_ONLY",
      requested: "macos-26-intel",
      effective: "macos-26-intel",
      jobs: ["apple", "apple-notice", "apple-presentation"],
      expectedArchitecture: "x64",
      actualEnvironmentObserved: false,
      workflowSha256: createHash("sha256").update(workflow).digest("hex"),
    });
    expect(metadata?.limits.join(" ")).toContain("prior ARM results cannot qualify Intel");
    expect(() => hostedIosRunnerMetadata("macos-26-intel", template)).toThrow(
      "LANDFALL_HOSTED_IOS_RUNNER_WORKFLOW_INVALID",
    );
    expect(
      hostedIosRunnerMetadata("macos-26", hostedIosRunnerTemplate(template, "macos-26"))?.expectedArchitecture,
    ).toBe("arm64");
  });

  it("accepts one explicit named option without positional placeholders", () => {
    const args = [candidate, "ios", "development", "gps-perfect-walk", "primary-phone"];
    expect(parseHostedLabArguments([...args, "--ios-runner", "macos-26-intel"])).toEqual({
      positional: args,
      iosRunner: "macos-26-intel",
    });
    expect(parseHostedLabArguments(["--ios-runner", "macos-26", ...args])).toEqual({
      positional: args,
      iosRunner: "macos-26",
    });
    for (const invalid of [
      [...args, "--ios-runner"],
      [...args, "--ios-runner", "unknown"],
      [...args, "--ios-runner", "macos-26", "--ios-runner", "macos-26-intel"],
      [...args, "--runner", "macos-26"],
      [...args, "--ios-runner=macos-26"],
      [candidate, "all", "--ios-runner", "macos-26"],
      [candidate, "ios", "development", "x", "y", "z", "extra"],
    ])
      expect(() => parseHostedLabArguments(invalid)).toThrow();
  });

  it("rejects invalid dispatcher overrides before tools, files or remote mutation", async () => {
    for (const [target, runner] of [
      ["android", "macos-26-intel"],
      ["all", "macos-26"],
      ["ios", "self-hosted"],
    ])
      await expect(
        dispatchLandfallHostedLab(
          candidate,
          process.cwd(),
          target,
          "development",
          undefined,
          undefined,
          undefined,
          runner,
        ),
      ).rejects.toThrow();
    expect(io.labTool).not.toHaveBeenCalled();
    expect(io.mkdir).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
    expect(io.rm).not.toHaveBeenCalled();
  });
});
