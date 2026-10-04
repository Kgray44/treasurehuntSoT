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
  const webview =
    '<node package="com.voyagewright.landfall" class="android.webkit.WebView" enabled="true" bounds="[0,100][1080,1900]" />';
  const observedDom = {
    box: { x: 100, y: 200, width: 160, height: 40 },
    viewport: { width: 360, height: 600, scale: 1 },
  };
  it("maps an actually visible DOM control inside one observed native WebView", () =>
    expect(nativeJournalOpeningTouch(webview, observedDom)).toEqual({ x: 540, y: 760 }));
  it("rejects foreign or ambiguous WebViews and clipped, zoomed or mismatched viewport mappings", () => {
    for (const xml of [webview.replace("com.voyagewright.landfall", "foreign.app"), webview + webview])
      expect(() => nativeJournalOpeningTouch(xml, observedDom)).toThrow();
    for (const dom of [
      { ...observedDom, box: { ...observedDom.box, y: 590 } },
      { ...observedDom, viewport: { ...observedDom.viewport, scale: 2 } },
      { ...observedDom, viewport: { ...observedDom.viewport, height: 500 } },
      { ...observedDom, box: { ...observedDom.box, x: NaN } },
    ])
      expect(() => nativeJournalOpeningTouch(webview, dom)).toThrow();
  });
});
