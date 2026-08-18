import { describe, expect, it } from "vitest";
import { documentedDiscoveryPaths, parseReadOnlyGitRefs } from "../src/repository-evidence.js";

describe("bounded repository evidence collection", () => {
  it("selects current machine-indexed engineering records without OCRing archives or arbitrary files", () => {
    expect(
      documentedDiscoveryPaths({
        records: [
          {
            path: "Development_Docs/Project_Bridgewatch_v1.2_Mission_Control_Realization_Design_Record.md",
            record_type: "design-record",
            status: "current",
          },
          {
            path: "Development_Docs/Archive/obsolete.pdf",
            record_type: "archived-history",
            status: "archived",
          },
          { path: "README.md", record_type: "guide", status: "current" },
          { path: "Development_Docs/Programs/Deepwater/status.json", record_type: "status", status: "current" },
        ],
      }),
    ).toEqual([
      "Development_Docs/Project_Bridgewatch_v1.2_Mission_Control_Realization_Design_Record.md",
      "Development_Docs/Programs/Deepwater/status.json",
    ]);
  });

  it("parses only fixed read-only Git ref output and retains branch SHA evidence", () => {
    expect(
      parseReadOnlyGitRefs(
        "codex/project-bridgewatch-v1.2-mission-control\tabcdef123456\norigin/main\t123456abcdef\nmalformed\n",
      ),
    ).toEqual([
      { name: "codex/project-bridgewatch-v1.2-mission-control", headSha: "abcdef123456" },
      { name: "origin/main", headSha: "123456abcdef" },
    ]);
  });
});
