import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildCaptureContract, buildRouteCensus, semanticCaptureIssue } from "../../scripts/brightwork/visual-evidence.mjs";

const root = path.resolve(process.cwd());

async function census() {
  const [legacyInventory, screenCatalog] = await Promise.all([
    readFile(path.join(root, "Development_Docs/Projects/Project_Homeport/Homeport_Route_Inventory.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "Development_Docs/Projects/Project_Homeport/Homeport_Screen_Catalog.json"), "utf8").then(JSON.parse),
  ]);
  return buildRouteCensus({
    appRoot: path.join(root, "src/app"),
    legacyInventory,
    screenCatalog,
    sourceSha: "test-product-source",
    auditRuntimeSourceSha: "test-audit-runtime-source",
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
}

test("every READY requirement has an explicit landmark and missing landmarks fail closed", async () => {
  const contract = buildCaptureContract(await census(), "2026-09-03T00:00:00.000Z");
  const ready = contract.requirements.filter((requirement) => requirement.state === "READY");
  assert.ok(ready.length > 0);
  assert.equal(contract.auditRuntimeSourceSha, "test-audit-runtime-source");
  assert.ok(ready.every((requirement) => requirement.expectedReadyLandmarks?.every((landmark) => landmark.id && landmark.selector)));
  const sample = ready[0];
  assert.equal(
    semanticCaptureIssue(sample, {
      visibleMain: true,
      expectedPathMatched: true,
      transitionSettled: true,
      notFound: false,
      unauthorizedSurface: false,
      unavailableSurface: false,
      deadEndSurface: false,
      readyLandmarks: [],
      syntheticRecordProven: true,
    }),
    "READY_LANDMARK_MISSING",
  );
});

test("Community, privileged stations, and redirect routes retain source-specific evidence metadata", async () => {
  const routes = (await census()).routes;
  const community = routes.find((route) => route.routePattern === "/community");
  const featured = routes.find((route) => route.routePattern === "/community/featured");
  const privateOperations = routes.find((route) => route.routePattern === "/studio/private-content/operations");
  const configuration = routes.find((route) => route.routePattern === "/admin/configuration");
  const exchange = routes.find((route) => route.routePattern === "/studio/exchange");
  assert.ok(community?.readyLandmarks.some((landmark) => landmark.id === "COMMUNITY_HARBOR_DIRECTORY"));
  assert.ok(featured?.readyLandmarks.some((landmark) => landmark.id === "COMMUNITY_FEATURED_HEADING"));
  assert.equal(privateOperations?.classification, "CONTEXTUAL_DYNAMIC_DESTINATION");
  assert.equal(privateOperations?.capabilityMetadata?.requiredCapability, "ADMIN");
  assert.deepEqual(privateOperations?.meaningfulVisualStates, ["DEPENDENCY_UNAVAILABLE", "INITIAL_LOADING", "READY", "UNAUTHORIZED"]);
  assert.ok(configuration?.readyLandmarks.some((landmark) => landmark.id === "ADMIRALTY_CONFIGURATION_HEADING"));
  assert.ok(exchange?.readyLandmarks.some((landmark) => landmark.id === "STUDIO_EXCHANGE_HEADING"));
  const contract = buildCaptureContract({ routes }, "2026-09-03T00:00:00.000Z");
  const legacyPlaythrough = contract.requirements.find(
    (requirement) => requirement.routePattern === "/player/playthroughs/[playthroughId]",
  );
  assert.equal(legacyPlaythrough?.state, "COMPATIBILITY_OR_REDIRECT");
  assert.equal(legacyPlaythrough?.expectedDestination, "/player/playthroughs/[playthroughId]/journal");
});
