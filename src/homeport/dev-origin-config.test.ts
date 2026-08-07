import { describe, expect, it } from "vitest";
import { homeportAllowedDevOrigins } from "./dev-origin-config";

describe("Homeport development-origin configuration", () => {
  it("authorizes only the governed loopback and staging hosts by default", () => {
    expect(homeportAllowedDevOrigins("")).toEqual(["127.0.0.1", "staging.absoluterelativesystems.com"]);
  });

  it("adds exact LAN and reverse-proxy hosts without duplicates", () => {
    expect(homeportAllowedDevOrigins("192.168.0.24, Staging.Homeport.Test,192.168.0.24")).toEqual([
      "127.0.0.1",
      "staging.absoluterelativesystems.com",
      "192.168.0.24",
      "staging.homeport.test",
    ]);
  });

  it.each(["*", "*.example.test", "https://example.test", "example.test:3000", "example.test/path", "bad..host"])(
    "rejects broad or malformed origin %s",
    (origin) => expect(() => homeportAllowedDevOrigins(origin)).toThrow(/exact hostnames|invalid hostname/u),
  );
});
