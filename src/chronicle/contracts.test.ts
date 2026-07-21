import { describe, expect, it } from "vitest";
import { verificationSubmissionSchema } from "@/chronicle/progression";
import { slugify, slugSchema, studioDraftSchema } from "@/chronicle/studio-service";

const observation = {
  schemaVersion: 1,
  eventId: "event-12345678",
  idempotencyKey: "device-1-request-1-frame-40",
  eventType: "verification.result",
  providerType: "visionLocation",
  providerInstanceId: "development-helper",
  sessionId: "session-12345678",
  publishedVersionId: "version-12345678",
  blockId: "block-12345678",
  verificationRequestId: "request-12345678",
  observedAt: "2026-07-17T20:00:00.000Z",
  result: "match",
  confidence: 0.972,
  evidence: { consecutivePassingFrames: 4, windowFrames: 6 },
};

describe("Chronicle Studio contracts", () => {
  it("normalizes durable public slugs", () => {
    expect(slugify("  The Captain's Moon & Map  ")).toBe("the-captain-s-moon-map");
    expect(slugSchema.safeParse("the-captain-s-moon-map").success).toBe(true);
    expect(slugSchema.safeParse("Array Index 4").success).toBe(false);
  });

  it("requires every identity needed to reject stale or cross-session helper evidence", () => {
    expect(verificationSubmissionSchema.safeParse(observation).success).toBe(true);
    const withoutBlock: Partial<typeof observation> = { ...observation };
    delete withoutBlock.blockId;
    expect(verificationSubmissionSchema.safeParse(withoutBlock).success).toBe(false);
  });

  it("bounds confidence and versions the helper event schema", () => {
    expect(verificationSubmissionSchema.safeParse({ ...observation, confidence: 1.1 }).success).toBe(false);
    expect(verificationSubmissionSchema.safeParse({ ...observation, schemaVersion: 2 }).success).toBe(false);
  });

  it("rejects a stale autosave token shape before persistence", () => {
    const draft = {
      autosaveVersion: 0,
      tale: { title: "Test", slug: "test-tale" },
      chapters: [],
    };
    expect(studioDraftSchema.safeParse(draft).success).toBe(false);
    expect(studioDraftSchema.safeParse({ ...draft, autosaveVersion: 1 }).success).toBe(true);
  });
});
