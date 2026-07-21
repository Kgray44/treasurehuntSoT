import { describe, expect, it } from "vitest";
import { authorizePlatform } from "@/platform/policy";

describe("Chronicle platform authorization policy", () => {
  it("does not treat role choice or anonymity as authorization", () => {
    expect(authorizePlatform({ kind: "anonymous" }, "PLAYER_LIBRARY_VIEW")).toBe(false);
    expect(authorizePlatform({ kind: "anonymous" }, "CAPTAIN_LIBRARY_VIEW")).toBe(false);
  });

  it("limits Players to their own playthrough resources", () => {
    const sera = { kind: "player" as const, playerId: "sera" };
    expect(authorizePlatform(sera, "PLAYER_LIBRARY_VIEW")).toBe(true);
    expect(authorizePlatform(sera, "PLAYTHROUGH_VIEW", { memberPlayerIds: ["sera"] })).toBe(true);
    expect(authorizePlatform(sera, "PLAYTHROUGH_ARCHIVE_VIEW", { memberPlayerIds: ["other"] })).toBe(false);
    expect(authorizePlatform(sera, "STUDIO_VIEW", { creatorId: "sera" })).toBe(false);
  });

  it("enforces staff capability and assignment scopes", () => {
    const captain = { kind: "staff" as const, accountId: "captain-a", capabilities: ["CAPTAIN"] };
    const creator = {
      kind: "staff" as const,
      accountId: "creator-a",
      capabilities: ["CREATE_TALES", "PUBLISH_TALES", "MANAGE_ASSETS"],
    };
    expect(authorizePlatform(captain, "PLAYTHROUGH_OPERATE_CAPTAIN", { assignedCaptainId: "captain-a" })).toBe(true);
    expect(authorizePlatform(captain, "PLAYTHROUGH_OPERATE_CAPTAIN", { assignedCaptainId: "captain-b" })).toBe(false);
    expect(authorizePlatform(captain, "STUDIO_EDIT", { creatorId: "captain-a" })).toBe(false);
    expect(authorizePlatform(creator, "STUDIO_PUBLISH", { creatorId: "creator-a" })).toBe(true);
    expect(authorizePlatform(creator, "STUDIO_EDIT", { creatorId: "creator-b" })).toBe(false);
    expect(authorizePlatform(creator, "ASSET_MANAGE")).toBe(true);
  });
});
