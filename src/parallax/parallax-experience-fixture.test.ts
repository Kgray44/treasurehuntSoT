import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { prepareParallaxExperienceAccounts } from "../../tests/e2e/fixtures/parallax-experience";

afterEach(() => vi.unstubAllEnvs());

describe("privileged synthetic experience fixtures", () => {
  it.each([
    ["FOREVER_VALIDATION_ISOLATION", ""],
    ["SOUNDING_LINE_SUITE_PROFILE", "oauth"],
    ["FOREVER_VALIDATION_NONCE_HASH", "invalid"],
    ["DATABASE_URL", "file:./prisma/dev.db"],
    ["DATABASE_URL", `file:${path.resolve("prisma/dev.db")}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/real.db")}`],
    [
      "DATABASE_URL",
      `file:${path.resolve("artifacts/sounding-line-elsewhere/validation-isolated-20261011-123456789-" + "a".repeat(32) + ".db")}`,
    ],
  ])("refuses %s=%s before touching the database", async (name, value) => {
    vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "1");
    vi.stubEnv("SOUNDING_LINE_SUITE_PROFILE", "generic");
    vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "b".repeat(64));
    vi.stubEnv(
      "DATABASE_URL",
      `file:${path.resolve("artifacts/sounding-line/generic-owned/validation-isolated-20261011-123456789-" + "a".repeat(32) + ".db")}`,
    );
    vi.stubEnv(name, value);
    const access = vi.fn();
    const store = new Proxy({}, { get: access }) as PrismaClient;
    await expect(prepareParallaxExperienceAccounts(store)).rejects.toThrow(
      "PARALLAX_EXPERIENCE_OWNED_FIXTURE_REQUIRED",
    );
    expect(access).not.toHaveBeenCalled();
  });
});
