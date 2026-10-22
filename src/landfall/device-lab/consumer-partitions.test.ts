import { describe, expect, it, vi } from "vitest";
import { sextantConsumerPartition } from "../../../scripts/landfall/device-lab/consumer-partitions";
import { dispatchLandfallHostedLab } from "../../../scripts/landfall/device-lab/hosted";

const sourceLookup = vi.hoisted(() => vi.fn());
vi.mock("../../../scripts/landfall/device-lab/host", () => ({ labTool: sourceLookup }));

describe("fixed Sextant consumer development partitions", () => {
  const targets = ["sextant-consumer-pages", "sextant-contextual-entry"];
  const candidate = "a".repeat(40);

  it("covers each original complete spec once without changing the combined selector", () => {
    expect(targets.flatMap((target) => sextantConsumerPartition(target)?.tests)).toEqual([
      "tests/e2e/sextant-consumer-journeys.spec.ts",
      "tests/e2e/sextant-contextual-entry-journeys.spec.ts",
    ]);
    expect(targets.flatMap((target) => sextantConsumerPartition(target)?.scenarios)).toEqual([
      "sextant-consumer-journeys",
      "sextant-contextual-entry-journeys",
    ]);
    for (const target of ["sextant-consumers", "sextant-consumer-pages:1", "unknown", "", "../tests"])
      expect(sextantConsumerPartition(target)).toBeNull();
  });

  it.each(targets)("refuses broader tiers and caller-selected scope before any source lookup: %s", async (target) => {
    sourceLookup.mockClear();
    for (const tier of ["candidate", "closure"])
      await expect(dispatchLandfallHostedLab(candidate, undefined, target, tier)).rejects.toThrow(
        "LANDFALL_HOSTED_SEXTANT_CONSUMERS_SCOPE_INVALID",
      );
    await expect(dispatchLandfallHostedLab(candidate, undefined, target, "development", "any-case")).rejects.toThrow(
      "LANDFALL_HOSTED_SEXTANT_CONSUMERS_SCOPE_INVALID",
    );
    await expect(
      dispatchLandfallHostedLab(candidate, undefined, target, "development", undefined, "primary-phone"),
    ).rejects.toThrow("LANDFALL_HOSTED_PROFILE_TARGET_REQUIRED");
    expect(sourceLookup).not.toHaveBeenCalled();
  });

  it.each(targets)(
    "allows only its fixed development route to reach canonical source verification: %s",
    async (target) => {
      sourceLookup.mockClear();
      sourceLookup.mockRejectedValueOnce(new Error("SOURCE_LOOKUP_REACHED"));
      await expect(dispatchLandfallHostedLab(candidate, undefined, target, "development")).rejects.toThrow(
        "SOURCE_LOOKUP_REACHED",
      );
      expect(sourceLookup).toHaveBeenCalledExactlyOnceWith("git", ["cat-file", "-e", `${candidate}^{commit}`]);
    },
  );
});
