import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { discoverDeviceLabHost, labTool } from "../device-lab/host";
import { deviceLabSourceIdentity } from "../device-lab/source";
import { createCrossdeckPhase2Packs } from "../../src/crossdeck/lab-phase2";
import { runDeviceLabScenario } from "../../src/device-lab/runner";
import { loadDeviceLabRegistry } from "../../src/device-lab/registry";

async function main() {
  const host = await discoverDeviceLabHost();
  const serial = process.env.CROSSDECK_ANDROID_SERIAL;
  const owned = process.env.CROSSDECK_ANDROID_OWNED === "1";
  const configured = Boolean(host.android.adb && host.android.emulator && serial?.startsWith("emulator-") && owned);
  await mkdir("artifacts/crossdeck-phase2", { recursive: true });
  await writeFile("artifacts/crossdeck-phase2/d2-host.json", JSON.stringify(host, null, 2));
  if (!configured) {
    const source = await deviceLabSourceIdentity();
    for (const id of ["crossdeck.surface-handoff", "crossdeck.phone-disconnect"] as const) {
      const packs = createCrossdeckPhase2Packs("D2", () => ({
        async execute() {
          return {
            assertions: [
              {
                id: "crossdeck.phase2.continuity",
                state: "UNSUPPORTED",
                reason: "No configured task-owned Android virtual device and Chrome CDP path",
              },
            ],
            unsupportedCapabilities: ["android-emulator"],
            artifacts: [],
          };
        },
        async cleanup() {
          return { result: "PASS", ownedResources: [], remainingResources: [] };
        },
      }));
      const receipt = await runDeviceLabScenario(packs, id, {
        source,
        baseSha: "7284b0dfaa31037d074d27df0f27b968f3977000",
        tier: "D2",
        profile: "android-emulator",
        hostOs: process.platform,
        runtimeVersion: process.version,
        capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === id)!.requiredCapabilities,
      });
      await writeFile(`artifacts/crossdeck-phase2/${id}-D2.json`, JSON.stringify(receipt, null, 2));
    }
    process.stdout.write("D2 UNSUPPORTED: task-owned Android emulator/ADB/Chrome not configured. D1 is not D2.\n");
    process.exitCode = 2;
  } else {
    const adb = host.android.adb!;
    if ((await labTool(adb, ["-s", serial!, "shell", "getprop", "ro.kernel.qemu"])).trim() !== "1")
      throw new Error("PHYSICAL_ANDROID_FORBIDDEN_FOR_D2");
    const port = process.env.CROSSDECK_TEST_PORT ?? "3172";
    const cdpPort = "9312";
    await labTool(adb, ["-s", serial!, "reverse", `tcp:${port}`, `tcp:${port}`]);
    await labTool(adb, [
      "-s",
      serial!,
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      `http://127.0.0.1:${port}`,
      "com.android.chrome",
    ]);
    await labTool(adb, ["-s", serial!, "forward", `tcp:${cdpPort}`, "localabstract:chrome_devtools_remote"]);
    try {
      execFileSync(process.execPath, ["scripts/crossdeck/run-phase2-browser.mjs"], {
        env: {
          ...process.env,
          CROSSDECK_ANDROID_CDP: `http://127.0.0.1:${cdpPort}`,
          CROSSDECK_ANDROID_VIRTUAL_VERIFIED: "1",
        },
        stdio: "inherit",
        timeout: 600000,
      });
    } finally {
      await labTool(adb, ["-s", serial!, "forward", "--remove", `tcp:${cdpPort}`]);
      await labTool(adb, ["-s", serial!, "reverse", "--remove", `tcp:${port}`]);
    }
  }
}
void main().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.message : "D2 execution failed"}\n`);
  process.exitCode = 1;
});
