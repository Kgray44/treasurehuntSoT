import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { taleDraft: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } } }));

import { getDraftLandfallDefinition, saveDraftLandfallDefinition } from "@/landfall/definition-store";
import { landfallFixture } from "@/landfall/fixtures";

describe("Landfall draft persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: "draft-1",
      autosaveVersion: 3,
      landfallDefinition: JSON.stringify(landfallFixture),
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("reads the latest validated definition without changing an edition", async () => {
    expect((await getDraftLandfallDefinition("fixture-tale")).definition).toEqual(landfallFixture);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taleId: "fixture-tale" }, orderBy: { revisionNumber: "desc" } }),
    );
  });

  it("stores validated definition with optimistic version and invalidates old readiness", async () => {
    const saved = await saveDraftLandfallDefinition("fixture-tale", landfallFixture, 3);
    expect(saved.autosaveVersion).toBe(4);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "draft-1", autosaveVersion: 3 },
      data: {
        landfallDefinition: JSON.stringify(landfallFixture),
        autosaveVersion: { increment: 1 },
        validationState: "NOT_VALIDATED",
        validationSummary: "{}",
        lastValidatedAt: null,
      },
    });
  });

  it("rejects a stale save and a definition for another Chronicle", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(saveDraftLandfallDefinition("fixture-tale", landfallFixture, 2)).rejects.toThrow();
    await expect(saveDraftLandfallDefinition("other-tale", landfallFixture, 3)).rejects.toThrow(
      "LANDFALL_TALE_MISMATCH",
    );
  });
});
