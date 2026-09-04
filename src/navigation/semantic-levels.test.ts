import { describe, expect, it } from "vitest";
import { navigationSemanticLevels, semanticLevelForNavigationLayer } from "./semantic-levels";

describe("Brightwork navigation semantic levels", () => {
  it("maps the legacy shell layers without collapsing contextual recovery into product navigation", () => {
    expect(semanticLevelForNavigationLayer("GLOBAL")).toBe(navigationSemanticLevels.global);
    expect(semanticLevelForNavigationLayer("ACCOUNT")).toBe(navigationSemanticLevels.global);
    expect(semanticLevelForNavigationLayer("WORKSPACE")).toBe(navigationSemanticLevels.product);
    expect(semanticLevelForNavigationLayer("CONTEXTUAL")).toBe(navigationSemanticLevels.contextual);
    expect(Object.values(navigationSemanticLevels)).toEqual([
      "GLOBAL",
      "PRODUCT",
      "SECTION",
      "CONTEXTUAL",
      "LONG_PAGE",
    ]);
  });
});
