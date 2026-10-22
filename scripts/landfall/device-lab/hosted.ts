import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { labTool } from "./host";
import { hostedDeviceLabProfiles, hostedDeviceLabScenarios } from "../../../src/landfall/device-lab/hosted-selection";
import { androidDeviceLabProvisioning } from "../../../src/landfall/device-lab/device-profile";
import { sextantConsumerPartition } from "./consumer-partitions";

const execute = promisify(execFile);
/** Ephemeral CI transport only. It never mutates the checkout, default branch, or protected testing authority. */
export async function dispatchLandfallHostedLab(
  candidate: string,
  root = process.cwd(),
  target = "all",
  tier = "development",
  selectedScenarios?: string,
  selectedProfiles?: string,
) {
  if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("LANDFALL_HOSTED_CANDIDATE_INVALID");
  const consumerPartition = sextantConsumerPartition(target);
  if (
    !consumerPartition &&
    ![
      "all",
      "provider",
      "browser",
      "sextant-consumers",
      "sextant-resources",
      "sextant-paired-clue",
      "sextant-community",
      "sextant-authoring-resources",
      "sextant-history",
      "sextant-catalog",
      "sextant-creator-entry",
      "sextant-admiralty",
      "sextant-private-content",
      "sextant-account-recovery",
      "sextant-invitation",
      "sextant-landfall",
      "sextant-entry",
      "android",
      "android-radio",
      "android-journal",
      "android-background",
      "ios",
      "ios-presentation",
      "ios-devices",
    ].includes(target)
  )
    throw new Error("LANDFALL_HOSTED_TARGET_INVALID");
  if (!["development", "candidate", "closure"].includes(tier)) throw new Error("LANDFALL_HOSTED_TIER_INVALID");
  if (
    target === "android-journal" &&
    selectedScenarios !== undefined &&
    selectedScenarios !== "first-party-native-journal-pair"
  )
    throw new Error("LANDFALL_HOSTED_JOURNAL_SCENARIO_INVALID");
  if (
    target === "android-background" &&
    selectedScenarios !== undefined &&
    !["first-party-native-background-return", "first-party-native-cold-session-diagnostic"].includes(selectedScenarios)
  )
    throw new Error("LANDFALL_HOSTED_BACKGROUND_SCENARIO_INVALID");
  if (
    selectedProfiles !== undefined &&
    ![
      "android",
      "android-radio",
      "android-journal",
      "android-background",
      "ios",
      "ios-presentation",
      "ios-devices",
    ].includes(target)
  )
    throw new Error("LANDFALL_HOSTED_PROFILE_TARGET_REQUIRED");
  const typedTier = tier as "development" | "candidate" | "closure";
  if (
    (consumerPartition ||
      [
        "sextant-consumers",
        "sextant-resources",
        "sextant-paired-clue",
        "sextant-community",
        "sextant-authoring-resources",
        "sextant-history",
        "sextant-catalog",
        "sextant-creator-entry",
        "sextant-admiralty",
        "sextant-private-content",
        "sextant-account-recovery",
        "sextant-invitation",
        "sextant-landfall",
        "sextant-entry",
      ].includes(target)) &&
    (tier !== "development" || selectedScenarios !== undefined || selectedProfiles !== undefined)
  )
    throw new Error("LANDFALL_HOSTED_SEXTANT_CONSUMERS_SCOPE_INVALID");
  if (
    target === "ios-devices" &&
    (tier !== "development" ||
      selectedScenarios !== undefined ||
      (selectedProfiles !== undefined && selectedProfiles !== "primary-phone"))
  )
    throw new Error("LANDFALL_HOSTED_APPLE_DEVICES_SCOPE_INVALID");
  const selectedAndroid = hostedDeviceLabProfiles(
    "android",
    typedTier,
    ["android", "android-radio", "android-journal", "android-background"].includes(target)
      ? selectedProfiles
      : undefined,
  );
  if (
    target === "ios-presentation" &&
    (tier !== "closure" ||
      selectedScenarios !== undefined ||
      (selectedProfiles !== undefined && selectedProfiles !== "primary-phone"))
  )
    throw new Error("LANDFALL_HOSTED_PRESENTATION_SCOPE_INVALID");
  const selectedApple = hostedDeviceLabProfiles(
    "ios",
    typedTier,
    ["ios-presentation", "ios-devices"].includes(target)
      ? "primary-phone"
      : target === "ios"
        ? selectedProfiles
        : undefined,
  );
  const androidProfiles = selectedAndroid.map(androidDeviceLabProvisioning);
  const appleProfiles = selectedApple;
  const radioProfiles = selectedAndroid.filter((profile) => ["primary-phone", "low-resource"].includes(profile));
  if (
    ["android-radio", "android-journal", "android-background"].includes(target) &&
    (radioProfiles.length === 0 || (selectedProfiles !== undefined && radioProfiles.length !== selectedAndroid.length))
  )
    throw new Error("LANDFALL_HOSTED_RADIO_PROFILE_UNSUPPORTED");
  await labTool("git", ["cat-file", "-e", `${candidate}^{commit}`]);
  const template = await labTool("git", ["show", `${candidate}:.agents/landfall-device-lab-hosted.yml`]);
  const workflow = template
    .replaceAll("__CANDIDATE_SHA12__", candidate.slice(0, 12))
    .replaceAll("__CANDIDATE_SHA__", candidate)
    .replaceAll("__RUN_PROVIDERS__", String(target === "all" || target === "provider"))
    .replaceAll(
      "__RUN_BROWSER__",
      String(
        !!consumerPartition ||
          [
            "all",
            "browser",
            "sextant-consumers",
            "sextant-resources",
            "sextant-paired-clue",
            "sextant-community",
            "sextant-authoring-resources",
            "sextant-history",
            "sextant-catalog",
            "sextant-creator-entry",
            "sextant-admiralty",
            "sextant-private-content",
            "sextant-account-recovery",
            "sextant-invitation",
            "sextant-landfall",
            "sextant-entry",
          ].includes(target),
      ),
    )
    .replaceAll(
      "__BROWSER_JOB_NAME__",
      consumerPartition?.jobName ??
        (target === "sextant-consumers"
          ? "Sextant ordinary consumer journeys (development)"
          : target === "sextant-resources"
            ? "Sextant Captain and Creator resources (development)"
            : target === "sextant-paired-clue"
              ? "Sextant distinct Creator and Crew clue comparison (development)"
              : target === "sextant-community"
                ? "Sextant ordinary public Community journeys (development)"
                : target === "sextant-authoring-resources"
                  ? "Sextant owned Creator authoring resources (development)"
                  : target === "sextant-history"
                    ? "Sextant completed historical Passport journeys (development)"
                    : target === "sextant-catalog"
                      ? "Sextant public catalog, editions and compatibility preparation (development)"
                      : target === "sextant-creator-entry"
                        ? "Sextant ordinary Creator new Chronicle entry (development)"
                        : target === "sextant-admiralty"
                          ? "Sextant ordinary Admiralty dossier and ungranted support (development)"
                          : target === "sextant-private-content"
                            ? "Sextant synthetic private package import and verified export (development)"
                            : target === "sextant-account-recovery"
                              ? "Sextant synthetic account verification, recovery and reversible lifecycle (development)"
                              : target === "sextant-invitation"
                                ? "Sextant issued invitations and synthetic guest claim/merge (development)"
                                : target === "sextant-landfall"
                                  ? "Sextant populated physical and virtual Landfall consumers (development)"
                                  : target === "sextant-entry"
                                    ? "Sextant existing Display and unprepared pilot entry (development)"
                                    : "optimized first-party Phase 4"),
    )
    .replaceAll(
      "__BROWSER_SUITE__",
      consumerPartition ||
        [
          "sextant-consumers",
          "sextant-resources",
          "sextant-paired-clue",
          "sextant-community",
          "sextant-authoring-resources",
          "sextant-history",
          "sextant-catalog",
          "sextant-creator-entry",
          "sextant-admiralty",
          "sextant-private-content",
          "sextant-account-recovery",
          "sextant-invitation",
          "sextant-landfall",
          "sextant-entry",
        ].includes(target)
        ? target
        : "landfall",
    )
    .replaceAll("__RUN_APPLE__", String(target === "all" || target === "ios"))
    .replaceAll("__RUN_APPLE_DEVICES__", String(target === "ios-devices"))
    .replaceAll(
      "__RUN_APPLE_PRESENTATION__",
      String(
        tier === "closure" &&
          ["all", "ios", "ios-presentation"].includes(target) &&
          appleProfiles.includes("primary-phone"),
      ),
    )
    // A separate primary-only OS notice job keeps closure coverage explicit
    // without repeating its permission/wake/tap sequence on every profile.
    .replaceAll(
      "__RUN_APPLE_NOTICE__",
      String(
        tier === "closure" &&
          (target === "all" || target === "ios") &&
          selectedScenarios === undefined &&
          selectedProfiles === undefined,
      ),
    )
    .replaceAll("__RUN_ANDROID__", String(target === "all" || target === "android"))
    .replaceAll("__RUN_ANDROID_RADIO__", String(target === "all" || target === "android-radio"))
    .replaceAll("__RUN_ANDROID_JOURNAL__", String(target === "all" || target === "android-journal"))
    .replaceAll("__RUN_ANDROID_BACKGROUND__", String(target === "all" || target === "android-background"))
    .replaceAll(
      "__COLD_SESSION_DIAGNOSTIC__",
      String(target === "android-background" && selectedScenarios === "first-party-native-cold-session-diagnostic"),
    )
    // GitHub validates even disabled job matrices; an empty matrix aborts the
    // entire workflow before any selected scenario executes. The placeholder
    // remains disabled for ordinary Android compatibility/tablet-only runs.
    .replaceAll("__ANDROID_RADIO_PROFILES__", JSON.stringify(radioProfiles.length ? radioProfiles : ["primary-phone"]))
    .replaceAll("__ANDROID_PROFILES__", JSON.stringify(androidProfiles))
    .replaceAll("__APPLE_PROFILES__", JSON.stringify(appleProfiles));
  const scenarios = {
    appleDevices: target === "ios-devices" ? ["sextant-native-apple-devices"] : [],
    browser:
      consumerPartition?.scenarios ??
      (target === "sextant-consumers"
        ? ["sextant-consumer-journeys", "sextant-contextual-entry-journeys"]
        : target === "sextant-resources"
          ? ["sextant-resource-journeys"]
          : target === "sextant-paired-clue"
            ? ["sextant-parallax-paired-journeys"]
            : target === "sextant-community"
              ? ["sextant-community-journeys"]
              : target === "sextant-authoring-resources"
                ? ["sextant-authoring-resource-journeys"]
                : target === "sextant-history"
                  ? ["sextant-history-journeys"]
                  : target === "sextant-catalog"
                    ? ["sextant-catalog-journeys"]
                    : target === "sextant-creator-entry"
                      ? ["sextant-creator-entry-journeys"]
                      : target === "sextant-admiralty"
                        ? ["sextant-admiralty-journeys"]
                        : target === "sextant-private-content"
                          ? ["sextant-private-content-journeys"]
                          : target === "sextant-account-recovery"
                            ? ["sextant-account-recovery-journeys"]
                            : target === "sextant-invitation"
                              ? ["sextant-invitation-journeys"]
                              : target === "sextant-landfall"
                                ? ["sextant-landfall-journeys"]
                                : target === "sextant-entry"
                                  ? ["sextant-entry-journeys"]
                                  : target === "browser" || target === "all"
                                    ? ["first-party-phase4-web"]
                                    : []),
    journal: target === "android-journal" || target === "all" ? ["first-party-native-journal-pair"] : [],
    background:
      target === "android-background" || target === "all"
        ? [
            target === "android-background"
              ? (selectedScenarios ?? "first-party-native-background-return")
              : "first-party-native-background-return",
          ]
        : [],
    radio: hostedDeviceLabScenarios("android-radio", target === "android-radio" ? selectedScenarios : undefined),
    ios: hostedDeviceLabScenarios("ios", target === "ios" || target === "all" ? selectedScenarios : undefined),
    android: hostedDeviceLabScenarios(
      "android",
      target === "android" || target === "all" ? selectedScenarios : undefined,
    ),
    provider: hostedDeviceLabScenarios(
      "provider",
      target === "provider" || target === "all" ? selectedScenarios : undefined,
    ),
  };
  const selectedWorkflow = workflow
    .replaceAll("__APPLE_SCENARIOS__", scenarios.ios)
    .replaceAll("__ANDROID_SCENARIOS__", scenarios.android)
    .replaceAll("__PROVIDER_SCENARIOS__", scenarios.provider)
    .replaceAll("__RADIO_SCENARIOS__", scenarios.radio);
  const runId = `${candidate.slice(0, 12)}-${Date.now()}`;
  const destination = path.join(root, "artifacts", "landfall-device-lab", `hosted-${runId}`);
  await mkdir(destination, { recursive: true });
  const workflowFile = path.join(destination, "workflow.yml");
  await writeFile(workflowFile, selectedWorkflow);
  const index = path.join(destination, "owned-index");
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const git = async (args: string[]) =>
    (await execute("git", args, { cwd: root, env, windowsHide: true, maxBuffer: 1024 * 1024 })).stdout.trim();
  try {
    await git(["read-tree", candidate]);
    const blob = await git(["hash-object", "-w", workflowFile]);
    await git(["update-index", "--add", "--cacheinfo", `100644,${blob},.github/workflows/landfall-device-lab.yml`]);
    const tree = await git(["write-tree"]);
    const commit = await git(["commit-tree", tree, "-p", candidate, "-m", `Run Landfall Device Lab for ${candidate}`]);
    const branch = `codex/landfall-lab-${runId}`;
    await labTool("git", ["push", "origin", `${commit}:refs/heads/${branch}`], 120000);
    const receipt = {
      version: 1,
      candidateSha: candidate,
      target,
      tier,
      profiles: { android: androidProfiles, apple: appleProfiles },
      scenarios,
      transportSha: commit,
      transportTree: tree,
      branch,
      workflow: "landfall-device-lab.yml",
      createdAt: new Date().toISOString(),
      cleanup: "PENDING",
    };
    await writeFile(path.join(destination, "dispatch.json"), JSON.stringify(receipt, null, 2));
    return receipt;
  } finally {
    await rm(index, { force: true });
  }
}

if (process.argv[1]?.endsWith("hosted.ts")) {
  const candidate = process.argv[2] ?? "";
  dispatchLandfallHostedLab(
    candidate,
    process.cwd(),
    process.argv[3] ?? "all",
    process.argv[4] ?? "development",
    process.argv[5],
    process.argv[6],
  )
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`))
    .catch(() => {
      process.stderr.write("LANDFALL_HOSTED_DISPATCH_FAILED\n");
      process.exitCode = 1;
    });
}
