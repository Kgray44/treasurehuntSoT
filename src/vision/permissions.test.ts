import { describe, expect, it } from "vitest";
import { capabilityForVisionPermission, visionPermissions } from "@/vision/permissions";

describe("Vision permission mapping", () => {
  it("defines every required logical permission and maps publication separately from ordinary edits", () => {
    expect(visionPermissions).toEqual([
      "visionWaypoint.create",
      "visionWaypoint.read",
      "visionWaypoint.editDraft",
      "visionWaypoint.publish",
      "visionWaypoint.deprecate",
      "visionWaypoint.bindToStory",
      "visionWaypoint.viewDiagnostics",
      "visionWaypoint.administer",
    ]);
    expect(capabilityForVisionPermission("visionWaypoint.editDraft")).toBe("CREATE_TALES");
    expect(capabilityForVisionPermission("visionWaypoint.publish")).toBe("PUBLISH_TALES");
    expect(capabilityForVisionPermission("visionWaypoint.viewDiagnostics")).toBe("CAPTAIN");
  });
});
