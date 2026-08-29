import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSoundingLineFixtureDatabase } from "../../tests/admiralty/phase3/ensure-sounding-line-fixture";

const root = path.resolve("fixture-root");
const genericEnvironment = {
  SOUNDING_LINE_SUITE_PROFILE: "generic",
  FOREVER_VALIDATION_ISOLATION: "1",
  FOREVER_VALIDATION_NONCE_HASH: "a".repeat(64),
};

describe("isSoundingLineFixtureDatabase", () => {
  it("admits the legacy candidate-owned root fixture", () => {
    expect(
      isSoundingLineFixtureDatabase({
        root,
        databasePath: path.join(root, ".sounding-line-0123456789ab.sqlite"),
        environment: {},
      }),
    ).toBe(true);
  });

  it("admits only the trusted generic validation-isolation fixture", () => {
    const databasePath = path.join(
      root,
      "artifacts",
      "sounding-line",
      "generic-0123456789ab",
      `validation-isolated-19700101-000000000-${"b".repeat(32)}.db`,
    );
    expect(isSoundingLineFixtureDatabase({ root, databasePath, environment: genericEnvironment })).toBe(true);
    expect(
      isSoundingLineFixtureDatabase({
        root,
        databasePath,
        environment: { ...genericEnvironment, FOREVER_VALIDATION_NONCE_HASH: "not-a-nonce" },
      }),
    ).toBe(false);
  });

  it("refuses a database outside the task root", () => {
    expect(() =>
      isSoundingLineFixtureDatabase({
        root,
        databasePath: path.resolve(root, "..", "outside.sqlite"),
        environment: genericEnvironment,
      }),
    ).toThrow("ADMIRALTY_SOUNDING_LINE_DATABASE_REFUSED");
  });
});
