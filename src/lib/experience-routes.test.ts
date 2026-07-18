import { describe, expect, it } from "vitest";
import {
  experienceSectionFromPath,
  experienceSectionHref,
  experienceSections,
  isExperienceSection,
} from "@/lib/experience-routes";

describe("Experience routes", () => {
  it("defines the four stable top-level sections", () => {
    expect(experienceSections).toEqual(["chapters", "map", "artifacts", "messages"]);
    expect(experienceSections.every(isExperienceSection)).toBe(true);
    expect(isExperienceSection("settings")).toBe(false);
  });

  it("reads the section from active and historical URLs and defaults safely", () => {
    expect(experienceSectionFromPath("/play/tale/session/id/map")).toBe("map");
    expect(experienceSectionFromPath("/player/playthroughs/id/journal/messages")).toBe("messages");
    expect(experienceSectionFromPath("/player/playthroughs/id/journal")).toBe("chapters");
  });

  it("normalizes a trailing slash when building section links", () => {
    expect(experienceSectionHref("/play/tale/session/id/", "artifacts")).toBe("/play/tale/session/id/artifacts");
  });
});
