import { describe, expect, it } from "vitest";
import { durationBetween, projectInTab } from "../src/view-model.js";

describe("project library views", () => {
  it("keeps completed, active, planned, and all views distinct", () => {
    expect(projectInTab({ state: "ACTIVE" }, "ACTIVE")).toBe(true);
    expect(projectInTab({ state: "COMPLETE" }, "COMPLETED")).toBe(true);
    expect(projectInTab({ state: "PLANNED" }, "PLANNED")).toBe(true);
    expect(projectInTab({ state: "BLOCKED" }, "ACTIVE")).toBe(true);
    expect(projectInTab({ state: "COMPLETE" }, "ACTIVE")).toBe(false);
  });

  it("separates queue and execution durations without inventing a value", () => {
    expect(durationBetween(null, null)).toBe("UNMEASURED");
    expect(durationBetween("2026-08-12T00:00:00.000Z", "2026-08-12T00:12:10.000Z")).toBe("12m 10s");
  });
});
