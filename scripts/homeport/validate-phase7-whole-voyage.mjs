import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const projectRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const final = process.argv.includes("--final");
const failures = [];
const required = [
  "Project_Homeport_Phase_7_Integrated_Journey_Registry.json",
  "Project_Homeport_Phase_7_Integrated_Fixture_Manifest.json",
  "Project_Homeport_Phase_7_Test_Account_Matrix.csv",
  "Project_Homeport_Phase_7_Journey_State_Matrix.csv",
  "Project_Homeport_Phase_7_Journey_Evidence_Matrix.csv",
  "Project_Homeport_Phase_7_Failure_and_Recovery_Matrix.csv",
  "Project_Homeport_Phase_7_Visual_Comparison_Matrix.csv",
  "Project_Homeport_Phase_7_Walkthrough_Runtime_Contract.json",
];
for (const name of required) {
  try {
    if ((await stat(path.join(projectRoot, name))).size < 1) failures.push(`${name}:EMPTY`);
  } catch {
    failures.push(`${name}:MISSING`);
  }
}

const registry = JSON.parse(await readFile(path.join(projectRoot, required[0]), "utf8"));
const manifest = JSON.parse(await readFile(path.join(projectRoot, required[1]), "utf8"));
const expectedIds = [..."ABCDEFGHIJKLMNO"];
if (registry.fixtureVersion !== "homeport-phase7-integrated-v1") failures.push("REGISTRY_FIXTURE_VERSION");
if (manifest.fixtureVersion !== registry.fixtureVersion) failures.push("MANIFEST_FIXTURE_VERSION");
if (JSON.stringify(registry.journeys.map((entry) => entry.journeyId)) !== JSON.stringify(expectedIds))
  failures.push("JOURNEY_IDS_A_THROUGH_O");
for (const journey of registry.journeys) {
  for (const field of [
    "name",
    "purpose",
    "owner",
    "fixtureClone",
    "startingAccountState",
    "rootRoute",
    "requiredControls",
    "routeMilestones",
    "mutationMilestones",
    "accountStateAssertions",
    "visualMilestones",
    "keyboardMilestones",
    "focusMilestones",
    "viewport",
    "motionMode",
    "expectedFinalState",
    "resetPolicy",
    "evidenceIds",
    "testContractIds",
    "sourceSha",
    "result",
    "limitations",
  ])
    if (!(field in journey)) failures.push(`${journey.journeyId}:MISSING_${field}`);
  if (journey.rootRoute !== "/") failures.push(`${journey.journeyId}:ROOT_ROUTE`);
  if (!String(journey.fixtureClone).startsWith("journey-")) failures.push(`${journey.journeyId}:FIXTURE_CLONE`);
  if (!journey.requiredControls.length || !journey.routeMilestones.length || !journey.evidenceIds.length)
    failures.push(`${journey.journeyId}:INCOMPLETE_CONTRACT`);
  if (final && journey.result !== "PASSED") failures.push(`${journey.journeyId}:NOT_PASSED`);
}
const allText = (await Promise.all(required.map((name) => readFile(path.join(projectRoot, name), "utf8")))).join("\n");
for (const pattern of [/password\s*[:=]/iu, /raw[_ -]?token/iu, /csrf\s*[:=]/iu, /BEGIN (?:RSA|OPENSSH|PRIVATE) KEY/u])
  if (pattern.test(allText)) failures.push(`SECRET_PATTERN:${pattern.source}`);
for (const alias of [
  "ANONYMOUS",
  "REGISTRATION_CANDIDATE",
  "RETURNING_FULL_CAPABILITY",
  "PLAYER_ONLY",
  "CAPTAIN_ONLY",
  "CREATOR_ONLY",
  "MODERATOR",
  "RESTRICTED_ACCOUNT",
  "EXPIRED_SESSION_ACCOUNT",
  "RECOVERY_ACCOUNT",
  "EMPTY_NEW_ACCOUNT",
])
  if (!manifest.aliases.some((entry) => entry.alias === alias)) failures.push(`ALIAS_MISSING:${alias}`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
process.stdout.write(`${final ? "HOMEPORT_PHASE7_CONTRACTS_FINAL_VALID" : "HOMEPORT_PHASE7_CONTRACTS_VALID"}\n`);
