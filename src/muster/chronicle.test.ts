import type { Chronicle } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { musterChronicleIdentity } from "./chronicle";

const draft = {
  title: "Unpublished revision",
  subtitle: "Draft subtitle",
  shortDescription: "Draft description",
  estimatedDuration: 999,
  coverAssetId: "draft-cover",
} as Chronicle;
const edition = (tale: object) => ({ contentSnapshot: JSON.stringify({ schemaVersion: 1, chapters: [], tale }) });

describe("Muster published Chronicle identity", () => {
  it("uses the selected edition even when the working Chronicle has newer values", () => {
    const published = {
      title: "The Tidal Observatory",
      subtitle: "Follow the stars",
      shortDescription: "Signals at dusk",
      estimatedDuration: 95,
      coverAssetId: "edition-cover",
    };
    expect(musterChronicleIdentity({ tale: draft, version: edition(published) })).toEqual(published);
  });
  it("preserves absent optional edition fields instead of leaking draft values", () => {
    const published = {
      title: "The Quiet Shore",
      subtitle: null,
      shortDescription: null,
      estimatedDuration: null,
      coverAssetId: null,
    };
    expect(musterChronicleIdentity({ tale: draft, version: edition(published) })).toEqual(published);
  });
  it("uses the canonical Chronicle only for a Voyage with no published edition", () => {
    expect(musterChronicleIdentity({ tale: draft, version: null })).toBe(draft);
  });
});
