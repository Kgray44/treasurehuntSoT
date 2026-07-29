import { describe, expect, it } from "vitest";

import { commentInputSchema, reportInputSchema } from "./contract";

describe("Community comment and report contracts", () => {
  it("limits comments to governed subjects and refuses executable input", () => {
    expect(
      commentInputSchema.parse({
        subjectType: "GUIDE",
        subjectId: "guide_1",
        body: "This walkthrough was clear and useful.",
        idempotencyKey: "comment_123",
      }),
    ).toMatchObject({ subjectType: "GUIDE" });
    expect(() =>
      commentInputSchema.parse({
        subjectType: "CREATOR",
        subjectId: "creator_1",
        body: "Direct message attempt",
        idempotencyKey: "comment_123",
      }),
    ).toThrow();
    expect(() =>
      commentInputSchema.parse({
        subjectType: "GUIDE",
        subjectId: "guide_1",
        body: "[unsafe](javascript:alert(1))",
        idempotencyKey: "comment_123",
      }),
    ).toThrow();
  });

  it("accepts only durable report targets and never a forged reporter", () => {
    expect(
      reportInputSchema.parse({ subjectType: "REVIEW", subjectId: "review_1", reason: "Spoiler was not marked." }),
    ).toMatchObject({ subjectType: "REVIEW" });
    expect(() =>
      reportInputSchema.parse({ subjectType: "TALE_SESSION", subjectId: "session_1", reason: "private" }),
    ).toThrow();
    expect(() =>
      reportInputSchema.parse({
        subjectType: "GUIDE",
        subjectId: "guide_1",
        reason: "unsafe",
        reporterAccountId: "forged",
      }),
    ).toThrow();
  });
});
