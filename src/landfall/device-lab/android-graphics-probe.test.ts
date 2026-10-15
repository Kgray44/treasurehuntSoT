// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  androidGraphicsProbeBackend,
  androidGraphicsProbeMetadata,
  androidGraphicsProbeTemplate,
  readAndroidGraphicsProbe,
  validateAndroidGraphicsProbeTransport,
} from "../../../scripts/landfall/device-lab/android-graphics-probe";
import { dispatchLandfallHostedLab } from "../../../scripts/landfall/device-lab/hosted";

const io = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn(), rm: vi.fn(), labTool: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: io.mkdir, writeFile: io.writeFile, rm: io.rm }));
vi.mock("../../../scripts/landfall/device-lab/host", () => ({ labTool: io.labTool }));

const workflowPath = ".github/workflows/landfall-device-lab.yml";
const ordinaryTemplate = readFileSync(path.join(process.cwd(), ".agents/landfall-device-lab-hosted.yml"), "utf8");
// The explicit comparison reproduces the historical direct-SwiftShader candidate.
const template = ordinaryTemplate.replace("-gpu swangle ", "-gpu swiftshader ");
const comparison = androidGraphicsProbeTemplate(template, "swangle");
const probe = androidGraphicsProbeMetadata("swangle", comparison)!;
const readProbe = (value: unknown) => readAndroidGraphicsProbe(value, "android", "development", ["primary-phone"]);

describe("development-only Android graphics comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves every default template byte and metadata shape unchanged", () => {
    expect(androidGraphicsProbeTemplate(ordinaryTemplate, undefined)).toBe(ordinaryTemplate);
    expect(androidGraphicsProbeMetadata(undefined, ordinaryTemplate)).toBeUndefined();
    expect(() =>
      validateAndroidGraphicsProbeTransport(undefined, ordinaryTemplate, ordinaryTemplate, []),
    ).not.toThrow();
    expect(androidGraphicsProbeTemplate(template, undefined)).toBe(template);
    expect(androidGraphicsProbeTemplate(template.replaceAll("\n", "\r\n"), undefined)).toBe(
      template.replaceAll("\n", "\r\n"),
    );
    expect(androidGraphicsProbeMetadata(undefined, template)).toBeUndefined();
    expect(androidGraphicsProbeBackend(undefined, "all", "closure", ["tablet"])).toBeUndefined();
    expect({
      version: 1,
      ...(androidGraphicsProbeMetadata(undefined, template) ? { graphicsProbe: probe } : {}),
    }).toEqual({ version: 1 });
    expect(() => validateAndroidGraphicsProbeTransport(undefined, template, template, [])).not.toThrow();
    const legacy = template.replace("-gpu swiftshader ", "-gpu swiftshader_indirect ");
    expect(() => validateAndroidGraphicsProbeTransport(undefined, legacy, legacy, [])).not.toThrow();
    for (const old of ["jobs:\n  ios:\n    runs-on: macos-latest\n", template.replace("-gpu swiftshader ", "")]) {
      expect(() => validateAndroidGraphicsProbeTransport(undefined, old, old, [])).not.toThrow();
      expect(() => validateAndroidGraphicsProbeTransport(undefined, old, template, [])).not.toThrow();
    }
  });

  it("allows only explicit swangle on development Android with one primary-phone", () => {
    expect(androidGraphicsProbeBackend("swangle", "android", "development", ["primary-phone"])).toBe("swangle");
    for (const backend of ["", "swiftshader", "host", "swangle;echo", null, 1, {}])
      expect(() => androidGraphicsProbeBackend(backend, "android", "development", ["primary-phone"])).toThrow();
    for (const target of [
      "all",
      "provider",
      "browser",
      "ios",
      "android-radio",
      "android-background",
      "android-journal",
    ])
      expect(() => androidGraphicsProbeBackend("swangle", target, "development", ["primary-phone"])).toThrow();
    for (const tier of ["candidate", "closure", "unknown"])
      expect(() => androidGraphicsProbeBackend("swangle", "android", tier, ["primary-phone"])).toThrow();
    for (const profiles of [
      [],
      ["primary-phone", "primary-phone"],
      ["primary-phone", "tablet"],
      ["low-resource"],
      null,
      "primary-phone",
    ])
      expect(() => androidGraphicsProbeBackend("swangle", "android", "development", profiles)).toThrow();
  });

  it("changes exactly one main Android argument and preserves other jobs/scripts", () => {
    expect(comparison).not.toBe(template);
    expect(comparison.replace("-gpu swangle ", "-gpu swiftshader ")).toBe(template);
    expect((comparison.match(/-gpu swangle(?=\s)/g) ?? []).length).toBe(1);
    const start = template.indexOf("  android-radio:");
    expect(comparison.slice(comparison.indexOf("  android-radio:"))).toBe(template.slice(start));
    expect(androidGraphicsProbeTemplate(template.replaceAll("\n", "\r\n"), "swangle")).toBe(
      comparison.replaceAll("\n", "\r\n"),
    );
  });

  it("fails on missing, ambiguous, or already changed candidate seams", () => {
    for (const value of [
      template.replace("  android:\n", "  android-other:\n"),
      template + "\n  android:\n    emulator-options: -gpu swiftshader\n",
      template.replace("-gpu swiftshader ", ""),
      template.replace("-gpu swiftshader ", "-gpu swiftshader -gpu host "),
      template.replace("-gpu swiftshader ", "-gpu swangle "),
      template.replace("-gpu swiftshader ", "-gpu swiftshader_indirect "),
    ])
      expect(() => androidGraphicsProbeTemplate(value, "swangle")).toThrow();
  });

  it("requires strict non-authoritative metadata and scope at harvest", () => {
    expect(readProbe(probe)).toEqual(probe);
    expect(probe.authoritative).toBe(false);
    for (const value of [
      null,
      [],
      {},
      { ...probe, authoritative: true },
      { ...probe, extra: 1 },
      { ...probe, backend: undefined },
      { ...probe, backend: "host" },
      { ...probe, workflowSha256: "A".repeat(64) },
      { ...probe, kind: "ORDINARY" },
    ])
      expect(() => readProbe(value)).toThrow();
    expect(() => readAndroidGraphicsProbe(probe, "ios", "development", ["primary-phone"])).toThrow();
    expect(() => readAndroidGraphicsProbe(probe, "android", "closure", ["primary-phone"])).toThrow();
    expect(() => readAndroidGraphicsProbe(probe, "android", "development", ["primary-phone", "tablet"])).toThrow();
  });

  it("binds the immutable workflow hash/backend and permits only a workflow transport delta", () => {
    expect(() => validateAndroidGraphicsProbeTransport(probe, template, comparison, [workflowPath])).not.toThrow();
    for (const changed of [[], [workflowPath, "native/android/app/build.gradle"], ["src/parallax/native.ts"]])
      expect(() => validateAndroidGraphicsProbeTransport(probe, template, comparison, changed)).toThrow();
    expect(() =>
      validateAndroidGraphicsProbeTransport(probe, template, comparison + "\n# tampered\n", [workflowPath]),
    ).toThrow();
    expect(() =>
      validateAndroidGraphicsProbeTransport(probe, template, comparison.replace("-gpu swangle ", "-gpu host "), [
        workflowPath,
      ]),
    ).toThrow();
    expect(() =>
      validateAndroidGraphicsProbeTransport({ ...probe, workflowSha256: "0".repeat(64) }, template, comparison, [
        workflowPath,
      ]),
    ).toThrow();
    expect(() => validateAndroidGraphicsProbeTransport(undefined, template, comparison, [])).toThrow(
      "LANDFALL_HOSTED_GRAPHICS_METADATA_MISSING",
    );
    for (const backend of ["host", "lavapipe"])
      expect(() =>
        validateAndroidGraphicsProbeTransport(
          undefined,
          template,
          comparison.replace("-gpu swangle ", `-gpu ${backend} `),
          [],
        ),
      ).toThrow("LANDFALL_HOSTED_GRAPHICS_METADATA_MISSING");
  });

  it("rejects invalid explicit options before artifact writes or external git operations", async () => {
    const candidate = "a".repeat(40);
    for (const [target, tier, backend] of [
      ["android", "closure", "swangle"],
      ["ios", "development", "swangle"],
      ["android", "development", "host"],
    ])
      await expect(
        dispatchLandfallHostedLab(candidate, "unused-owned-root", target, tier, undefined, "primary-phone", backend),
      ).rejects.toThrow();
    expect(io.mkdir).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
    expect(io.labTool).not.toHaveBeenCalled();
  });
});
