import { afterEach, describe, expect, it } from "vitest";
import { decryptProviderToken, encryptProviderToken, listProviderAdapters } from "@/wayfarer/providers";

describe("Wayfarer provider token boundary", () => {
  const original = process.env.WAYFARER_PROVIDER_TOKEN_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.WAYFARER_PROVIDER_TOKEN_KEY;
    else process.env.WAYFARER_PROVIDER_TOKEN_KEY = original;
  });
  it("encrypts a provider token rather than retaining plaintext", () => {
    process.env.WAYFARER_PROVIDER_TOKEN_KEY = "test-key-not-a-provider-secret";
    const encrypted = encryptProviderToken("provider-access-token");
    expect(encrypted).not.toContain("provider-access-token");
    expect(decryptProviderToken(encrypted)).toBe("provider-access-token");
  });
  it("reports simulator and external adapter configuration truthfully", () => {
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
    delete process.env.DISCORD_REDIRECT_URI;
    expect(listProviderAdapters()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "DISCORD", available: false }),
        expect.objectContaining({ provider: "DISCORD_SIMULATOR" }),
      ]),
    );
  });
});
