import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses safe private defaults", () => {
    const config = loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository" });
    expect(config.BRIDGEWATCH_HOST).toBe("127.0.0.1");
    expect(config.BRIDGEWATCH_GITHUB_API).toBe("https://api.github.com");
    expect(config.BRIDGEWATCH_EVENT_RETENTION_DAYS).toBe(30);
    expect(config.BRIDGEWATCH_ROLLUP_RETENTION_DAYS).toBe(90);
  });

  it("rejects malformed repository and non-HTTPS API configuration", () => {
    expect(() => loadConfig({ BRIDGEWATCH_REPOSITORY: "not a repository" })).toThrow("owner/repository");
    expect(() =>
      loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository", BRIDGEWATCH_GITHUB_API: "http://example.test" }),
    ).toThrow("HTTPS");
  });

  it("makes external hosting an explicit, authenticated deployment decision", () => {
    expect(() => loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository", BRIDGEWATCH_HOST: "0.0.0.0" })).toThrow(
      "ALLOW_EXTERNAL",
    );
    expect(() =>
      loadConfig({
        BRIDGEWATCH_REPOSITORY: "owner/repository",
        BRIDGEWATCH_HOST: "0.0.0.0",
        BRIDGEWATCH_ALLOW_EXTERNAL: "true",
      }),
    ).toThrow("authentication");
    expect(() =>
      loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository", BRIDGEWATCH_DASHBOARD_USERNAME: "operator" }),
    ).toThrow("both username and password");
    expect(
      loadConfig({
        BRIDGEWATCH_REPOSITORY: "owner/repository",
        BRIDGEWATCH_HOST: "0.0.0.0",
        BRIDGEWATCH_ALLOW_EXTERNAL: "true",
        BRIDGEWATCH_DASHBOARD_USERNAME: "operator",
        BRIDGEWATCH_DASHBOARD_PASSWORD: "not-a-real-secret",
      }).BRIDGEWATCH_HOST,
    ).toBe("0.0.0.0");
  });

  it("bounds Phase 3 historical and branch-health tuning without making it secret configuration", () => {
    expect(() =>
      loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository", BRIDGEWATCH_EVENT_RETENTION_DAYS: "0" }),
    ).toThrow("positive integer");
    expect(() =>
      loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository", BRIDGEWATCH_HISTORY_PAGE_SIZE: "1000" }),
    ).toThrow("governed bounds");
    expect(
      loadConfig({
        BRIDGEWATCH_REPOSITORY: "owner/repository",
        BRIDGEWATCH_BRANCH_BEHIND_THRESHOLD: "12",
      }).BRIDGEWATCH_BRANCH_BEHIND_THRESHOLD,
    ).toBe(12);
  });

  it("accepts an optional external GitHub App read configuration without requiring an App for local development", () => {
    const configured = loadConfig({
      BRIDGEWATCH_REPOSITORY: "owner/repository",
      BRIDGEWATCH_GITHUB_APP_ID: "12345",
      BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID: "67890",
      BRIDGEWATCH_GITHUB_APP_PRIVATE_KEY_PATH: "C:\\secure\\fixture-app.pem",
    });
    expect(configured.BRIDGEWATCH_GITHUB_APP_ID).toBe("12345");
    expect(configured.BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID).toBe("67890");
    expect(configured.BRIDGEWATCH_GITHUB_APP_PRIVATE_KEY_PATH).toContain("fixture-app.pem");
    expect(() =>
      loadConfig({
        BRIDGEWATCH_REPOSITORY: "owner/repository",
        BRIDGEWATCH_GITHUB_APP_ID: "12345",
      }),
    ).toThrow("requires App ID");
    expect(() =>
      loadConfig({
        BRIDGEWATCH_REPOSITORY: "owner/repository",
        BRIDGEWATCH_GITHUB_APP_ID: "12345",
        BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID: "67890",
        BRIDGEWATCH_GITHUB_APP_PRIVATE_KEY_PATH: "relative-key.pem",
      }),
    ).toThrow("must be absolute");
  });

  it("keeps percentage thresholds ordered per GitHub credential resource", () => {
    expect(
      loadConfig({
        BRIDGEWATCH_REPOSITORY: "owner/repository",
        BRIDGEWATCH_GITHUB_CONSERVATION_RATIO: "0.4",
        BRIDGEWATCH_GITHUB_CRITICAL_RATIO: "0.2",
      }).BRIDGEWATCH_GITHUB_CONSERVATION_RATIO,
    ).toBe(0.4);
    expect(() =>
      loadConfig({
        BRIDGEWATCH_REPOSITORY: "owner/repository",
        BRIDGEWATCH_GITHUB_CONSERVATION_RATIO: "0.1",
        BRIDGEWATCH_GITHUB_CRITICAL_RATIO: "0.2",
      }),
    ).toThrow("critical ratio");
  });
});
