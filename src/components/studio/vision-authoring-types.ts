export type StudioAsset = {
  id: string;
  purpose: string | null;
  label: string | null;
  notes: string | null;
  role: string;
  isUsable: boolean;
  durationMs: number | null;
  segmentStartMs: number | null;
  segmentEndMs: number | null;
  sourceAssetId: string | null;
  contentHash: string;
  fileSize: number;
  mediaType: string;
  integrityState: string;
  cloudState: string;
  deletionStatus: string;
  deletedAt: string | null;
  qualitySummary: Record<string, unknown>;
  createdAt: string;
};

export type StudioAuthoringAggregate = {
  version: {
    id: string;
    waypointId: string;
    versionNumber: number;
    lifecycleStatus: string;
    verificationProfile: string;
    authoringRevision: number;
    authoringMode: "GUIDED" | "DETAILED" | "ENGINEERING";
    currentWizardStep: number;
    publishedAt: string | null;
    updatedAt: string;
  };
  waypoint: {
    id: string;
    name: string;
    description: string;
    type: string;
    locationTags: unknown[];
    sharingScope: string;
  };
  configuration: Record<string, unknown>;
  authoring: { schemaVersion: 1; completedSteps: number[]; steps: Record<string, Record<string, unknown> | undefined> };
  captures: Array<{
    id: string;
    sessionKey: string | null;
    purpose: string;
    status: string;
    durationMs: number | null;
    qualitySummary: Record<string, unknown>;
    interruptionSummary: Record<string, unknown>;
    createdAt: string;
  }>;
  assets: StudioAsset[];
  poseRegions: Array<{
    id: string;
    coordinateSystem: string;
    shapeType: string;
    classification: string;
    parameters: Record<string, unknown>;
    orientationRules: Record<string, unknown>;
    visibilityRules: Record<string, unknown>;
    authoringSource: string;
  }>;
  visualRegions: Array<{
    id: string;
    recordingAssetId: string | null;
    regionType: string;
    coordinateSpace: string;
    geometry: Record<string, unknown>;
    semanticLabel: string | null;
  }>;
  hardNegatives: Array<{ id: string; name: string; classification: string; metadata: Record<string, unknown> }>;
  tests: Array<{
    id: string;
    name: string;
    testType: string;
    instructions: string;
    expectedResult: string;
    status: string;
    environment: Record<string, unknown>;
    assetRole: string;
    lockedAt: string | null;
  }>;
  buildJobs: Array<{
    id: string;
    executionTarget: string;
    status: string;
    processingStage: string;
    progress: number;
    inputSchemaVersion: number;
    inputHash: string | null;
    engineMetadata: Record<string, unknown>;
    outputSummary: Record<string, unknown>;
    createdAt: string;
    completedAt: string | null;
  }>;
  dataHealth: {
    readyToPrepare: boolean;
    score: number;
    blockerCount: number;
    warningCount: number;
    items: Array<{ code: string; severity: "BLOCKER" | "WARNING"; step: number; message: string; recovery: string }>;
  };
};

export type AuthoringMutate = (operation: Record<string, unknown>) => Promise<boolean>;
