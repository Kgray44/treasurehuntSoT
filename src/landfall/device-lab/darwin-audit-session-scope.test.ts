import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchLandfallHostedLab } from "../../../scripts/landfall/device-lab/hosted";
import { labTool } from "../../../scripts/landfall/device-lab/host";

vi.mock("../../../scripts/landfall/device-lab/host", () => ({ labTool: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(() => {
    throw new Error("WORKFLOW_CAPTURED_WITHOUT_PUBLICATION");
  }),
  rm: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("Darwin audit-session primitive admission", () => {
  it("rejects qualification and all caller overrides before external operations", async () => {
    for (const [tier, scenario, profile] of [
      ["candidate", undefined, undefined],
      ["closure", undefined, undefined],
      ["development", "", undefined],
      ["development", "gps-perfect-walk", undefined],
      ["development", undefined, ""],
      ["development", undefined, "primary-phone"],
    ]) {
      await expect(
        dispatchLandfallHostedLab("a".repeat(40), process.cwd(), "darwin-audit-session", tier, scenario, profile),
      ).rejects.toThrow("LANDFALL_HOSTED_DARWIN_AUDIT_SESSION_SCOPE_INVALID");
    }
    expect(labTool).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each(["all", "darwin-audit-session"])("keeps the finite probe isolated when selecting %s", async (target) => {
    const template = readFileSync(".agents/landfall-device-lab-hosted.yml", "utf8");
    vi.mocked(labTool).mockResolvedValueOnce("").mockResolvedValueOnce(template);
    await expect(dispatchLandfallHostedLab("a".repeat(40), process.cwd(), target)).rejects.toThrow(
      "WORKFLOW_CAPTURED_WITHOUT_PUBLICATION",
    );
    expect(labTool).toHaveBeenCalledTimes(2);
    const workflow = String(vi.mocked(writeFile).mock.calls[0][1]).replaceAll("\r\n", "\n");
    const probe = workflow.split("  browser:")[0];
    expect(probe).toContain(`  darwin-audit-session:\n    if: ${target === "darwin-audit-session"}`);
    expect(probe).toContain("    runs-on: macos-15\n    timeout-minutes: 5");
    expect(workflow).not.toMatch(/__RUN_[A-Z_]+__/);
    if (target === "darwin-audit-session") {
      expect(workflow.match(/^    if: true$/gm)).toHaveLength(1);
      expect(probe).not.toContain("npm ci");
      expect(probe).toContain("clang -Wall -Wextra -Werror");
    }
  });
});
