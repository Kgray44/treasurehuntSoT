// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { admitEighthwallAuthorization, readEighthwallAsset, eighthwallAvailability } from "./eighthwall-local-assets";
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
const approval = {
  schemaVersion: 1,
  sdkVersion: "1.0.0",
  ownerAuthorized: true,
  purpose: "PRIVATE_APPLICATION_EVALUATION",
  licenseAcceptedByOwner: true,
  independentResearchExcluded: true,
  expiresAt: "2099-01-01T00:00:00Z",
  permittedOrigins: ["http://127.0.0.1:3292", "https://private.example.test"],
};
afterEach(() => {
  vi.clearAllMocks();
});
it("requires exact private application authorization and secure or loopback origin", () => {
  for (const origin of approval.permittedOrigins) expect(admitEighthwallAuthorization(approval, origin)).toBe(true);
  for (const patch of [
    { ownerAuthorized: false },
    { licenseAcceptedByOwner: false },
    { independentResearchExcluded: false },
    { purpose: "PRODUCTION" },
    { expiresAt: "2020-01-01T00:00:00Z" },
    { sdkVersion: "latest" },
  ]) {
    expect(admitEighthwallAuthorization({ ...approval, ...patch }, approval.permittedOrigins[0])).toBe(false);
  }
  for (const origin of ["http://192.168.0.24:3292", "https://other.example.test", "http://127.0.0.1:3293"]) {
    expect(admitEighthwallAuthorization(approval, origin)).toBe(false);
  }
});
it("rejects unknown paths without reading private authorization or SDK bytes", async () => {
  expect(await readEighthwallAsset("../../authorization.private.json", approval.permittedOrigins[0])).toBeNull();
  expect(await readEighthwallAsset("xr-face.js", approval.permittedOrigins[0])).toBeNull();
  expect(readFile).not.toHaveBeenCalled();
});
it("rejects missing approval and altered vendor bytes instead of claiming readiness", async () => {
  vi.mocked(readFile).mockRejectedValue(new Error("missing"));
  expect(await eighthwallAvailability(approval.permittedOrigins[0])).toBeNull();
  vi.mocked(readFile).mockImplementation(async (path) =>
    String(path).endsWith("authorization.private.json")
      ? JSON.stringify(approval)
      : Buffer.from("not the original vendor distribution"),
  );
  expect(await eighthwallAvailability(approval.permittedOrigins[0])).toBeNull();
});
