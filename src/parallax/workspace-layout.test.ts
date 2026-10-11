import { expect, it } from "vitest";
import { readWorkspaceLayout, workspacePreset } from "./workspace-layout";
it("restores a known-good layout when stored state is corrupted or unbounded", () => {
  expect(readWorkspaceLayout("invalid")).toEqual(workspacePreset("SPATIAL"));
  expect(readWorkspaceLayout(JSON.stringify({ ...workspacePreset("SPATIAL"), bottomHeight: 90000 }))).toEqual(
    workspacePreset("SPATIAL"),
  );
});
it("switches presentation layouts while retaining bounded dock preferences", () => {
  const custom = {
    ...workspacePreset("CONSTRUCTION"),
    libraryWidth: 310,
    inspectorWidth: 270,
    bottomHeight: 340,
    leftTab: "HIERARCHY" as const,
  };
  const focus = workspacePreset("FOCUS", custom);
  expect(focus).toMatchObject({
    libraryOpen: false,
    inspectorOpen: false,
    bottomOpen: false,
    libraryWidth: 310,
    leftTab: "HIERARCHY",
  });
  expect(workspacePreset("BEHAVIOR", focus)).toMatchObject({
    bottomOpen: true,
    bottomHeight: 340,
    bottomTab: "TIMELINE",
  });
  expect(JSON.stringify(focus)).not.toMatch(/definitionId|entities|revision|content/);
});
