import type { ProjectDefinition } from "./types.js";

// Registry entries identify observation targets. They do not assert completion.
export const projectRegistry: readonly ProjectDefinition[] = [
  {
    id: "bridgewatch",
    name: "Project Bridgewatch",
    repository: "forever-treasure/forever-treasure-companion",
    phase: "Phase 1 — Raise the Board",
    state: "ACTIVE",
    recordPath: "Development_Docs/Project_Bridgewatch_Phase_1_Design_Record.md",
  },
  {
    id: "admiralty",
    name: "Project Admiralty",
    repository: "forever-treasure/forever-treasure-companion",
    phase: "Recorded phase state",
    state: "UNKNOWN",
    recordPath: "Development_Docs/Projects/Project Admiralty",
  },
  {
    id: "drydock",
    name: "Project Drydock",
    repository: "forever-treasure/forever-treasure-companion",
    phase: "Recorded phase state",
    state: "UNKNOWN",
    recordPath: "Development_Docs/Projects/Project Drydock",
  },
  {
    id: "tideglass",
    name: "Project Tideglass",
    repository: "forever-treasure/forever-treasure-companion",
    phase: "Recorded phase state",
    state: "UNKNOWN",
    recordPath: "Development_Docs/Projects/Project Tideglass",
  },
  {
    id: "helm",
    name: "Project Helm",
    repository: "forever-treasure/forever-treasure-companion",
    phase: "Recorded phase state",
    state: "UNKNOWN",
    recordPath: "Development_Docs/Projects/Project Helm",
  },
  {
    id: "wakebook",
    name: "Project Wakebook",
    repository: "forever-treasure/forever-treasure-companion",
    phase: "Recorded phase state",
    state: "UNKNOWN",
    recordPath: "Development_Docs/Projects/Project Wakebook",
  },
];

export function findProject(id: string): ProjectDefinition | undefined {
  return projectRegistry.find((project) => project.id === id);
}
