import { describe, expect, it } from "vitest";
import { ADMIRALTY_OPERATIONAL_STATES, boundedPage, boundedQuery, projection, safeMetadata } from "./read-models";

describe("Admiralty Phase 2 read-model contracts", () => {
  it("publishes the governed status vocabulary and evidence metadata", () => {
    expect(ADMIRALTY_OPERATIONAL_STATES).toContain("NOT_LIVE_VALIDATED");
    expect(ADMIRALTY_OPERATIONAL_STATES).toContain("EXTERNAL_PENDING");
    const result = projection("OwnerAdminReadPort", { count: 1 }, { observedAt: new Date("2026-08-09T12:00:00Z") });
    expect(result).toMatchObject({ state: "HEALTHY", evidence: { source: "OwnerAdminReadPort", freshness: "LIVE" } });
  });

  it("bounds search and pagination instead of permitting enumeration", () => {
    expect(boundedQuery("a")).toBe("");
    expect(boundedQuery("  known-account  ")).toBe("known-account");
    expect(boundedQuery("x".repeat(200))).toHaveLength(96);
    expect(boundedPage("999")).toBe(50);
  });

  it("removes credential, token, private prose, and payload keys from technical metadata", () => {
    const result = safeMetadata(
      JSON.stringify({
        method: "OAuth",
        token: "forbidden",
        csrfToken: "forbidden",
        privateNote: "forbidden",
        payload: "forbidden",
        nested: { outcome: "successful", secret: "forbidden" },
      }),
    );
    expect(result).toEqual({ method: "OAuth", nested: { outcome: "successful" } });
    expect(JSON.stringify(result)).not.toMatch(/forbidden|token|secret|private|payload/iu);
  });
});
