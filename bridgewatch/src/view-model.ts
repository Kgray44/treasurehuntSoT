import type { ProjectState } from "./domain.js";

export type ProjectTab = "ACTIVE" | "COMPLETED" | "PLANNED" | "ALL";
export interface ProjectListItem { state: ProjectState }

export function projectInTab(project: ProjectListItem, tab: ProjectTab): boolean {
  if (tab === "ALL") return true;
  if (tab === "COMPLETED") return project.state === "COMPLETE" || project.state === "MERGED";
  if (tab === "PLANNED") return project.state === "PLANNED";
  return !["COMPLETE", "MERGED", "PLANNED"].includes(project.state);
}

export function durationBetween(startedAt: string | null, completedAt: string | null, now = Date.now()): string {
  if (!startedAt) return "UNMEASURED";
  const end = completedAt ? Date.parse(completedAt) : now;
  const milliseconds = Math.max(0, end - Date.parse(startedAt));
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
