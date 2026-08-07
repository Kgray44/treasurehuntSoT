import { describe, expect, it } from "vitest";
import { assessPassword } from "./password-policy";

describe("Project Homeport password policy", () => {
  it.each([
    ["short", "TOO_WEAK", false],
    ["abcdefghijkl", "WEAK", false],
    ["harbor-quiet-42-wind", "GOOD", true],
    ["harbor-quiet-42-wind-across", "STRONG", true],
  ] as const)("classifies %s as %s", (password, level, acceptable) => {
    expect(assessPassword(password)).toMatchObject({ level, acceptable });
  });

  it("rejects common passwords and identity similarity without requiring arbitrary character classes", () => {
    expect(assessPassword("password1234")).toMatchObject({ acceptable: false, message: /commonly used/iu });
    expect(
      assessPassword("mara-harbor-passphrase", {
        email: "mara@example.test",
        displayName: "Mara Tide",
      }),
    ).toMatchObject({ acceptable: false, message: /email or display name/iu });
    expect(assessPassword("lantern harbor compass weather")).toMatchObject({ acceptable: true });
  });
});
