import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, realpath, rm, readdir, readlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverDeviceLabHost, labTool } from "./host";
import { deviceLabSourceIdentity } from "./source";
import { hostedDeviceLabScenarios } from "../../../src/landfall/device-lab/hosted-selection";
import { ownedAdbListeningInodes } from "../../../src/landfall/device-lab/owned-adb-socket";

type OwnedProcess = { pid: number; started: string; executable: string };
export type OwnedAndroidRadioPair = {
  adbPath: string;
  adbPort: number;
  serials: readonly string[];
  apkPath: string;
  artifactDirectory: string;
  signal: AbortSignal;
};
type JournalExecutor = {
  kind: "PRODUCTION_JOURNAL_PAIR" | "PRODUCTION_BACKGROUND_RETURN";
  execute(resources: OwnedAndroidRadioPair): Promise<void>;
};
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Linux /proc identities prevent a recycled PID from authorizing process cleanup. */
async function identity(pid: number): Promise<OwnedProcess | null> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return { pid, started: fields[19], executable: await realpath(`/proc/${pid}/exe`) };
  } catch {
    return null;
  }
}
async function availableMemory() {
  const memory = await readFile("/proc/meminfo", "utf8");
  const value = /MemAvailable:\s+(\d+)\s+kB/.exec(memory);
  if (!value) throw new Error("LANDFALL_RADIO_MEMORY_UNKNOWN");
  return Number(value[1]) * 1024;
}
async function adbListenerInodes() {
  return ownedAdbListeningInodes(
    await Promise.all(["tcp", "tcp6"].map((table) => readFile(`/proc/net/${table}`, "utf8"))),
    5038,
  );
}
async function holdsListener(pid: number, listeners: Set<string>) {
  for (const descriptor of await readdir(`/proc/${pid}/fd`).catch(() => [])) {
    const target = await readlink(`/proc/${pid}/fd/${descriptor}`).catch(() => "");
    const inode = /^socket:\[([0-9]+)\]$/.exec(target)?.[1];
    if (inode && listeners.has(inode)) return true;
  }
  return false;
}
async function freePort(port: number) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
async function radioProcesses(sdk: string) {
  const lines = (await labTool("ps", ["-eo", "pid=,args="])).split("\n");
  const values: OwnedProcess[] = [];
  for (const line of lines) {
    const pid = Number(/^\s*(\d+)\s/.exec(line)?.[1]);
    if (!pid || !line.includes(`${sdk}/emulator/`)) continue;
    const value = await identity(pid);
    if (value && value.executable.startsWith(`${sdk}/emulator/`)) values.push(value);
  }
  return values;
}

/** Builds must finish before this bounded, exclusively owned ephemeral-runner backend starts. */
export async function runLandfallAndroidRadioLab(journal?: JournalExecutor) {
  const radioScenarios = hostedDeviceLabScenarios("android-radio", process.env.LANDFALL_LAB_RADIO_SCENARIOS);
  if (process.platform !== "linux" || process.env.GITHUB_ACTIONS !== "true")
    throw new Error("LANDFALL_RADIO_EPHEMERAL_LINUX_REQUIRED");
  const host = await discoverDeviceLabHost();
  if (!host.android.adb || !host.android.emulator) throw new Error("LANDFALL_RADIO_SDK_REQUIRED");
  const sdk = await realpath(path.dirname(path.dirname(host.android.adb)));
  if ((await radioProcesses(sdk)).length) throw new Error("LANDFALL_RADIO_RUNNER_ALREADY_ACTIVE");
  const source = await deviceLabSourceIdentity();
  const runId = randomUUID();
  const destination = path.join(process.cwd(), "artifacts/landfall-device-lab", `radio-owner-${runId}`);
  const avdHome = path.join(destination, "avd");
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(destination);
  await mkdir(avdHome);
  const apk = path.join(process.cwd(), "native/android/app/build/outputs/apk/debug/app-debug.apk");
  const apkSha256 = createHash("sha256")
    .update(await readFile(apk))
    .digest("hex");
  const profile = process.env.LANDFALL_LAB_PROFILE ?? "low-resource";
  if (!["low-resource", "primary-phone"].includes(profile)) throw new Error("LANDFALL_RADIO_PROFILE_UNSUPPORTED");
  const memoryBudget = {
    minimumTotalBytes: 12 * 1024 ** 3,
    minimumAvailableBytes: 7 * 1024 ** 3,
    stopBelowBytes: 1536 * 1024 ** 2,
    emulatorMemoryMiB: 1536,
  };
  const memorySamples: { at: string; availableBytes: number }[] = [];
  const owned = new Map<number, OwnedProcess>();
  const children: ChildProcess[] = [];
  const processGroups = new Set<number>();
  const persistLogs: (() => Promise<void>)[] = [];
  const logs: string[] = [];
  const remainingResources: string[] = [];
  const ports = [5038, 5580, 5581, 5582, 5583];
  // Background return owns one phone; peer negotiation owns two.
  const deviceCount = journal?.kind === "PRODUCTION_BACKGROUND_RETURN" ? 1 : 2;
  const serials = Array.from({ length: deviceCount }, (_, index) => `emulator-${5580 + index * 2}`);
  const names = serials.map((_, index) => `landfall_radio_${runId.replaceAll("-", "")}_${index}`);
  const env = {
    ...process.env,
    ANDROID_AVD_HOME: avdHome,
    ADB_SERVER_SOCKET: "tcp:127.0.0.1:5038",
    ANDROID_ADB_SERVER_PORT: "5038",
    LANDFALL_LAB_ADB_PORT: "5038",
    LANDFALL_LAB_ANDROID_SERIAL: serials[0],
    LANDFALL_LAB_ANDROID_PEER_SERIAL: serials[1],
  };
  let guard: ReturnType<typeof setInterval> | undefined;
  let memoryViolated = false;
  let guardBusy = false;
  let result = "FAIL";
  let failure: string | null = null;
  let adbOwned = false;
  let lab: ChildProcess | undefined;
  const executorAbort = new AbortController();
  let executorTimer: ReturnType<typeof setTimeout> | undefined;
  const adb = (args: string[]) => labTool(host.android.adb!, ["-P", "5038", ...args], 15000);
  const sample = async () => {
    const availableBytes = await availableMemory();
    memorySamples.push({ at: new Date().toISOString(), availableBytes });
    return availableBytes;
  };
  const remember = async () => {
    for (const process of await radioProcesses(sdk)) if (!owned.has(process.pid)) owned.set(process.pid, process);
    // A late owned client can restart the private ADB server after its original
    // launcher exits. Its daemon leaves that process group. Require both the
    // exact SDK executable and this run's previously-vacant private socket.
    if (adbOwned) {
      const adbExecutable = await realpath(host.android.adb!);
      const listeners = await adbListenerInodes();
      for (const line of (await labTool("ps", ["-eo", "pid=,args="])).split("\n")) {
        const pid = Number(/^\s*(\d+)\s/.exec(line)?.[1]);
        const value = pid ? await identity(pid) : null;
        if (!value || value.executable !== adbExecutable || owned.has(pid)) continue;
        if (await holdsListener(pid, listeners)) owned.set(pid, value);
      }
    }
    for (const line of (await labTool("ps", ["-eo", "pid=,pgid="])).split("\n")) {
      const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
      if (!match || !processGroups.has(Number(match[2]))) continue;
      const process = await identity(Number(match[1]));
      if (process && !owned.has(process.pid)) owned.set(process.pid, process);
    }
  };
  const terminate = async (process: OwnedProcess, signal: NodeJS.Signals) => {
    const current = await identity(process.pid);
    if (current && current.started === process.started && current.executable === process.executable)
      try {
        global.process.kill(process.pid, signal);
      } catch {
        /* disappearance is verified below */
      }
  };
  const interruptExecutor = async () => {
    executorAbort.abort();
    if (lab && lab.exitCode === null) lab.kill("SIGTERM");
    for (const value of owned.values())
      if (value.executable.startsWith(`${sdk}/emulator/`)) await terminate(value, "SIGTERM");
  };
  const start = async (command: string, args: string[], logName: string, processEnv = env) => {
    const child = spawn(command, args, {
      env: processEnv,
      cwd: process.cwd(),
      windowsHide: true,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    let output = "";
    const record = (data: Buffer) => {
      if (output.length < 2 * 1024 * 1024) output += data.toString();
    };
    child.stdout!.on("data", record);
    child.stderr!.on("data", record);
    child.on("error", () => {
      output += "\nLANDFALL_OWNED_PROCESS_START_FAILED";
    });
    logs.push(logName);
    const persist = () => writeFile(path.join(destination, logName), output);
    persistLogs.push(persist);
    child.once("close", () => {
      void persist();
    });
    if (!child.pid) throw new Error("LANDFALL_RADIO_PROCESS_NOT_STARTED");
    processGroups.add(child.pid);
    const ownedIdentity = await identity(child.pid);
    if (ownedIdentity) owned.set(child.pid, ownedIdentity);
    return child;
  };
  try {
    if (os.totalmem() < memoryBudget.minimumTotalBytes || (await sample()) < memoryBudget.minimumAvailableBytes)
      throw new Error("LANDFALL_RADIO_HOST_MEMORY_INSUFFICIENT");
    for (const port of ports) await freePort(port);
    const avdManager = path.join(sdk, "cmdline-tools/latest/bin/avdmanager");
    for (const name of names) {
      // Fixed public SDK image, caller-owned AVD home; no shared AVD is modified.
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          avdManager,
          [
            "create",
            "avd",
            "--name",
            name,
            "--package",
            "system-images;android-36;google_apis;x86_64",
            "--device",
            "pixel_2",
          ],
          { env, stdio: ["pipe", "ignore", "pipe"] },
        );
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("LANDFALL_RADIO_AVD_TIMEOUT"));
        }, 60000);
        child.stdin.end("no\n");
        child.once("error", () => {
          clearTimeout(timer);
          reject(new Error("LANDFALL_RADIO_AVD_FAILED"));
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error("LANDFALL_RADIO_AVD_FAILED"));
        });
      });
    }
    const adbServer = await start(host.android.adb, ["-L", "tcp:5038", "server", "nodaemon"], "owned-adb.log");
    adbOwned = true;
    const adbDeadline = Date.now() + 15000;
    let adbReady = false;
    while (Date.now() < adbDeadline) {
      if (adbServer.exitCode !== null || adbServer.signalCode !== null)
        throw new Error("LANDFALL_OWNED_ADB_START_FAILED");
      adbReady = await holdsListener(adbServer.pid!, await adbListenerInodes());
      if (adbReady) break;
      await delay(100);
    }
    // A client issued before nodaemon binds can fork a competing daemon. Wait without an ADB client.
    if (!adbReady || adbServer.exitCode !== null || adbServer.signalCode !== null)
      throw new Error("LANDFALL_OWNED_ADB_START_TIMEOUT");
    await remember();
    await adb(["devices"]);
    guard = setInterval(() => {
      if (guardBusy) return;
      guardBusy = true;
      void sample()
        .then(async (bytes) => {
          await remember();
          if (bytes < memoryBudget.stopBelowBytes) {
            memoryViolated = true;
            await interruptExecutor();
          }
        })
        .catch(async () => {
          memoryViolated = true;
          await interruptExecutor();
        })
        .finally(() => {
          guardBusy = false;
        });
    }, 5000);
    for (const [index, name] of names.entries()) {
      if (memoryViolated) throw new Error("LANDFALL_RADIO_RESOURCE_BUDGET_EXCEEDED");
      const child = await start(
        host.android.emulator,
        [
          "-avd",
          name,
          "-port",
          String(5580 + index * 2),
          "-no-window",
          "-gpu",
          "swiftshader_indirect",
          "-no-snapshot",
          "-noaudio",
          "-no-boot-anim",
          "-memory",
          "1536",
          "-lowram",
          "-feature",
          "-Vulkan",
        ],
        `emulator-${index}.log`,
      );
      const deadline = Date.now() + 300000;
      let booted = false;
      while (Date.now() < deadline) {
        if (memoryViolated || child.exitCode !== null) throw new Error("LANDFALL_RADIO_EMULATOR_EXITED");
        if (
          (await adb(["-s", serials[index], "shell", "getprop", "sys.boot_completed"]).catch(() => "")).trim() === "1"
        ) {
          booted = true;
          break;
        }
        await delay(1000);
      }
      if (!booted) throw new Error("LANDFALL_RADIO_BOOT_TIMEOUT");
      const actualName = await adb(["-s", serials[index], "emu", "avd", "name"]);
      if (actualName.split(/\r?\n/)[0].trim() !== name) throw new Error("LANDFALL_RADIO_DEVICE_OWNERSHIP_MISMATCH");
      for (const namespace of ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"])
        await adb(["-s", serials[index], "shell", "settings", "put", "global", namespace, "0"]);
    }
    await remember();
    if (journal) {
      executorTimer = setTimeout(
        () => {
          executorAbort.abort();
          // Closing only these owned emulators breaks stalled WebView operations;
          // the executor must finish its bounded cleanup before owner cleanup.
          for (const value of owned.values())
            if (value.executable.startsWith(`${sdk}/emulator/`)) void terminate(value, "SIGTERM");
        },
        journal.kind === "PRODUCTION_BACKGROUND_RETURN" ? 1200000 : 600000,
      );
      await journal.execute({
        adbPath: host.android.adb,
        adbPort: 5038,
        serials,
        apkPath: apk,
        artifactDirectory: destination,
        signal: executorAbort.signal,
      });
      if (executorAbort.signal.aborted || memoryViolated) throw new Error("LANDFALL_JOURNAL_RADIO_INTERRUPTED");
    } else {
      lab = await start(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/landfall/device-lab/run.ts",
          "--platform",
          "android",
          "--scenario",
          radioScenarios,
          "--profile",
          profile,
        ],
        "canonical-radio.log",
      );
      const code = await new Promise<number | null>((resolve) => {
        const timer = setTimeout(
          () => {
            resolve(null);
            // The matrix now contains four independent native scenarios. Bound the
            // complete child by the number selected; individual operations retain
            // their existing timeouts and every scenario must produce its receipt.
          },
          radioScenarios.split(",").length * 180000,
        );
        lab!.once("close", (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      if (code !== 0 || memoryViolated) throw new Error("LANDFALL_CANONICAL_RADIO_FAILED");
    }
    result = "PASS";
  } catch (error) {
    failure =
      error instanceof Error && /^LANDFALL_[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "LANDFALL_RADIO_OWNER_FAILED";
  } finally {
    clearTimeout(executorTimer);
    executorAbort.abort();
    clearInterval(guard);
    while (guardBusy) await delay(50);
    await remember();
    if (lab && lab.exitCode === null) lab.kill("SIGTERM");
    if (adbOwned)
      for (const [index, serial] of serials.entries()) {
        const actualName = await adb(["-s", serial, "emu", "avd", "name"]).catch(() => "");
        if (actualName.split(/\r?\n/)[0].trim() === names[index])
          await adb(["-s", serial, "emu", "kill"]).catch(() => undefined);
      }
    const emulatorDeadline = Date.now() + 15000;
    while (Date.now() < emulatorDeadline && (await radioProcesses(sdk)).length) await delay(500);
    for (const value of owned.values()) await terminate(value, "SIGTERM");
    await delay(1000);
    await remember();
    for (const value of owned.values()) await terminate(value, "SIGKILL");
    await delay(500);
    const adbDeadline = Date.now() + 3000;
    while (
      adbOwned &&
      Date.now() < adbDeadline &&
      !(await freePort(5038).then(
        () => true,
        () => false,
      ))
    ) {
      await remember();
      for (const value of owned.values())
        if (value.executable === (await realpath(host.android.adb!))) await terminate(value, "SIGKILL");
      await delay(250);
    }
    for (const value of owned.values()) {
      const current = await identity(value.pid);
      if (current && current.started === value.started) remainingResources.push(`pid:${value.pid}`);
    }
    if ((await radioProcesses(sdk)).length) remainingResources.push("sdk-radio-processes");
    if (adbOwned)
      for (const port of ports)
        if (
          !(await freePort(port).then(
            () => true,
            () => false,
          ))
        )
          remainingResources.push(`port:${port}`);
    for (const child of children) {
      // A spawned launcher is always ours; the identity checks above own every
      // descendant. Do not wait forever for inherited output handles on failure.
      child.stdout?.destroy();
      child.stderr?.destroy();
    }
    await Promise.all(persistLogs.map((persist) => persist()));
    if (!remainingResources.length) {
      const relative = path.relative(destination, avdHome);
      if (relative !== "avd" || path.isAbsolute(relative)) throw new Error("LANDFALL_RADIO_AVD_CLEANUP_SCOPE_INVALID");
      await rm(avdHome, { recursive: true });
    }
    const after = await deviceLabSourceIdentity();
    if (
      source.sourceFingerprint !== after.sourceFingerprint ||
      createHash("sha256")
        .update(await readFile(apk))
        .digest("hex") !== apkSha256
    ) {
      result = "FAIL";
      failure = "LANDFALL_RADIO_INPUT_CHANGED";
    }
    if (remainingResources.length) result = "FAIL";
    const receipt = {
      version: 1,
      executor: journal?.kind ?? "CANONICAL_RADIO_SCENARIO",
      host,
      deviceProfile: profile,
      result,
      failure,
      source,
      apkSha256,
      memoryBudget,
      memorySamples,
      memoryViolated,
      serials,
      avdNames: names,
      avdHome,
      logs,
      cleanup: {
        result: remainingResources.length ? "FAIL" : "PASS",
        ownedResources: [...owned.values()],
        remainingResources,
      },
      endedAt: new Date().toISOString(),
    };
    await writeFile(path.join(destination, "radio-owner-receipt.json"), JSON.stringify(receipt, null, 2));
    process.stdout.write(
      `${JSON.stringify({ result, failure, directory: destination, cleanup: receipt.cleanup.result })}\n`,
    );
  }
  if (result !== "PASS") throw new Error("LANDFALL_ANDROID_RADIO_LAB_FAILED");
}
if (process.argv[1]?.endsWith("android-radio-run.ts"))
  void runLandfallAndroidRadioLab().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "LANDFALL_RADIO_OWNER_FAILED"}\n`);
    process.exitCode = 1;
  });
