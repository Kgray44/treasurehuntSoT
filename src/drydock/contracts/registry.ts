import { blockRegistry } from "@/chronicle/block-registry";
import type { JsonObject } from "@/chronicle/types";
import {
  drydockBlockTypeIds,
  drydockCompletionSchema,
  drydockConfigurationSchemas,
  drydockPresentationSchema,
  type DrydockBlockType,
} from "@/drydock/contracts/schemas";
import type {
  DrydockAccessibilityRule,
  DrydockAssetRequirement,
  DrydockBlockContract,
  DrydockConnectionPolicy,
  DrydockVariableReferenceContract,
} from "@/drydock/contracts/model";
import { createV1ToV2BlockMigration, migrationCatalogRecord } from "@/drydock/migrations";
import type { DrydockProviderId } from "@/drydock/providers";

const providerByType: Partial<Record<DrydockBlockType, DrydockProviderId | "CONFIGURED_COMPLETION">> = {
  riddle: "textAnswer",
  textAnswer: "textAnswer",
  captainApproval: "captainManual",
  wait: "timer",
  arrivalCheck: "CONFIGURED_COMPLETION",
};

const requiredAssets: Partial<Record<DrydockBlockType, readonly string[]>> = {
  image: ["assetId"],
  imageTransformation: ["beforeAssetId", "afterAssetId"],
  cinematic: ["videoAssetId", "posterAssetId", "captionsAssetId"],
  audio: ["audioAssetId"],
  artifactReveal: ["artifactId"],
  hiddenMessageReveal: ["baseAssetId"],
  collectionUpdate: ["artifactId"],
};

const accessibilityByType: Partial<Record<DrydockBlockType, readonly DrydockAccessibilityRule[]>> = {
  image: [
    {
      code: "DRYDOCK_ACCESS_IMAGE_TEXT_ALTERNATIVE",
      fieldPath: "configuration.altText",
      obligation: "A player-facing image requires meaningful alternative text or explicit decorative classification.",
      required: true,
    },
  ],
  imageTransformation: [
    {
      code: "DRYDOCK_ACCESS_MOTION_MEANING",
      fieldPath: "configuration.nonMotionMeaning",
      obligation: "A transformation must preserve its meaning without motion.",
      required: false,
    },
  ],
  cinematic: [
    {
      code: "DRYDOCK_ACCESS_VIDEO_CAPTIONS",
      fieldPath: "configuration.captionsAssetId",
      obligation: "Player-facing video requires captions and a poster fallback.",
      required: true,
    },
  ],
  audio: [
    {
      code: "DRYDOCK_ACCESS_AUDIO_TRANSCRIPT",
      fieldPath: "configuration.transcript",
      obligation: "Player-facing audio requires a transcript.",
      required: true,
    },
  ],
  arrivalCheck: [
    {
      code: "DRYDOCK_ACCESS_PROVIDER_FALLBACK",
      fieldPath: "completion.fallbackMode",
      obligation: "Unavailable or inaccessible provider completion requires a manual accessible fallback.",
      required: true,
    },
  ],
};

function assetRequirements(type: DrydockBlockType): DrydockAssetRequirement[] {
  const definition = blockRegistry[type];
  return Object.entries(definition.assetFields).map(([fieldPath, mediaTypes]) => ({
    fieldPath: `configuration.${fieldPath}`,
    required: requiredAssets[type]?.includes(fieldPath) ?? false,
    mediaTypes: mediaTypes as DrydockAssetRequirement["mediaTypes"],
    playerSafe: true,
    ...(type === "audio" ? { accessibilityFallback: "configuration.transcript" } : {}),
    ...(type === "cinematic" && fieldPath === "videoAssetId"
      ? { accessibilityFallback: "configuration.captionsAssetId" }
      : {}),
  }));
}

function connectionPolicy(type: DrydockBlockType): DrydockConnectionPolicy {
  if (type === "taleComplete")
    return {
      canonicalAuthority: "BLOCK_CONNECTION",
      allowedTypes: [],
      minimum: 0,
      maximum: 0,
      terminal: true,
      legacyMirrors: ["nextBlockId"],
    };
  if (type === "choice")
    return {
      canonicalAuthority: "BLOCK_CONNECTION",
      allowedTypes: ["CHOICE"],
      minimum: 2,
      maximum: 20,
      terminal: false,
      legacyMirrors: ["configuration.choices[].targetBlockId", "nextBlockId"],
    };
  if (type === "condition")
    return {
      canonicalAuthority: "BLOCK_CONNECTION",
      allowedTypes: ["SUCCESS", "FAILURE"],
      minimum: 2,
      maximum: 2,
      terminal: false,
      legacyMirrors: ["configuration.successTargetBlockId", "configuration.failureTargetBlockId", "nextBlockId"],
    };
  return {
    canonicalAuthority: "BLOCK_CONNECTION",
    allowedTypes: ["DEFAULT"],
    minimum: 0,
    maximum: 1,
    terminal: false,
    legacyMirrors: ["nextBlockId"],
  };
}

function variableReferences(type: DrydockBlockType): {
  reads: DrydockVariableReferenceContract[];
  writes: DrydockVariableReferenceContract[];
} {
  if (type === "condition")
    return {
      reads: [{ fieldPath: "configuration.expression", identityFieldPath: "configuration.variable", access: "READ" }],
      writes: [],
    };
  if (type === "setVariable")
    return {
      reads: [],
      writes: [
        {
          fieldPath: "configuration.variableId",
          identityFieldPath: "configuration.variableName",
          access: "WRITE",
          operations: ["assign", "increment", "decrement", "toggle"],
        },
      ],
    };
  return { reads: [], writes: [] };
}

function defaultCompletion(type: DrydockBlockType, configuration: JsonObject): JsonObject {
  const legacy = configuration.completionMode;
  const configuredProvider = configuration.verificationProvider;
  return {
    mode:
      typeof configuredProvider === "string"
        ? configuredProvider
        : typeof legacy === "string"
          ? legacy
          : providerByType[type] === "CONFIGURED_COMPLETION"
            ? "captainManual"
            : (providerByType[type] ?? "playerConfirmation"),
  };
}

function defaultConfiguration(type: DrydockBlockType): JsonObject {
  const configuration = structuredClone(blockRegistry[type].defaultConfiguration);
  delete configuration.completionMode;
  delete configuration.verificationProvider;
  if (
    configuration.futureVision &&
    typeof configuration.futureVision === "object" &&
    !Object.keys(configuration.futureVision).length
  )
    delete configuration.futureVision;
  if (
    configuration.futureProviderOptions &&
    typeof configuration.futureProviderOptions === "object" &&
    !Object.keys(configuration.futureProviderOptions).length
  )
    delete configuration.futureProviderOptions;
  if (type === "condition") {
    const value = configuration.value as boolean | number | string | string[] | null;
    configuration.expression = {
      schemaVersion: 1,
      root: {
        kind: "compare",
        operator: "equals",
        left: { kind: "variable", variableId: String(configuration.variable ?? "variable") },
        right: {
          kind: "literal",
          valueType:
            typeof value === "boolean"
              ? "BOOLEAN"
              : typeof value === "number" && Number.isSafeInteger(value)
                ? "INTEGER"
                : typeof value === "number"
                  ? "NUMBER"
                  : Array.isArray(value)
                    ? "STRING_SET"
                    : "STRING",
          value,
        },
      },
    };
  }
  if (type === "setVariable") {
    configuration.variableId = "var-new";
    configuration.variableName = String(configuration.variable ?? "variable");
    configuration.scope = "SESSION";
    configuration.privacy = "PLAYER_SAFE";
    if (
      configuration.valueType === "number" &&
      typeof configuration.value === "number" &&
      Number.isSafeInteger(configuration.value)
    )
      configuration.valueType = "integer";
  }
  return configuration;
}

const contracts = Object.fromEntries(
  drydockBlockTypeIds.map((type) => {
    const references = variableReferences(type);
    const configuration = defaultConfiguration(type);
    const contract: DrydockBlockContract = {
      type,
      currentVersion: 2,
      minimumReaderVersion: 1,
      configurationSchema: drydockConfigurationSchemas[type],
      presentationSchema: drydockPresentationSchema,
      completionSchema: drydockCompletionSchema,
      defaultConfiguration: configuration,
      defaultPresentation: {},
      defaultCompletion: defaultCompletion(type, blockRegistry[type].defaultConfiguration),
      connectionPolicy: connectionPolicy(type),
      assetRequirements: assetRequirements(type),
      variableReads: references.reads,
      variableWrites: references.writes,
      providerContract: providerByType[type] ?? "CONFIGURED_COMPLETION",
      accessibilityRules: accessibilityByType[type] ?? [],
      migrations: [createV1ToV2BlockMigration(type)],
      canonicalization: {
        objectKeys: "LEXICOGRAPHIC",
        arrayOrder: "PRESERVE",
        prose: "PRESERVE_EXACTLY",
        finiteNumbersOnly: true,
      },
      compatibility: {
        legacyConfigurationVersion: 1,
        legacyCompletionField: "configuration.completionMode",
        duplicatedTargetFields: connectionPolicy(type).legacyMirrors,
      },
    };
    return [type, contract];
  }),
) as Record<DrydockBlockType, DrydockBlockContract>;

export const drydockBlockContracts = contracts;

export function getDrydockBlockContract(type: string): DrydockBlockContract | undefined {
  return contracts[type as DrydockBlockType];
}

export function serializeDrydockBlockContractRegistry() {
  return drydockBlockTypeIds.map((type) => {
    const contract = contracts[type];
    return {
      type: contract.type,
      currentVersion: contract.currentVersion,
      minimumReaderVersion: contract.minimumReaderVersion,
      defaultConfiguration: contract.defaultConfiguration,
      defaultPresentation: contract.defaultPresentation,
      defaultCompletion: contract.defaultCompletion,
      connectionPolicy: contract.connectionPolicy,
      assetRequirements: contract.assetRequirements,
      variableReads: contract.variableReads,
      variableWrites: contract.variableWrites,
      providerContract: contract.providerContract,
      accessibilityRules: contract.accessibilityRules,
      migrations: contract.migrations.map(migrationCatalogRecord),
      canonicalization: contract.canonicalization,
      compatibility: contract.compatibility,
    };
  });
}

export function studioRegistryFromDrydock() {
  return drydockBlockTypeIds.map((type) => {
    const definition = blockRegistry[type];
    const contract = contracts[type];
    return {
      ...Object.fromEntries(Object.entries(definition).filter(([key]) => key !== "validationSchema")),
      schemaVersion: contract.currentVersion,
      defaultConfiguration: contract.defaultConfiguration,
      defaultPresentation: contract.defaultPresentation,
      defaultCompletion: contract.defaultCompletion,
      contract: {
        currentVersion: contract.currentVersion,
        minimumReaderVersion: contract.minimumReaderVersion,
        connectionPolicy: contract.connectionPolicy,
        assetRequirements: contract.assetRequirements,
        providerContract: contract.providerContract,
        accessibilityRules: contract.accessibilityRules,
      },
    };
  });
}
