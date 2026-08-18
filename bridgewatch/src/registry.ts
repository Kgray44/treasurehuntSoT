import type { PhaseRecord, ProjectRecord, ProjectState } from "./domain.js";

const currentRepository = "Kgray44/treasurehuntSoT";
const phase = (
  projectId: string,
  ordinal: number,
  name: string,
  state: ProjectState,
  evidence: string,
  options: Partial<PhaseRecord> = {},
): PhaseRecord => ({
  id: `${projectId}-p${ordinal}`,
  ordinal,
  name,
  scope: "Recorded governed scope; inspect the linked evidence for the complete contract.",
  state,
  // A record proves lifecycle evidence, not a governed milestone denominator.
  // Keep progress UNMEASURED until its actual weighted obligations are known.
  milestones: [],
  ...options,
});

const record = (
  id: string,
  name: string,
  state: ProjectState,
  source: string,
  phases: PhaseRecord[],
  options: Partial<ProjectRecord> = {},
): ProjectRecord => ({
  id,
  name,
  repository: currentRepository,
  state,
  governingReferences: [source],
  sourcePaths: [source],
  confidence: state === "UNKNOWN" ? "LOW" : "HIGH",
  phases,
  ...options,
});

// This registry is a source-indexed backfill, not a lifecycle inference engine.
// COMPLETE is used only where an accepted completion record explicitly says so.
export const projectRegistry: readonly ProjectRecord[] = [
  record(
    "bridgewatch",
    "Project Bridgewatch",
    "COMPLETE",
    "Development_Docs/Project_Bridgewatch_Completion_Receipt.md",
    [
      phase(
        "bridgewatch",
        1,
        "Raise the Board",
        "MERGED",
        "Development_Docs/Project_Bridgewatch_Phase_1_Design_Record.md",
        {
          mergedAt: "2026-08-12T01:27:54.000Z",
          completedAt: "2026-08-12T01:27:54.000Z",
          integratedMainSha: "0bd33e03efd1deaafe4ab33fe365c7c0c75ba0b4",
          branch: "codex/project-bridgewatch-phase1-raise-the-board",
        },
      ),
      phase(
        "bridgewatch",
        2,
        "Wire the Signals",
        "COMPLETE",
        "Development_Docs/Project_Bridgewatch_Phase_2_Design_Record.md",
        {
          branch: "codex/project-bridgewatch-phase2-wire-the-signals",
          pullRequest: 49,
          acceptedHeadSha: "20b0b065e290201405cb78e1503fac102575232f",
          integratedMainSha: "9b950a5fd603be27c813f9298b0b14888fbce6cf",
          finalDecision: "RELEASE_GO",
          completionReceipt: "Development_Docs/Project_Bridgewatch_Phase_2_Completion_Receipt.md",
          mergedAt: "2026-08-12T13:15:13.000Z",
          completedAt: "2026-08-12T13:15:13.000Z",
        },
      ),
      phase(
        "bridgewatch",
        3,
        "Keep the Watch",
        "COMPLETE",
        "Development_Docs/Project_Bridgewatch_Phase_3_Design_Record.md",
        {
          branch: "codex/project-bridgewatch-phase3-keep-the-watch-6",
          pullRequest: 83,
          acceptedHeadSha: "5bae2e4d2d0aee6993f8e619cc8c79ef99235ff6",
          integratedMainSha: "dead22dc26aeec2b722625aa9a68dc5688111fca",
          finalDecision: "RELEASE_GO",
          completionReceipt: "Development_Docs/Project_Bridgewatch_Phase_3_Completion_Receipt.md",
          mergedAt: "2026-08-13T16:19:31.000Z",
          completedAt: "2026-08-13T16:19:31.000Z",
        },
      ),
    ],
    {
      completionReceipt: "Development_Docs/Project_Bridgewatch_Completion_Receipt.md",
      finalMainSha: "dead22dc26aeec2b722625aa9a68dc5688111fca",
      finalDecision: "RELEASE_GO",
    },
  ),
  record(
    "sounding-line",
    "Project Sounding Line",
    "COMPLETE",
    "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Program_Completion_Receipt.md",
    [
      phase(
        "sounding-line",
        1,
        "Policy and inventory",
        "COMPLETE",
        "Development_Docs/Completion_Receipts/Project_Sounding_Line_Phase_1_Completion_Receipt.md",
      ),
      phase(
        "sounding-line",
        2,
        "Execution infrastructure",
        "COMPLETE",
        "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Phase_2_Completion_Receipt.md",
      ),
      phase(
        "sounding-line",
        3,
        "Historical result intelligence",
        "COMPLETE",
        "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Phase_3_Completion_Receipt.md",
      ),
      phase(
        "sounding-line",
        4,
        "Authority cutover",
        "COMPLETE",
        "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Phase_4_Completion_Receipt.md",
      ),
    ],
    {
      completionReceipt: "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Program_Completion_Receipt.md",
      finalDecision: "RELEASE_GO",
      finalMainSha: "424ecc3b7a15ad53fc591287968720829c27f6ae",
    },
  ),
  record(
    "helm",
    "Project Helm",
    "ACTIVE",
    "Development_Docs/Projects/Project_Helm/Project_Helm_Phase_1_Completion_Receipt.md",
    [
      phase(
        "helm",
        1,
        "Take the Helm",
        "COMPLETE",
        "Development_Docs/Projects/Project_Helm/Project_Helm_Phase_1_Completion_Receipt.md",
        {
          completionReceipt: "Development_Docs/Projects/Project_Helm/Project_Helm_Phase_1_Completion_Receipt.md",
          integratedMainSha: "d4991766369697584c5d2ea7cba22da903ecab8c",
          finalDecision: "RELEASE_GO",
          pullRequest: 31,
        },
      ),
      phase(
        "helm",
        2,
        "Read the Deck",
        "ACTIVE",
        "Development_Docs/Projects/Project_Helm/Project_Helm_Captain_Operations_and_Participating_Captain_System_Governing_Document_v1.0.pdf",
      ),
    ],
  ),
  record(
    "tideglass",
    "Project Tideglass",
    "ACTIVE",
    "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_1_Completion_Receipt.md",
    [
      phase(
        "tideglass",
        1,
        "Set the Glass",
        "COMPLETE",
        "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_1_Completion_Receipt.md",
        {
          completionReceipt:
            "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_1_Completion_Receipt.md",
          integratedMainSha: "40d822cd936c9abbfce064fd7799e6a2f8c9785e",
          finalDecision: "RELEASE_GO",
          pullRequest: 17,
        },
      ),
      phase(
        "tideglass",
        2,
        "Read the Wake",
        "ACTIVE",
        "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Active_Phase_Registration.json",
      ),
    ],
  ),
  record(
    "lanternwake",
    "Project Lanternwake",
    "COMPLETE",
    "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Completion_Receipt.md",
    [
      phase(
        "lanternwake",
        1,
        "Cinematic system",
        "COMPLETE",
        "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Phase_1_Design_Record.md",
      ),
      phase(
        "lanternwake",
        2,
        "System integration",
        "COMPLETE",
        "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Phase_2_Validation_Report.md",
      ),
      phase(
        "lanternwake",
        3,
        "Presentation repair",
        "COMPLETE",
        "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Phase_3_Validation_Report.md",
      ),
      phase(
        "lanternwake",
        4,
        "Bring the Harbor Alive",
        "COMPLETE",
        "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Phase_4_Animation_Manifest.csv",
      ),
      phase(
        "lanternwake",
        5,
        "Universal language integration",
        "COMPLETE",
        "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Phase_5_Universal_Language_Integration_Record.md",
      ),
      phase(
        "lanternwake",
        6,
        "Make it Seaworthy",
        "COMPLETE",
        "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Completion_Receipt.md",
      ),
    ],
    {
      completionReceipt: "Development_Docs/Programs/Lanternwake/Project_Lanternwake_Completion_Receipt.md",
      finalMainSha: "b070d541a5c4e428b54d9030029d7e6c8f81aca2",
      limitations: ["Historical receipt retains original external and integration context."],
    },
  ),
  record(
    "admiralty",
    "Project Admiralty",
    "ACTIVE",
    "Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Completion_Receipt.md",
    [
      phase(
        "admiralty",
        1,
        "Raise the Colors",
        "MERGED",
        "Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Completion_Receipt.md",
      ),
      phase(
        "admiralty",
        2,
        "Open the Chartroom",
        "ACTIVE",
        "Development_Docs/Projects/Project Admiralty/Project_Admiralty_Platform_Administration_and_Operations_Governing_Document_v1.2.pdf",
      ),
    ],
  ),
  record(
    "deepwater",
    "Project Deepwater",
    "ACTIVE",
    "Development_Docs/Programs/Deepwater/deepwater-phase-status.json",
    [
      phase(
        "deepwater",
        1,
        "Sound the Depths",
        "COMPLETE",
        "Development_Docs/Programs/Deepwater/phase-records/Project_Deepwater_Phase_1_Integration_Record.md",
      ),
      phase(
        "deepwater",
        2,
        "Trace the Current",
        "COMPLETE",
        "Development_Docs/Programs/Deepwater/phase-records/Project_Deepwater_Phase_2_Integration_Record.md",
      ),
      phase(
        "deepwater",
        3,
        "Raise the Capability",
        "ACTIVE",
        "Development_Docs/Programs/Deepwater/phase-records/Project_Deepwater_Phase_3_Design_Record.md",
      ),
    ],
  ),
  record(
    "drydock",
    "Project Drydock",
    "ACTIVE",
    "Development_Docs/Projects/Project Drydock/Project_Drydock_Governing_Document.pdf",
    [
      phase(
        "drydock",
        1,
        "Set the Blocks",
        "MERGED",
        "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_1_Completion_Receipt.md",
      ),
      phase(
        "drydock",
        2,
        "Sound the Hull",
        "ACTIVE",
        "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_2_Completion_Receipt.md",
      ),
    ],
  ),
  record(
    "wakebook",
    "Project Wakebook",
    "ACTIVE",
    "Development_Docs/Projects/Project Wakebook/Project_Wakebook_Governing_Document.pdf",
    [
      phase(
        "wakebook",
        1,
        "Open the Wake",
        "ACTIVE",
        "Development_Docs/Projects/Project Wakebook/Project_Wakebook_Governing_Document.pdf",
      ),
    ],
  ),
  record(
    "shipwright",
    "Project Shipwright",
    "ACTIVE",
    "Development_Docs/Projects/Project Shipwright/Project_Shipwright_Creator_Studio_Authoring_Experience_Governing_Document.pdf",
    [
      phase(
        "shipwright",
        1,
        "Clear the Workbench",
        "ACTIVE",
        "Development_Docs/Projects/Project Shipwright/Project_Shipwright_Phase_1_Design_Record.md",
      ),
    ],
  ),
  record(
    "homeport",
    "Project Homeport",
    "ACTIVE",
    "Development_Docs/Projects/Project_Homeport/Project_Homeport_Mainline_Integration_Record.md",
    [
      phase(
        "homeport",
        1,
        "Identity and session authority",
        "COMPLETE",
        "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_1_Integration_Manifest.md",
      ),
      phase(
        "homeport",
        7,
        "Integrated whole-product voyage",
        "ACTIVE",
        "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Integration_Manifest.md",
      ),
    ],
  ),
  record(
    "harborlight",
    "Project Harborlight",
    "UNKNOWN",
    "Development_Docs/Programs/Harborlight/Project_Harborlight_Phase_1_Design_Record.md",
    [
      phase(
        "harborlight",
        1,
        "Recorded phase state",
        "UNKNOWN",
        "Development_Docs/Programs/Harborlight/Project_Harborlight_Phase_1_Design_Record.md",
      ),
    ],
    {
      missingEvidence: ["No accepted project-level lifecycle record was identified during the Phase 2 backfill pass."],
    },
  ),
  record(
    "one-voyage",
    "Project One Voyage",
    "UNKNOWN",
    "Development_Docs/Programs/One_Voyage/Project_One_Voyage_Phase_2_Completion_Report.md",
    [
      phase(
        "one-voyage",
        2,
        "Recorded phase state",
        "UNKNOWN",
        "Development_Docs/Programs/One_Voyage/Project_One_Voyage_Phase_2_Completion_Report.md",
      ),
    ],
    {
      missingEvidence: ["No accepted project-level lifecycle record was identified during the Phase 2 backfill pass."],
    },
  ),
  record(
    "wayfarer",
    "Project Wayfarer",
    "UNKNOWN",
    "Development_Docs/Programs/Wayfarer/Project_Wayfarer_Phase_1_Design_Record.md",
    [
      phase(
        "wayfarer",
        1,
        "Recorded phase state",
        "UNKNOWN",
        "Development_Docs/Programs/Wayfarer/Project_Wayfarer_Phase_1_Design_Record.md",
      ),
    ],
    {
      missingEvidence: ["No accepted project-level lifecycle record was identified during the Phase 2 backfill pass."],
    },
  ),
  record(
    "sealed-hold",
    "Project Sealed Hold",
    "UNKNOWN",
    "Development_Docs/Programs/Sealed_Hold/Project_Sealed_Hold_Phase_2_Completion_Receipt.md",
    [
      phase(
        "sealed-hold",
        2,
        "Fortify the Hold",
        "UNKNOWN",
        "Development_Docs/Programs/Sealed_Hold/Project_Sealed_Hold_Phase_2_Completion_Receipt.md",
      ),
    ],
    { missingEvidence: ["The located phase receipt is not an accepted project-level completion record."] },
  ),
  record(
    "ledgerlight",
    "Project Ledgerlight",
    "UNKNOWN",
    "Development_Docs/Programs/Other/Project_Ledgerlight_Completion_Receipt.md",
    [
      phase(
        "ledgerlight",
        1,
        "Documentation governance",
        "UNKNOWN",
        "Development_Docs/Programs/Other/Project_Ledgerlight_Completion_Receipt.md",
      ),
    ],
    { missingEvidence: ["The retained receipt is explicitly historical; current acceptance is not inferred."] },
  ),
  record(
    "true-north",
    "Project True North",
    "UNKNOWN",
    "Development_Docs/Project_True_North_Completion_Receipt.md",
    [
      phase(
        "true-north",
        1,
        "Role-aware navigation shell",
        "UNKNOWN",
        "Development_Docs/Project_True_North_Completion_Receipt.md",
      ),
    ],
    { missingEvidence: ["The retained receipt explicitly records active-branch reconciliation pending."] },
  ),
];

/**
 * The retained registry is repository-specific evidence, while collection is
 * configured at runtime.  Rebind presentation records to the exact repository
 * being observed so a correct collector cannot be paired with stale project
 * provenance.
 */
export function registryForRepository(repository: string): readonly ProjectRecord[] {
  return projectRegistry.map((project) => ({ ...project, repository }));
}

export function findProject(id: string): ProjectRecord | undefined {
  return projectRegistry.find((project) => project.id === id);
}
