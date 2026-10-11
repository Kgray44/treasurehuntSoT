import { z } from "zod";
export const workspaceNames = ["SPATIAL", "CONSTRUCTION", "BEHAVIOR", "FOCUS"] as const;
export const workspaceLabels = {
  SPATIAL: "Spatial Editing",
  CONSTRUCTION: "Scene Construction",
  BEHAVIOR: "Behavior Authoring",
  FOCUS: "Focus / Immersive",
};
export const inspectorSections = [
  "overview",
  "placement",
  "transform",
  "appearance",
  "interactions",
  "behavior",
  "accessibility",
  "reuse",
  "engineering",
] as const;
export const workspaceLayoutSchema = z.strictObject({
  schemaVersion: z.literal(1),
  preset: z.enum(workspaceNames),
  libraryOpen: z.boolean(),
  inspectorOpen: z.boolean(),
  bottomOpen: z.boolean(),
  libraryWidth: z.number().int().min(210).max(420),
  inspectorWidth: z.number().int().min(210).max(420),
  bottomHeight: z.number().int().min(160).max(460),
  leftTab: z.enum(["ASSETS", "HIERARCHY", "SAVED"]),
  bottomTab: z.enum(["TIMELINE", "SIMULATION", "DIAGNOSTICS", "EVENTS"]),
  expandedInspector: z.array(z.enum(inspectorSections)).max(inspectorSections.length),
  assistantDocked: z.boolean(),
});
export type WorkspaceLayout = z.infer<typeof workspaceLayoutSchema>;
export function workspacePreset(preset: WorkspaceLayout["preset"], previous?: WorkspaceLayout): WorkspaceLayout {
  const layout: WorkspaceLayout = previous
    ? { ...previous, preset }
    : {
        schemaVersion: 1,
        preset,
        libraryOpen: false,
        inspectorOpen: true,
        bottomOpen: false,
        libraryWidth: 252,
        inspectorWidth: 292,
        bottomHeight: 260,
        leftTab: "ASSETS",
        bottomTab: "TIMELINE",
        expandedInspector: ["overview"],
        assistantDocked: false,
      };
  return {
    ...layout,
    libraryOpen: preset === "CONSTRUCTION",
    inspectorOpen: preset !== "FOCUS",
    bottomOpen: preset === "BEHAVIOR",
    bottomTab: preset === "BEHAVIOR" ? "TIMELINE" : layout.bottomTab,
    expandedInspector:
      preset === "BEHAVIOR" ? ["behavior"] : preset === "CONSTRUCTION" ? ["overview", "transform"] : ["overview"],
  };
}
export function readWorkspaceLayout(raw: string | null): WorkspaceLayout {
  try {
    return workspaceLayoutSchema.parse(JSON.parse(raw ?? "null"));
  } catch {
    return workspacePreset("SPATIAL");
  }
}
