import { describe, expect, it } from "vitest";
import { themeBootstrapScript } from "./theme-bootstrap";

describe("homeport.owner-correction.round2.theme-bootstrap", () => {
  it("resolves System before hydration and accepts only governed preference values", () => {
    expect(themeBootstrapScript).toContain('localStorage.getItem("voyagewright-theme-bootstrap-v1")');
    expect(themeBootstrapScript).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(themeBootstrapScript).toContain("root.dataset.voyageTheme");
    expect(themeBootstrapScript).toContain('["SYSTEM", "LIGHT", "DARK", "HIGH_CONTRAST"]');
  });
});
