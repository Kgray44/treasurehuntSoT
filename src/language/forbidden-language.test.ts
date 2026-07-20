import { describe, expect, it } from "vitest";
import { scanLanguageText } from "./forbidden-language";

describe("forbidden-language", () => {
  it("reports inherited terminology and generic failure copy in visible text", () => {
    const violations = scanLanguageText(
      '<button aria-label="Open Tall Tale">Start campaign</button>\n<p>Something went wrong</p>',
      "src/components/Example.tsx",
    );

    expect(violations.map((violation) => violation.pattern)).toEqual(
      expect.arrayContaining(["Tall Tale", "campaign", "start campaign", "Something went wrong"]),
    );
  });

  it("does not mistake technical identifiers for product copy", () => {
    expect(scanLanguageText("const campaignId = response.campaignId;", "src/app/api/example/route.ts")).toEqual([]);
  });

  it("requires a precise, owned, review-dated exception", () => {
    const text = "<p>Campaign history</p>";
    const exception = {
      pattern: "campaign",
      file: "src/components/History.tsx",
      reason: "Imported legal title",
      owner: "Product",
      reviewDate: "2027-07-20",
    } as const;

    expect(scanLanguageText(text, exception.file, [exception])).toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: "campaign history" })]),
    );
    expect(scanLanguageText("<p>Campaign</p>", exception.file, [exception])).toEqual([]);
  });
});
