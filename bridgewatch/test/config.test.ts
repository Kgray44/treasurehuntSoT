import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses safe private defaults", () => {
    const config = loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository" });
    expect(config.BRIDGEWATCH_HOST).toBe("127.0.0.1");
    expect(config.BRIDGEWATCH_GITHUB_API).toBe("https://api.github.com");
  });

  it("rejects malformed repository and non-HTTPS API configuration", () => {
    expect(() => loadConfig({ BRIDGEWATCH_REPOSITORY: "not a repository" })).toThrow("owner/repository");
    expect(() => loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository", BRIDGEWATCH_GITHUB_API: "http://example.test" })).toThrow("HTTPS");
  });
});
