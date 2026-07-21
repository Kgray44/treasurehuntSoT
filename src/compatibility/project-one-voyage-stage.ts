export const projectOneVoyageStages = [
  "B_MIGRATION_TOOLING",
  "C_SHADOW_READS",
  "D_CANONICAL_READS",
  "E_CANONICAL_WRITES",
  "F_COMPATIBILITY_ONLY",
] as const;

export type ProjectOneVoyageStage = (typeof projectOneVoyageStages)[number];

// A deployed process must never silently fall back to legacy business state.
// Operators may still select B/C/D for an isolated rehearsal, but canonical
// reads and writes are the safe production default after Project One Voyage.
const defaultStage: ProjectOneVoyageStage = "F_COMPATIBILITY_ONLY";

export function projectOneVoyageStage(value = process.env.PROJECT_ONE_VOYAGE_STAGE): ProjectOneVoyageStage {
  if (!value) return defaultStage;
  if ((projectOneVoyageStages as readonly string[]).includes(value)) return value as ProjectOneVoyageStage;
  throw new Error(`PROJECT_ONE_VOYAGE_STAGE must be one of ${projectOneVoyageStages.join(", ")}.`);
}

export function canonicalReadsEnabled(stage = projectOneVoyageStage()) {
  return ["D_CANONICAL_READS", "E_CANONICAL_WRITES", "F_COMPATIBILITY_ONLY"].includes(stage);
}

export function canonicalWritesEnabled(stage = projectOneVoyageStage()) {
  return ["E_CANONICAL_WRITES", "F_COMPATIBILITY_ONLY"].includes(stage);
}
