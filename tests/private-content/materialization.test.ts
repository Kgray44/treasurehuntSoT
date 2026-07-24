import { describe, expect, it } from "vitest";
import { sha256, type PrivatePayload } from "@/private-content/core";
import { buildPrivateMaterializationPlan } from "@/private-content/materialization";

function payload(contentType: "tale-draft" | "published-tale" | "tale-archive"): PrivatePayload {
  const draft = {
    autosaveVersion: 1,
    tale: { title: "Private North Star", slug: "private-north-star", visibility: "PRIVATE" },
    chapters: [
      {
        id: "chapter-01",
        title: "Opening",
        blocks: [
          {
            id: "block-0001",
            blockType: "narrative",
            title: "Start",
            configuration: { heading: "North Star", body: "A private beginning." },
          },
        ],
      },
    ],
  };
  const entry = Buffer.from(JSON.stringify(draft)).toString("base64url");
  return {
    manifest: {
      packageId: `materialization-${contentType}`,
      packageRevision: 1,
      formatVersion: 1,
      createdAt: "2026-07-22T00:00:00.000Z",
      sourceApplicationVersion: "0.2.0",
      minimumApplicationVersion: "0.2.0",
      classification: "private",
      contentType,
      tales: [
        {
          logicalId: "tale-01",
          slug: "private-north-star",
          title: "Private North Star",
          contentPath: "tales/tale.json",
        },
      ],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: Buffer.from(entry, "base64url").length },
    },
    entries: { "tales/tale.json": entry },
    checksums: { "tales/tale.json": sha256(Buffer.from(entry, "base64url")) },
  };
}

describe("canonical private materialization plans", () => {
  it.each(["tale-draft", "published-tale", "tale-archive"] as const)(
    "plans %s as deterministic canonical records",
    (contentType) => {
      const input = { importId: "import-fixed", payload: payload(contentType), ownerActorId: "creator-fixed" };
      const first = buildPrivateMaterializationPlan(input);
      const second = buildPrivateMaterializationPlan(input);
      expect(first.mappings).toEqual(second.mappings);
      expect(first.tales).toHaveLength(1);
      expect(first.mappings.map((mapping) => mapping.kind)).toContain("CHRONICLE");
      expect(first.mappings.map((mapping) => mapping.kind)).toContain("STORY_BLOCK");
      if (contentType === "published-tale") expect(first.tales[0]?.versionId).toEqual(expect.any(String));
      else expect(first.tales[0]?.versionId).toBeUndefined();
      if (contentType === "tale-archive")
        expect(first.warnings).toContain("Archive imported as private editable Chronicle drafts.");
    },
  );
  it("rejects an invalid Studio block before a transaction is opened", () => {
    const invalid = payload("tale-draft");
    const entry = JSON.parse(Buffer.from(invalid.entries["tales/tale.json"]!, "base64url").toString("utf8"));
    entry.chapters[0].blocks[0].blockType = "not-a-studio-block";
    invalid.entries["tales/tale.json"] = Buffer.from(JSON.stringify(entry)).toString("base64url");
    expect(() =>
      buildPrivateMaterializationPlan({ importId: "import-invalid", payload: invalid, ownerActorId: "creator" }),
    ).toThrow();
  });
});
