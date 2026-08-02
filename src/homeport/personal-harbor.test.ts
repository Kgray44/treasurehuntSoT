import { describe, expect, it } from "vitest";
import {
  personalHarborNavigation,
  personalHarborSectionIds,
} from "@/homeport/personal-harbor-navigation";
import { accountDataAvailability } from "@/homeport/personal-harbor";
import { preferenceV1Schema, defaultPreferences } from "@/wayfarer/profile";

describe("Homeport Phase 3 Personal Harbor contracts", () => {
  it("homeport.personal-harbor.ia gives every ordinary section one unique canonical destination", () => {
    const items: Array<readonly [string, string, string]> = [];
    for (const group of personalHarborNavigation) items.push(...group.items);
    expect(new Set(items.map(([id]) => id)).size).toBe(items.length);
    expect(new Set(items.map(([, , href]) => href)).size).toBe(items.length);
    expect(items.map(([id]) => id)).toEqual(personalHarborSectionIds);
    expect(items.every(([, , href]) => href.startsWith("/") && !href.includes("#"))).toBe(true);
  });

  it("homeport.account-data.truthful-availability never gives unsupported operations a decorative destination", () => {
    const operations = accountDataAvailability().operations;
    expect(operations.filter((operation) => operation.status === "NOT_CURRENTLY_SUPPORTED"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "export", href: null }),
        expect.objectContaining({ id: "deactivate", href: null }),
        expect.objectContaining({ id: "delete", href: null }),
      ]));
    expect(operations.filter((operation) => operation.status === "AVAILABLE").every((operation) => operation.href)).toBe(true);
  });

  it("homeport.preferences.typed rejects unknown root and nested keys", () => {
    expect(() => preferenceV1Schema.parse({ ...defaultPreferences, testControl: true })).toThrow();
    expect(() =>
      preferenceV1Schema.parse({
        ...defaultPreferences,
        experience: { ...defaultPreferences.experience, simulatorMode: true },
      }),
    ).toThrow();
  });
});
