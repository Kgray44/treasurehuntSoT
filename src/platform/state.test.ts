import { describe, expect, it } from "vitest";
import {
  assertMembershipTransition,
  assertPlaythroughTransition,
  canTransitionMembership,
  canTransitionPlaythrough,
  invitationUsable,
} from "@/platform/state";

describe("Chronicle platform state machines", () => {
  it("allows only declared playthrough transitions", () => {
    expect(canTransitionPlaythrough("INVITING", "READY")).toBe(true);
    expect(canTransitionPlaythrough("READY", "ACTIVE")).toBe(true);
    expect(canTransitionPlaythrough("COMPLETED", "ACTIVE")).toBe(false);
    expect(() => assertPlaythroughTransition("CANCELLED", "ACTIVE")).toThrow(/cannot transition/i);
  });

  it("keeps membership removal and completion terminal", () => {
    expect(canTransitionMembership("INVITED", "ACCEPTED")).toBe(true);
    expect(canTransitionMembership("READY", "ACTIVE_MEMBER")).toBe(true);
    expect(canTransitionMembership("REMOVED", "READY")).toBe(false);
    expect(() => assertMembershipTransition("COMPLETED_MEMBER", "REMOVED")).toThrow(/cannot transition/i);
  });

  it("requires a pending, unexpired, unconsumed invitation", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(invitationUsable("VIEWED", future, 0, 1)).toBe(true);
    expect(invitationUsable("VIEWED", past, 0, 1)).toBe(false);
    expect(invitationUsable("ACCEPTED", future, 0, 1)).toBe(false);
    expect(invitationUsable("VIEWED", future, 1, 1)).toBe(false);
  });
});
