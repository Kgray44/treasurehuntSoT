import { describe, expect, it } from "vitest";
import { nativeLandfallNoticeTouch } from "./native-notice-control";
// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence
const row =
  '<node package="com.android.systemui" enabled="true" text="Your journey may be nearby" bounds="[40,200][600,260]">';
describe("actual public native notice targeting", () => {
  it("uses the observed notice bounds", () => {
    expect(nativeLandfallNoticeTouch(`<hierarchy>${row}</node></hierarchy>`)).toEqual({ x: 320, y: 230 });
  });
  it("rejects foreign apps and ambiguous notices", () => {
    expect(() => nativeLandfallNoticeTouch(row.replace("com.android.systemui", "com.example.other"))).toThrow(
      "UNOBSERVED",
    );
    expect(() => nativeLandfallNoticeTouch(row + row)).toThrow("AMBIGUOUS");
  });
  it("rejects clipped or invalid geometry and disabled controls", () => {
    for (const bounds of ["[0,0][0,260]", "[0,0][5000,260]", "[-1,0][600,260]"])
      expect(() => nativeLandfallNoticeTouch(row.replace("[40,200][600,260]", bounds))).toThrow("BOUNDS");
    expect(() => nativeLandfallNoticeTouch(row.replace('enabled="true"', 'enabled="false"'))).toThrow("UNOBSERVED");
  });
});
