import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalPublicAppOrigin, PublicAppOriginError, publicAppUrl } from "./public-app-origin";

describe("canonical public application origin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("builds application redirects from the configured staging origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://staging.absoluterelativesystems.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");

    expect(canonicalPublicAppOrigin().toString()).toBe("https://staging.absoluterelativesystems.com/");
    expect(publicAppUrl("/?signedInWith=github").toString()).toBe(
      "https://staging.absoluterelativesystems.com/?signedInWith=github",
    );
  });

  it.each(["http://0.0.0.0:3000", "http://[::]:3000"])("rejects bind-only browser origins: %s", (origin) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", origin);
    expect(() => canonicalPublicAppOrigin()).toThrow(PublicAppOriginError);
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.1.2.3:3000",
    "http://172.20.0.5:3000",
    "http://192.168.1.10:3000",
    "http://oauth-service:3000",
    "https://proxy.example.internal",
  ])("rejects loopback, private, and internal production origins: %s", (origin) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", origin);
    expect(() => canonicalPublicAppOrigin()).toThrow(PublicAppOriginError);
  });

  it("allows an explicitly configured local browser origin outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "http://localhost:3217");
    expect(publicAppUrl("/passport").toString()).toBe("http://localhost:3217/passport");
  });

  it("fails closed without an explicit production origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(() => canonicalPublicAppOrigin()).toThrow(PublicAppOriginError);
  });

  it.each([
    "https://staging.absoluterelativesystems.com/unexpected",
    "https://user:password@staging.absoluterelativesystems.com",
    "https://staging.absoluterelativesystems.com?unexpected=1",
  ])("rejects configured values that are not exact origins: %s", (origin) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", origin);
    expect(() => canonicalPublicAppOrigin()).toThrow(PublicAppOriginError);
  });

  it("rejects absolute and protocol-relative application destinations", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://staging.absoluterelativesystems.com");
    expect(() => publicAppUrl("https://attacker.example/path")).toThrow(PublicAppOriginError);
    expect(() => publicAppUrl("//attacker.example/path")).toThrow(PublicAppOriginError);
  });
});
