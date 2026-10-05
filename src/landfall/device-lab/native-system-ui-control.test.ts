import { describe, expect, it } from "vitest";
import { nativeSystemUiWaitTouch } from "./native-system-ui-control";

describe("owned Android System UI recovery", () => {
  const title = '<node package="android" text="System UI isn&apos;t responding" />';
  const wait =
    '<node package="android" text="Wait" resource-id="android:id/aerr_wait" clickable="true" enabled="true" bounds="[100,200][400,300]" />';
  it("maps only the actual bounded enabled System UI Wait control", () => {
    expect(nativeSystemUiWaitTouch(title + wait)).toEqual({ x: 250, y: 250 });
    expect(nativeSystemUiWaitTouch(title.replace("android", "com.android.systemui") + wait)).toEqual({
      x: 250,
      y: 250,
    });
  });
  it("does not dismiss a product ANR, foreign dialog or unrelated Wait button", () => {
    expect(nativeSystemUiWaitTouch(title.replace("System UI", "Landfall") + wait)).toBeNull();
    expect(nativeSystemUiWaitTouch(title.replace("android", "foreign.app") + wait)).toBeNull();
    expect(nativeSystemUiWaitTouch(wait)).toBeNull();
    expect(nativeSystemUiWaitTouch(title + title + wait)).toBeNull();
  });
  it("rejects ambiguous, disabled, spoofed or invalid bounds", () => {
    for (const control of [
      wait + wait,
      wait.replace('enabled="true"', 'enabled="false"'),
      wait.replace("android:id/aerr_wait", "foreign:id/wait"),
      wait.replace("[400,300]", "[5000,300]"),
      wait.replace("[400,300]", "[100,200]"),
    ])
      expect(() => nativeSystemUiWaitTouch(title + control)).toThrow();
  });
});
