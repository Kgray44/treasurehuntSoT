import { describe, expect, it } from "vitest";
import { authorizeProtectedMediaDelivery, matchesProtectedMediaEtag } from "@/private-content/media/delivery";
import { withdrawProtectedDerivative } from "@/private-content/media/withdrawal";

const ready = { state: "READY" as const, scanState: "CLEAN", outputChecksum: "a".repeat(64) };
const grant = {
  state: "ACTIVE" as const,
  audience: "PUBLIC" as const,
  purpose: "VOYAGE_LOG_COMMUNITY" as const,
  authorizationRevision: "r1",
};

describe("protected media delivery", () => {
  it("uses bounded revocable public caching and rejects stale authority", () => {
    expect(
      authorizeProtectedMediaDelivery({ derivative: ready, grant, currentAuthorizationRevision: "r1" }),
    ).toMatchObject({ "Cache-Control": "public, max-age=60, must-revalidate", ETag: `\"${"a".repeat(64)}\"` });
    expect(() =>
      authorizeProtectedMediaDelivery({ derivative: ready, grant, currentAuthorizationRevision: "r2" }),
    ).toThrow(expect.objectContaining({ code: "PROTECTED_MEDIA_DELIVERY_FORBIDDEN" }));
    expect(matchesProtectedMediaEtag(`W/\"${"a".repeat(64)}\"`, "a".repeat(64))).toBe(true);
  });

  it("never lets a retry resurrect a withdrawn derivative", () => {
    expect(withdrawProtectedDerivative({ state: "READY", reason: "OWNER_WITHDRAWN" })).toMatchObject({
      state: "WITHDRAWN",
      idempotent: false,
    });
    expect(withdrawProtectedDerivative({ state: "WITHDRAWN", reason: "OWNER_WITHDRAWN" })).toMatchObject({
      state: "WITHDRAWN",
      idempotent: true,
    });
  });
});
