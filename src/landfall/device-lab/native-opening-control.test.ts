import { describe, expect, it } from "vitest";
import { nativeJournalOpeningTouch } from "./native-opening-control";
describe("native public synthetic opening touch", () => {
  const node =
    '<node package="com.voyagewright.landfall" class="android.widget.Button" clickable="true" enabled="true" text="Open the journal Begin Voyage" bounds="[100,200][300,400]" />';
  it("derives one normal OS touch from the observed enabled source control", () =>
    expect(nativeJournalOpeningTouch(node)).toEqual({ x: 200, y: 300 }));
  it("fails closed on foreign packages, unrelated controls, disabled or ambiguous targets", () => {
    for (const xml of [
      node.replace("com.voyagewright.landfall", "foreign.app"),
      node.replace("Open the journal", "Confirm arrival"),
      node.replace('enabled="true"', 'enabled="false"'),
      node + node,
    ])
      expect(() => nativeJournalOpeningTouch(xml)).toThrow("NATIVE_OPENING_CONTROL_UNOBSERVED_OR_AMBIGUOUS");
  });
  it("rejects missing, inverted or unbounded geometry and large raw hierarchies", () => {
    for (const xml of [
      node.replace('bounds="[100,200][300,400]"', ""),
      node.replace("[100,200][300,400]", "[300,400][100,200]"),
      node.replace("[100,200][300,400]", "[100,200][5000,6000]"),
      "x".repeat(262145),
    ])
      expect(() => nativeJournalOpeningTouch(xml)).toThrow();
  });
});
