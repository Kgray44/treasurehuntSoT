import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const projectRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const sourceSha = process.env.HOMEPORT_PHASE7_SOURCE_SHA ?? git(["rev-parse", "HEAD"]);
const result = process.env.HOMEPORT_PHASE7_RESULT ?? "PENDING_EXECUTION";
const fixtureVersion = "homeport-phase7-integrated-v1";
const fixtureAliases = [
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
];
const definitions = [
  [
    "A",
    "Account creation",
    "REGISTRATION_CANDIDATE",
    ["Create Account", "Sign out"],
    ["/register", "/account"],
    ["ACCOUNT_CREATED", "SESSION_REVOKED"],
    "ANONYMOUS",
  ],
  [
    "B",
    "Returning account",
    "RETURNING_FULL_CAPABILITY",
    ["Sign In", "Player", "Captain", "Creator Studio"],
    ["/sign-in", "/player/library", "/captain/library", "/studio/library", "/account"],
    ["SESSION_CREATED"],
    "ANONYMOUS",
  ],
  [
    "C",
    "Player",
    "RETURNING_FULL_CAPABILITY",
    ["Player", "Chronicle Passport"],
    ["/player/library", "/player/playthroughs/[playthroughId]", "/passport"],
    [],
    "AUTHENTICATED_FULL_CAPABILITY",
  ],
  [
    "D",
    "Captain",
    "RETURNING_FULL_CAPABILITY",
    ["Captain", "View My Profile"],
    ["/captain/library", "/captain/sessions/[sessionId]", "/account"],
    [],
    "AUTHENTICATED_FULL_CAPABILITY",
  ],
  [
    "E",
    "Creator",
    "RETURNING_FULL_CAPABILITY",
    ["Creator Studio", "Community Harbor"],
    ["/studio/library", "/studio/tales/[taleId]", "/community"],
    ["DRAFT_STATE_OBSERVED"],
    "AUTHENTICATED_FULL_CAPABILITY",
  ],
  [
    "F",
    "Community discovery",
    "PLAYER_ONLY",
    ["Community Harbor", "Chronicles", "Save", "Chronicle Passport"],
    ["/community", "/community/chronicles", "/community/[slug]", "/passport/saved"],
    ["COMMUNITY_SAVE_CREATED"],
    "AUTHENTICATED_PLAYER",
  ],
  [
    "G",
    "Profile",
    "RETURNING_FULL_CAPABILITY",
    ["View My Profile", "Preferences", "Save preferences"],
    ["/account", "/account/preferences", "/account/security", "/account/sessions"],
    ["PREFERENCE_UPDATED"],
    "AUTHENTICATED_FULL_CAPABILITY",
  ],
  [
    "H",
    "Chronicle Passport",
    "RETURNING_FULL_CAPABILITY",
    ["Chronicle Passport", "History", "Memories", "Artifacts", "Saved"],
    ["/passport", "/passport/history", "/passport/memories", "/passport/artifacts", "/passport/saved"],
    [],
    "AUTHENTICATED_FULL_CAPABILITY",
  ],
  [
    "I",
    "Password recovery",
    "RECOVERY_ACCOUNT",
    ["Sign In", "Forgot Password", "Continue"],
    ["/forgot-password", "/reset-password", "/account/sessions"],
    ["PASSWORD_RESET", "SESSION_CREATED"],
    "AUTHENTICATED_RECOVERY_ACCOUNT",
  ],
  [
    "J",
    "Session expiry",
    "EXPIRED_SESSION_ACCOUNT",
    ["Sign In"],
    ["/player/library", "/sign-in"],
    ["SESSION_EXPIRED", "SESSION_REPLACED"],
    "AUTHENTICATED_PLAYER",
  ],
  [
    "K",
    "Permission",
    "PLAYER_ONLY",
    ["Community Harbor"],
    ["/community", "/community/moderation"],
    [],
    "AUTHENTICATED_PLAYER",
  ],
  [
    "L",
    "Mobile",
    "RETURNING_FULL_CAPABILITY",
    ["Open navigation", "Community Harbor", "View My Profile", "Player", "Sign out"],
    ["/", "/community", "/account", "/player/library"],
    ["SESSION_REVOKED"],
    "ANONYMOUS",
  ],
  [
    "M",
    "Sign-out and multi-tab",
    "RETURNING_FULL_CAPABILITY",
    ["Sign out"],
    ["/", "/player/library"],
    ["SESSION_REVOKED", "SECOND_TAB_INVALIDATED"],
    "ANONYMOUS",
  ],
  [
    "N",
    "Failure and recovery",
    "ANONYMOUS",
    ["Community Harbor", "Search", "Try again"],
    ["/community"],
    ["DEPENDENCY_FAILURE_ENABLED", "DEPENDENCY_RECOVERED"],
    "ANONYMOUS_STABLE",
  ],
  [
    "O",
    "Final whole-voyage rehearsal",
    "RETURNING_FULL_CAPABILITY",
    [
      "Sign In",
      "View My Profile",
      "Player",
      "Chronicle Passport",
      "Community Harbor",
      "Chronicles",
      "Save",
      "Creator Studio",
      "Captain",
      "Security & Sessions",
      "Sign out",
    ],
    [
      "/",
      "/account",
      "/player/library",
      "/passport",
      "/community",
      "/studio/library",
      "/captain/library",
      "/account/sessions",
    ],
    ["COMMUNITY_SAVE_CREATED", "SESSION_REVOKED"],
    "ANONYMOUS_STABLE",
  ],
];

const captureSuffix = {
  A: ["registered-profile"],
  B: ["cross-workspace-account"],
  C: ["player-voyage"],
  D: ["captain-session"],
  E: ["creator-private-state"],
  F: ["community-saved"],
  G: ["profile-preferences-saved"],
  H: ["passport-artifacts-and-saved"],
  I: ["recovery-restored-account"],
  J: ["session-expired"],
  K: ["permission-denied-authenticated"],
  L: ["mobile-workspace"],
  M: ["multi-tab-invalidated"],
  N: ["dependency-unavailable"],
  O: ["whole-voyage-community", "whole-voyage-anonymous-end"],
};

const journeys = definitions.map(([id, name, account, controls, routes, mutations, finalState]) => ({
  journeyId: id,
  name,
  purpose: `Prove the integrated ${String(name).toLocaleLowerCase("en-US")} voyage from the visible product gateway.`,
  owner: "PROJECT_HOMEPORT",
  fixtureClone: `journey-${id}.db`,
  startingAccountState: id === "J" || id === "K" ? "AUTHENTICATED_PRECONDITION_AFTER_ROOT_ENTRY" : account,
  rootRoute: "/",
  requiredControls: controls,
  routeMilestones: routes,
  mutationMilestones: mutations,
  accountStateAssertions: [account, finalState],
  visualMilestones: captureSuffix[id].map((suffix) => `HP-P7-EV-${id}-${suffix}`),
  keyboardMilestones: [id === "L" ? "MOBILE_NAVIGATION_FOCUS" : "VISIBLE_CONTROL_FOCUS"],
  focusMilestones: [id === "N" ? "RETRY_FOCUSED" : "ROUTE_MAIN_OR_DISCLOSURE_FOCUSED"],
  viewport: id === "L" ? { width: 390, height: 844, zoom: 100 } : { width: 1440, height: 900, zoom: 100 },
  motionMode: "REDUCED",
  failureVariant:
    id === "N" ? "SYNTHETIC_COMMUNITY_DEPENDENCY_UNAVAILABLE" : id === "I" ? "MALFORMED_AND_EXPIRED_TOKEN" : null,
  expectedFinalState: finalState,
  resetPolicy: "RECREATE_CLONE_FROM_IMMUTABLE_SEED",
  evidenceIds: captureSuffix[id].map((suffix) => `HP-P7-EV-${id}-${suffix}`),
  testContractIds: [
    `homeport.phase7.journey-${id.toLocaleLowerCase("en-US")}`,
    "homeport.phase7.evidence-source-binding",
  ],
  sourceSha,
  result,
  limitations: [],
}));

const fixtureManifest = {
  schemaVersion: "1.0.0",
  fixtureVersion,
  classification: "SYNTHETIC_TEST_DATA",
  sourceSha,
  aliases: fixtureAliases.map((alias) => ({ alias, credentialLocation: "EXTERNAL_TASK_OWNED_HANDOFF" })),
  requiredData: [
    "PUBLIC_CHRONICLES",
    "PLAYABLE_CHRONICLE",
    "PLAYER_PLAYTHROUGH",
    "CAPTAIN_SESSION",
    "CAPTAIN_INVITATIONS",
    "CREATOR_STUDIO_CHRONICLE_AND_VERSION",
    "PUBLIC_CREATOR_PROFILE",
    "PROFILE_WITH_MEDIA",
    "PROFILE_WITHOUT_MEDIA",
    "PERSONAL_HARBOR_PREFERENCES_AND_PRIVACY",
    "HISTORY",
    "MEMORY",
    "ARTIFACT",
    "SAVED_COMMUNITY_CONTENT",
    "COMMUNITY_DISTRICTS",
    "COLLECTION",
    "GUIDE",
    "VOYAGE_LOG",
    "CURRENT_AND_OTHER_SESSIONS",
    "RESTRICTED_CAPABILITY",
    "PERMISSION_DENIAL",
    "EXPIRED_SESSION",
    "PASSWORD_RESET_TOKEN",
    "VERIFICATION_TOKEN",
    "INVITATION_TOKEN",
    "DEPENDENCY_FAILURE",
    "EMPTY_STATES",
  ],
  roots: ["IMMUTABLE_SEED", "AUTOMATED_JOURNEY_CLONES", "FINAL_WALKTHROUGH_CLONE"],
  privacyAssertions: [
    "SYNTHETIC_NAMES_ONLY",
    "RESERVED_EMAIL_DOMAINS_ONLY",
    "SYNTHETIC_MEDIA_ONLY",
    "FICTIONAL_LOCATIONS_ONLY",
    "NO_PRIVATE_CHRONICLE_PROSE",
    "NO_ACCEPTED_REAL_ANSWERS",
    "NO_OBJECT_KEYS",
    "NO_COMMITTED_SECRETS",
  ],
  resetPolicy: "Recreate a task-owned clone from the immutable accepted seed.",
};

const runtimeContract = {
  schemaVersion: "1.0.0",
  fixtureVersion,
  sourceSha,
  productionRuntime: true,
  host: "127.0.0.1",
  preferredPort: 3717,
  databaseClass: "FINAL_WALKTHROUGH_CLONE",
  credentialClass: "EXTERNAL_TASK_OWNED_HANDOFF",
  commands: {
    prepare: "npm run homeport:phase7:walkthrough:prepare",
    start: "npm run homeport:phase7:walkthrough:start",
    status: "npm run homeport:phase7:walkthrough:status",
    reset: "npm run homeport:phase7:walkthrough:reset",
    stop: "npm run homeport:phase7:walkthrough:stop",
  },
  safety: ["REJECT_CANONICAL_DATABASE", "VERIFY_PORT_OWNER", "STOP_OWNED_PID_ONLY", "BOUNDED_NON_SECRET_STATUS"],
  retention: "ONE_FINAL_WALKTHROUGH_RUNTIME_AFTER_SUCCESS",
};

await mkdir(projectRoot, { recursive: true });
await writeJson("Project_Homeport_Phase_7_Integrated_Journey_Registry.json", {
  schemaVersion: "1.0.0",
  fixtureVersion,
  sourceSha,
  journeys,
});
await writeJson("Project_Homeport_Phase_7_Integrated_Fixture_Manifest.json", fixtureManifest);
await writeJson("Project_Homeport_Phase_7_Walkthrough_Runtime_Contract.json", runtimeContract);
await writeCsv(
  "Project_Homeport_Phase_7_Test_Account_Matrix.csv",
  ["alias", "fixture_account_id", "roles", "starting_state", "credential_location", "private_real_content"],
  fixtureAliases.map((alias) => [
    alias,
    accountId(alias),
    roles(alias),
    accountState(alias),
    "EXTERNAL_TASK_OWNED_HANDOFF",
    "NO",
  ]),
);
await writeCsv(
  "Project_Homeport_Phase_7_Journey_State_Matrix.csv",
  ["journey_id", "sequence", "route", "account_state", "mutation", "expected_state", "source_sha", "result"],
  journeys.flatMap((journey) =>
    journey.routeMilestones.map((route, index) => [
      journey.journeyId,
      index + 1,
      route,
      journey.accountStateAssertions[0],
      journey.mutationMilestones[index] ?? "NONE",
      index === journey.routeMilestones.length - 1 ? journey.expectedFinalState : "ORIENTED_IN_PRODUCT",
      sourceSha,
      result,
    ]),
  ),
);
await writeCsv(
  "Project_Homeport_Phase_7_Journey_Evidence_Matrix.csv",
  [
    "evidence_id",
    "journey_id",
    "fixture_clone",
    "viewport",
    "motion_mode",
    "source_sha",
    "result",
    "screenshot_location",
  ],
  journeys.flatMap((journey) =>
    journey.evidenceIds.map((evidenceId) => [
      evidenceId,
      journey.journeyId,
      journey.fixtureClone,
      `${journey.viewport.width}x${journey.viewport.height}@${journey.viewport.zoom}`,
      journey.motionMode,
      sourceSha,
      result,
      `evidence/phase7/screenshots/${evidenceId}.png`,
    ]),
  ),
);
await writeCsv(
  "Project_Homeport_Phase_7_Failure_and_Recovery_Matrix.csv",
  [
    "case_id",
    "journey_id",
    "starting_state",
    "failure",
    "visible_state",
    "recovery_control",
    "expected_final_state",
    "source_sha",
    "result",
  ],
  [
    [
      "HP-P7-FR-01",
      "I",
      "RECOVERY_ACCOUNT",
      "MALFORMED_RESET_TOKEN",
      "INVALID_TOKEN",
      "Return to Sign In",
      "RECOVERY_AVAILABLE",
      sourceSha,
      result,
    ],
    [
      "HP-P7-FR-02",
      "I",
      "RECOVERY_ACCOUNT",
      "EXPIRED_RESET_TOKEN",
      "EXPIRED_TOKEN",
      "Request another link",
      "RECOVERY_AVAILABLE",
      sourceSha,
      result,
    ],
    [
      "HP-P7-FR-03",
      "J",
      "AUTHENTICATED",
      "SESSION_EXPIRED",
      "SESSION_EXPIRED_NOT_ANONYMOUS",
      "Sign In",
      "SAFE_RETURN_RESTORED",
      sourceSha,
      result,
    ],
    [
      "HP-P7-FR-04",
      "K",
      "AUTHENTICATED_PLAYER",
      "MISSING_MODERATOR_CAPABILITY",
      "PERMISSION_REQUIRED",
      "Community Harbor",
      "AUTHENTICATED_SAFE_PARENT",
      sourceSha,
      result,
    ],
    [
      "HP-P7-FR-05",
      "N",
      "ANONYMOUS",
      "DEPENDENCY_UNAVAILABLE",
      "RECOVERABLE_ERROR",
      "Try again",
      "COMMUNITY_STABLE",
      sourceSha,
      result,
    ],
  ],
);
await writeCsv(
  "Project_Homeport_Phase_7_Visual_Comparison_Matrix.csv",
  ["comparison_id", "journey_id", "phase6_baseline_role", "phase7_milestone", "comparison", "source_sha", "result"],
  journeys.map((journey) => [
    `HP-P7-VC-${journey.journeyId}`,
    journey.journeyId,
    "COMPARISON_INPUT_ONLY",
    journey.evidenceIds[0],
    "NO_UNEXPLAINED_REGRESSION_PENDING_HUMAN_REVIEW",
    sourceSha,
    result,
  ]),
);
process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_MODEL_APPLIED", sourceSha, result, journeys: journeys.length })}\n`,
);

async function writeJson(name, value) {
  await writeFile(path.join(projectRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeCsv(name, header, rows) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  await writeFile(
    path.join(projectRoot, name),
    `${[header, ...rows].map((row) => row.map(escape).join(",")).join("\n")}\n`,
    "utf8",
  );
}

function accountId(alias) {
  return (
    {
      RETURNING_FULL_CAPABILITY: "hp4-account-creator",
      PLAYER_ONLY: "hp4-account-player",
      MODERATOR: "hp4-account-moderator",
      RESTRICTED_ACCOUNT: "hp4-account-restricted",
      CAPTAIN_ONLY: "hp7-account-captain-only",
      CREATOR_ONLY: "hp7-account-creator-only",
      EXPIRED_SESSION_ACCOUNT: "hp7-account-expired-session",
      RECOVERY_ACCOUNT: "hp7-account-recovery",
      EMPTY_NEW_ACCOUNT: "hp7-account-empty-new",
    }[alias] ?? "CREATED_OR_NONE"
  );
}

function roles(alias) {
  return (
    {
      RETURNING_FULL_CAPABILITY: "PLAYER|CAPTAIN|CREATOR",
      PLAYER_ONLY: "PLAYER",
      CAPTAIN_ONLY: "CAPTAIN",
      CREATOR_ONLY: "CREATOR",
      MODERATOR: "MODERATOR",
      RESTRICTED_ACCOUNT: "PLAYER_RESTRICTED",
      EXPIRED_SESSION_ACCOUNT: "PLAYER",
      RECOVERY_ACCOUNT: "PLAYER",
      EMPTY_NEW_ACCOUNT: "PLAYER",
    }[alias] ?? "NONE"
  );
}

function accountState(alias) {
  if (alias === "ANONYMOUS" || alias === "REGISTRATION_CANDIDATE") return alias;
  if (alias === "RESTRICTED_ACCOUNT") return "SUSPENDED";
  if (alias === "EXPIRED_SESSION_ACCOUNT") return "ACTIVE_WITH_EXPIRY_VARIANT";
  return "ACTIVE";
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}
