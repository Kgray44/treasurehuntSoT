import { describe, expect, it } from "vitest";
import { addCollectionItemInputSchema, createCollectionInputSchema, reorderCollectionInputSchema } from "./contract";

describe("Community collection mutation contracts", () => {
  it("accepts only the bounded collection creation fields", () => {
    expect(createCollectionInputSchema.parse({ slug: "indoor-adventures", title: "Indoor Adventures", visibility: "PRIVATE" })).toMatchObject({ slug: "indoor-adventures" });
    expect(() => createCollectionInputSchema.parse({ slug: "Indoor Adventures", title: "Unsafe" })).toThrow();
    expect(() => createCollectionInputSchema.parse({ slug: "safe-list", title: "Safe", ownerAccountId: "forged" })).toThrow();
  });

  it("does not permit arbitrary collection item types", () => {
    expect(addCollectionItemInputSchema.parse({ subjectType: "GUIDE", subjectId: "guide_1" })).toEqual({ subjectType: "GUIDE", subjectId: "guide_1" });
    expect(() => addCollectionItemInputSchema.parse({ subjectType: "TALE_SESSION", subjectId: "session_1" })).toThrow();
  });

  it("requires a non-duplicated bounded order and server revision token", () => {
    expect(reorderCollectionInputSchema.parse({ orderedItemIds: ["item_1", "item_2"], expectedUpdatedAt: "2026-07-25T12:00:00.000Z" })).toMatchObject({ orderedItemIds: ["item_1", "item_2"] });
    expect(() => reorderCollectionInputSchema.parse({ orderedItemIds: ["item_1", "item_1"], expectedUpdatedAt: "2026-07-25T12:00:00.000Z" })).toThrow("unique");
  });
});
