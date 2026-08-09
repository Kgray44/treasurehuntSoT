import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { format, resolveConfig } from "prettier";
import { blockRegistry, blockTypeIds } from "../../src/chronicle/block-registry";
import { canonicalChecksum, canonicalizeValue } from "../../src/drydock/canonical";
import { serializeDrydockBlockContractRegistry } from "../../src/drydock/contracts/registry";
import { serializeExtensionRegistry } from "../../src/drydock/extensions";
import { drydockProviderRegistry } from "../../src/drydock/providers";

const root = resolve(process.cwd());
const write = process.argv.includes("--write");
const terminalId = "drydock-fixture-taleComplete-v1";
const chapterCompleteId = "drydock-fixture-chapterComplete-v1";

const overrides: Record<string, Record<string, unknown>> = {
  captainsNote: { body: "Synthetic fixture note." },
  riddle: { riddleText: "What follows a wake?", acceptedAnswers: ["a ship"] },
  information: { body: "Synthetic fixture information." },
  travelDirection: { directionText: "Sail toward the synthetic north star." },
  location: { locationId: "location-fixture", playerDescription: "Synthetic destination." },
  image: { assetId: "asset-image", altText: "Synthetic horizon", decorative: false },
  imageTransformation: {
    beforeAssetId: "asset-before",
    afterAssetId: "asset-after",
    nonMotionMeaning: "The marked route becomes visible.",
  },
  cinematic: {
    videoAssetId: "asset-video",
    posterAssetId: "asset-poster",
    captionsAssetId: "asset-captions",
    nonMotionMeaning: "The crew reaches the harbor.",
  },
  audio: { audioAssetId: "asset-audio", transcript: "Synthetic spoken clue." },
  artifactReveal: {
    artifactId: "artifact-fixture",
    loreDescription: "Synthetic artifact history.",
  },
  hiddenMessageReveal: { baseAssetId: "asset-base", messageText: "Synthetic hidden bearing." },
  collectionUpdate: { artifactId: "artifact-fixture" },
  choice: {
    choices: [
      { id: "choice-a", label: "First course", targetBlockId: chapterCompleteId },
      { id: "choice-b", label: "Second course", targetBlockId: terminalId },
    ],
  },
  textAnswer: { acceptedAnswers: ["north"] },
  condition: {
    variable: "flag",
    successTargetBlockId: chapterCompleteId,
    failureTargetBlockId: terminalId,
  },
};

const fixtureBlocks = blockTypeIds.map((type) => {
  const id = `drydock-fixture-${type}-v1`;
  const configuration = structuredClone(blockRegistry[type].defaultConfiguration) as Record<string, unknown>;
  Object.assign(configuration, overrides[type] ?? {});
  const connections =
    type === "taleComplete"
      ? []
      : type === "choice"
        ? [
            { targetBlockId: chapterCompleteId, connectionType: "CHOICE", label: "First course" },
            { targetBlockId: terminalId, connectionType: "CHOICE", label: "Second course" },
          ]
        : type === "condition"
          ? [
              { targetBlockId: chapterCompleteId, connectionType: "SUCCESS" },
              { targetBlockId: terminalId, connectionType: "FAILURE" },
            ]
          : [{ targetBlockId: terminalId, connectionType: "DEFAULT" }];
  return {
    fixtureId: id,
    id,
    blockType: type,
    schemaVersion: 1,
    configuration,
    presentation: {},
    completion: {},
    connections,
    nextBlockId: connections[0]?.targetBlockId ?? null,
  };
});

const providerRegistry = Object.values(drydockProviderRegistry).map((provider) => ({
  id: provider.id,
  version: provider.version,
  owner: provider.owner,
  state: provider.state,
  runtimeCapability: provider.runtimeCapability,
  simulatorCapability: provider.simulatorCapability,
  privacyClass: provider.privacyClass,
  requiresFallback: provider.requiresFallback,
  captainOverride: provider.captainOverride,
  retryPolicy: provider.retryPolicy,
  faultModes: provider.faultModes,
  outcomes: provider.outcomes,
}));

const artifacts = new Map<string, unknown>([
  [
    "tests/fixtures/drydock/current-authoring-v1.json",
    {
      schemaVersion: 1,
      fixtureSetId: "drydock-current-authoring-v1",
      classification: "SYNTHETIC_NO_PRIVATE_CONTENT",
      frozenAt: "2026-08-09",
      blocks: fixtureBlocks,
    },
  ],
  [
    "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_1_Block_Contract_Registry.json",
    {
      schemaVersion: 1,
      generatedBy: "scripts/drydock/generate-contract-artifacts.ts",
      contracts: serializeDrydockBlockContractRegistry(),
    },
  ],
  [
    "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_1_Migration_Catalog.json",
    {
      schemaVersion: 1,
      currentSchemaVersion: 2,
      minimumReaderVersion: 1,
      migrations: serializeDrydockBlockContractRegistry().flatMap((contract) => contract.migrations),
    },
  ],
  [
    "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_1_Provider_Registry.json",
    { schemaVersion: 1, providers: providerRegistry },
  ],
  [
    "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_1_Extension_Registry.json",
    { schemaVersion: 1, extensions: serializeExtensionRegistry() },
  ],
  [
    "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_1_Historical_Compatibility_Ledger.json",
    {
      schemaVersion: 1,
      fixtureSetId: "drydock-current-authoring-v1",
      frozenAt: "2026-08-09",
      classification: "SYNTHETIC_NO_PRIVATE_CONTENT",
      sourcePath: "tests/fixtures/drydock/current-authoring-v1.json",
      immutablePublishedSnapshotsRewritten: false,
      fixtures: fixtureBlocks.map((block) => ({
        fixtureId: block.fixtureId,
        blockType: block.blockType,
        sourceSchemaVersion: block.schemaVersion,
        expectedCurrentSchemaVersion: 2,
        expectedMigrationId: `drydock.${block.blockType}.v1-to-v2`,
        authoredChecksum: canonicalChecksum(block),
      })),
    },
  ],
]);

async function main() {
  let drift = false;
  for (const [relativePath, value] of artifacts) {
    const destination = resolve(root, relativePath);
    const prettierConfig = (await resolveConfig(destination)) ?? {};
    const expected = await format(JSON.stringify(canonicalizeValue(value)), {
      ...prettierConfig,
      parser: "json",
    });
    if (write) writeFileSync(destination, expected, "utf8");
    else {
      let actual = "";
      try {
        actual = readFileSync(destination, "utf8");
      } catch {
        // Missing output is reported as deterministic drift below.
      }
      if (actual !== expected) {
        drift = true;
        console.error(`DRYDOCK_ARTIFACT_DRIFT ${relativePath}`);
      }
    }
  }
  if (drift) process.exitCode = 1;
  else console.log(`DRYDOCK_ARTIFACTS_${write ? "WRITTEN" : "CURRENT"} ${artifacts.size}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
