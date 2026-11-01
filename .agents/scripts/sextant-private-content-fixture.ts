/** Pure synthetic archive preparation, after the canonical owned database guard. */
import { makePayload } from "../../src/private-content/package";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";

const cases = [
  "private-content-default",
  "private-content-1280-no-preference",
  "private-content-1280-reduce",
  "private-content-390-no-preference",
  "private-content-390-reduce",
] as const;
export async function seedSextantPrivateContentExperience(key: (typeof cases)[number] = "private-content-default") {
  if (!cases.includes(key)) throw new Error("SEXTANT_PRIVATE_CONTENT_CASE_INVALID");
  const fixture = await seedSextantResourceExperiences(key);
  const title = `Synthetic Sextant protected course ${key}`;
  const slug = `sextant-protected-${key}`;
  const packageId = `sextant-package-${key}`;
  const draft = {
    autosaveVersion: 1,
    tale: { title, slug, visibility: "PRIVATE" },
    chapters: [
      {
        id: "synthetic-chapter-01",
        title: "Synthetic protected opening",
        blocks: [
          {
            id: "synthetic-block-01",
            blockType: "narrative",
            title: "Synthetic protected passage",
            configuration: { heading: "Synthetic package only", body: "A reserved synthetic package passage." },
          },
        ],
      },
    ],
  };
  const content = Buffer.from(JSON.stringify(draft));
  const payload = makePayload({
    manifest: {
      packageId,
      packageRevision: 1,
      formatVersion: 1,
      createdAt: "2026-10-19T00:00:00.000Z",
      sourceApplicationVersion: "0.2.0",
      minimumApplicationVersion: "0.2.0",
      classification: "private",
      contentType: "tale-draft",
      tales: [{ logicalId: "synthetic-tale-01", slug, title, contentPath: "tales/synthetic.json" }],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: content.length },
    },
    entries: { "tales/synthetic.json": content.toString("base64url") },
  });
  return { ...fixture, title, slug, packageId, payload };
}
