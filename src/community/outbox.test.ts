import { describe, expect, it } from "vitest";
import { communityOutboxBackoffMs, communityOutboxMaxBackoffMs } from "./outbox";

describe("Community outbox retry policy", () => {
  it("uses deterministic exponential bounded backoff", () => {
    expect(communityOutboxBackoffMs(1)).toBe(1_000);
    expect(communityOutboxBackoffMs(2)).toBe(2_000);
    expect(communityOutboxBackoffMs(3)).toBe(4_000);
    expect(communityOutboxBackoffMs(99)).toBe(communityOutboxMaxBackoffMs);
  });
});
