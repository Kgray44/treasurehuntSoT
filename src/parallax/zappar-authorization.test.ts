import { expect, it } from "vitest";
import { admitZapparAuthorization } from "./zappar-authorization";

const record = {
  schemaVersion: 1,
  sdkVersion: "4.4.0",
  ownerAuthorized: true,
  activeEntitlement: "TRIAL",
  expiresAt: "2026-10-30T00:00:00Z",
  termsAcceptedByOwner: true,
  domainAuthorization: "VENDOR_TEST_EXEMPTION",
  permittedOrigins: ["https://192.168.0.24:3441"],
  scriptSha256: "a".repeat(64),
};
const now = Date.parse("2026-10-15T12:00:00Z");
it("requires an unexpired owner-authorized entitlement for the exact secure origin", () => {
  expect(admitZapparAuthorization(record, record.permittedOrigins[0], now)?.sdkVersion).toBe("4.4.0");
  for (const origin of ["http://192.168.0.24:3441", "https://192.168.0.24:3442", "https://unlicensed.example"]) {
    expect(admitZapparAuthorization(record, origin, now)).toBeNull();
  }
  expect(admitZapparAuthorization(record, record.permittedOrigins[0], Date.parse(record.expiresAt))).toBeNull();
  for (const patch of [
    { ownerAuthorized: false },
    { termsAcceptedByOwner: false },
    { sdkVersion: "latest" },
    { activeEntitlement: "NONE" },
  ]) {
    expect(admitZapparAuthorization({ ...record, ...patch }, record.permittedOrigins[0], now)).toBeNull();
  }
});
it("rejects malformed records and origin entries with paths or wildcard assumptions", () => {
  expect(admitZapparAuthorization(null, record.permittedOrigins[0], now)).toBeNull();
  expect(
    admitZapparAuthorization(
      { ...record, permittedOrigins: [record.permittedOrigins[0] + "/test"] },
      record.permittedOrigins[0],
      now,
    ),
  ).toBeNull();
  expect(admitZapparAuthorization(record, "not an origin", now)).toBeNull();
});
it("does not mistake a trial or a tunnel HTTPS certificate for a registered self-hosting license", () => {
  const tunnel = "https://private-preview.trycloudflare.com";
  const input = { ...record, permittedOrigins: [tunnel] };
  expect(admitZapparAuthorization(input, tunnel, now)).toBeNull();
  expect(
    admitZapparAuthorization({ ...input, domainAuthorization: "REGISTERED_SELF_HOSTING" }, tunnel, now),
  ).toBeNull();
  expect(
    admitZapparAuthorization(
      { ...input, domainAuthorization: "REGISTERED_SELF_HOSTING", activeEntitlement: "COMMERCIAL" },
      tunnel,
      now,
    ),
  ).not.toBeNull();
});
