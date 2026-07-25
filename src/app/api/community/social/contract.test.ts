import { describe, expect, it } from "vitest";
import { blockInputSchema, creatorProfileInputSchema, followInputSchema, saveInputSchema } from "./contract";

describe("Community social mutation contracts", () => {
  it("accepts only the server-selected follow identifier", () => {
    expect(followInputSchema.parse({ creatorProfileId: "creator_1" })).toEqual({ creatorProfileId: "creator_1" });
    expect(() => followInputSchema.parse({ creatorProfileId: "creator_1", accountId: "forged" })).toThrow();
  });

  it("does not allow a client to supply an actor account", () => {
    expect(blockInputSchema.parse({ accountId: "target_1" })).toEqual({ accountId: "target_1" });
    expect(() => blockInputSchema.parse({ accountId: "target_1", actorId: "forged" })).toThrow();
  });

  it("resolves Creator blocking from a profile identifier rather than exposing an account identifier", () => {
    expect(creatorProfileInputSchema.parse({ creatorProfileId: "creator_1" })).toEqual({ creatorProfileId: "creator_1" });
    expect(() => creatorProfileInputSchema.parse({ creatorProfileId: "creator_1", accountId: "forged" })).toThrow();
  });

  it("uses the finite persisted subject vocabulary for saves and favorites", () => {
    expect(saveInputSchema.parse({ subjectType: "LISTING", subjectId: "listing_1" })).toEqual({ subjectType: "LISTING", subjectId: "listing_1" });
    expect(() => saveInputSchema.parse({ subjectType: "PRIVATE_SESSION", subjectId: "session_1" })).toThrow();
  });
});
