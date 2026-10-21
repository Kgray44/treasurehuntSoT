import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { labTool } from "./host";
import { hostedDeviceLabProfiles, hostedDeviceLabScenarios } from "../../../src/landfall/device-lab/hosted-selection";
import { androidDeviceLabProvisioning } from "../../../src/landfall/device-lab/device-profile";
import {
  androidGraphicsProbeBackend,
  androidGraphicsProbeMetadata,
  androidGraphicsProbeTemplate,
  validateAndroidGraphicsProbeTransport,
} from "./android-graphics-probe";

const execute = promisify(execFile);
type HostedIosRunner = "macos-latest" | "macos-26" | "macos-26-intel";
const appleJobs = ["apple", "apple-notice", "apple-presentation"] as const;

/** A platform-only transport option cannot redirect other Device Lab targets. */
export function hostedIosRunnerLabel(value: unknown, target: unknown): HostedIosRunner | undefined {
  if (value === undefined) return undefined;
  if (value !== "macos-latest" && value !== "macos-26" && value !== "macos-26-intel")
    throw new Error("LANDFALL_HOSTED_IOS_RUNNER_INVALID");
  if (target !== "ios" && target !== "ios-presentation") throw new Error("LANDFALL_HOSTED_IOS_RUNNER_TARGET_REQUIRED");
  return value;
}

function appleJobRunner(workflow: string, job: (typeof appleJobs)[number]) {
  const jobs = [...workflow.matchAll(new RegExp(`^  ${job}:\\r?\\n`, "gm"))];
  if (jobs.length !== 1) throw new Error("LANDFALL_HOSTED_IOS_RUNNER_TEMPLATE_AMBIGUOUS");
  const start = jobs[0].index! + jobs[0][0].length;
  const next = /^  [A-Za-z0-9_-]+:\r?$/m.exec(workflow.slice(start));
  const end = next ? start + next.index : workflow.length;
  const labels = [...workflow.slice(start, end).matchAll(/^    runs-on: ([a-z0-9-]+)\r?$/gm)];
  if (labels.length !== 1) throw new Error("LANDFALL_HOSTED_IOS_RUNNER_TEMPLATE_INVALID");
  return { label: labels[0][1], offset: start + labels[0].index! + "    runs-on: ".length };
}

/** Preserve every byte except the three existing Apple jobs' runner labels. */
export function hostedIosRunnerTemplate(template: string, requested: HostedIosRunner | undefined): string {
  const runner = hostedIosRunnerLabel(requested, "ios");
  if (runner === undefined) return template;
  let workflow = template;
  for (const job of appleJobs) {
    const { label, offset } = appleJobRunner(workflow, job);
    if (label !== "macos-latest") throw new Error("LANDFALL_HOSTED_IOS_RUNNER_TEMPLATE_INVALID");
    workflow = workflow.slice(0, offset) + runner + workflow.slice(offset + label.length);
  }
  return workflow;
}

export function hostedIosRunnerMetadata(runner: HostedIosRunner | undefined, workflow: string) {
  if (runner === undefined) return undefined;
  hostedIosRunnerLabel(runner, "ios");
  if (appleJobs.some((job) => appleJobRunner(workflow, job).label !== runner))
    throw new Error("LANDFALL_HOSTED_IOS_RUNNER_WORKFLOW_INVALID");
  return {
    kind: "HOSTED_IOS_RUNNER_SELECTION_ONLY" as const,
    requested: runner,
    effective: runner,
    jobs: [...appleJobs],
    expectedArchitecture: runner === "macos-26-intel" ? "x64" : "arm64",
    actualEnvironmentObserved: false,
    workflowSha256: createHash("sha256").update(workflow).digest("hex"),
    limits: [
      "Runner selection is not execution, graphics, canonical acceptance or physical-device evidence.",
      "Host discovery and the complete selected suite must run on this environment; prior ARM results cannot qualify Intel.",
    ],
  };
}

/** Keep the legacy positionals while making the alternate runner explicit. */
export function parseHostedLabArguments(args: readonly string[]) {
  const positional: string[] = [];
  let iosRunner: HostedIosRunner | undefined;
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (value === "--ios-runner") {
      if (iosRunner !== undefined || index + 1 >= args.length)
        throw new Error("LANDFALL_HOSTED_IOS_RUNNER_ARGUMENT_INVALID");
      const selected = args[++index];
      if (selected !== "macos-latest" && selected !== "macos-26" && selected !== "macos-26-intel")
        throw new Error("LANDFALL_HOSTED_IOS_RUNNER_INVALID");
      iosRunner = selected;
    } else {
      if (value.startsWith("--")) throw new Error("LANDFALL_HOSTED_ARGUMENT_INVALID");
      positional.push(value);
    }
  }
  if (positional.length > 6) throw new Error("LANDFALL_HOSTED_ARGUMENT_INVALID");
  return { positional, iosRunner: hostedIosRunnerLabel(iosRunner, positional[1] ?? "all") };
}

/** Ephemeral CI transport only. It never mutates the checkout, default branch, or protected testing authority. */
export async function dispatchLandfallHostedLab(
  candidate: string,
  root = process.cwd(),
  target = "all",
  tier = "development",
  selectedScenarios?: string,
  selectedProfiles?: string,
  graphicsBackend?: string,
  iosRunner?: string,
) {
  if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("LANDFALL_HOSTED_CANDIDATE_INVALID");
  if (
    ![
      "all",
      "provider",
      "browser",
      "android",
      "android-radio",
      "android-journal",
      "android-background",
      "ios",
      "ios-presentation",
    ].includes(target)
  )
    throw new Error("LANDFALL_HOSTED_TARGET_INVALID");
  if (!["development", "candidate", "closure"].includes(tier)) throw new Error("LANDFALL_HOSTED_TIER_INVALID");
  const appleRunner = hostedIosRunnerLabel(iosRunner, target);
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
    !["android", "android-radio", "android-journal", "android-background", "ios", "ios-presentation"].includes(target)
  )
    throw new Error("LANDFALL_HOSTED_PROFILE_TARGET_REQUIRED");
  const typedTier = tier as "development" | "candidate" | "closure";
  const selectedAndroid = hostedDeviceLabProfiles(
    "android",
    typedTier,
    ["android", "android-radio", "android-journal", "android-background"].includes(target)
      ? selectedProfiles
      : undefined,
  );
  const probeBackend = androidGraphicsProbeBackend(graphicsBackend, target, tier, selectedAndroid);
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
    target === "ios-presentation" ? "primary-phone" : target === "ios" ? selectedProfiles : undefined,
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
  const workflow = hostedIosRunnerTemplate(androidGraphicsProbeTemplate(template, probeBackend), appleRunner)
    .replaceAll("__CANDIDATE_SHA12__", candidate.slice(0, 12))
    .replaceAll("__CANDIDATE_SHA__", candidate)
    .replaceAll("__RUN_PROVIDERS__", String(target === "all" || target === "provider"))
    .replaceAll("__RUN_BROWSER__", String(target === "all" || target === "browser"))
    .replaceAll("__RUN_APPLE__", String(target === "all" || target === "ios"))
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
    browser: target === "browser" || target === "all" ? ["first-party-phase4-web"] : [],
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
  const graphicsProbe = androidGraphicsProbeMetadata(probeBackend, selectedWorkflow);
  const iosRunnerSelection = hostedIosRunnerMetadata(appleRunner, selectedWorkflow);
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
    if (graphicsProbe)
      validateAndroidGraphicsProbeTransport(
        graphicsProbe,
        template,
        selectedWorkflow,
        (await git(["diff", "--name-only", candidate, commit])).split(/\r?\n/),
      );
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
      ...(graphicsProbe ? { graphicsProbe } : {}),
      ...(iosRunnerSelection ? { iosRunner: iosRunnerSelection } : {}),
    };
    await writeFile(path.join(destination, "dispatch.json"), JSON.stringify(receipt, null, 2));
    return receipt;
  } finally {
    await rm(index, { force: true });
  }
}

if (process.argv[1]?.endsWith("hosted.ts")) {
  Promise.resolve()
    .then(() => {
      const { positional, iosRunner } = parseHostedLabArguments(process.argv.slice(2));
      return dispatchLandfallHostedLab(
        positional[0] ?? "",
        process.cwd(),
        positional[1] ?? "all",
        positional[2] ?? "development",
        positional[3],
        positional[4],
        positional[5],
        iosRunner,
      );
    })
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`))
    .catch(() => {
      process.stderr.write("LANDFALL_HOSTED_DISPATCH_FAILED\n");
      process.exitCode = 1;
    });
}
