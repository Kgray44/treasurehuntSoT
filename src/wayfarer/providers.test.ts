import { afterEach, describe, expect, it } from "vitest";
import { decryptProviderToken, encryptProviderToken, listProviderAdapters, providerNames } from "@/wayfarer/providers";

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
  it("keeps Microsoft identity separate from partner-gated Xbox capability and lists the governed taxonomy", () => {
    expect(providerNames).toEqual(expect.arrayContaining(["STEAM", "MICROSOFT_ACCOUNT", "XBOX_NETWORK", "EA_ACCOUNT"]));
    const adapters = listProviderAdapters();
    expect(adapters.find((item) => item.provider === "XBOX_NETWORK")).toMatchObject({
      status: "PARTNER_GATED",
      login: false,
      link: false,
    });
    expect(adapters.find((item) => item.provider === "EA_ACCOUNT")).toMatchObject({
      status: "PARTNER_GATED",
      available: false,
    });
    expect(adapters.find((item) => item.provider === "MICROSOFT_ACCOUNT")).toMatchObject({
      protocol: "OAuth 2.0 / OpenID Connect",
      link: true,
    });
  });
});
