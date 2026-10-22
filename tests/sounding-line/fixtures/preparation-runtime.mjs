import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import {
  emitPreparationPhase,
  PREPARATION_CHANNEL,
  PREPARATION_PROFILE,
  preparationProductEnvironment,
} from "../../../scripts/sounding-line/preparation-phases.mjs";

const mode = process.argv[2];
const file = fileURLToPath(import.meta.url);
const ignore = () => {
  process.on("SIGTERM", () => {});
  process.on("SIGINT", () => {});
};
if (mode === "descendant") {
  ignore();
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  writeFileSync(
    process.argv[3],
    JSON.stringify({
      pid: process.pid,
      port: server.address().port,
      tokenPresent: Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN),
      channelPresent: Boolean(process.env[PREPARATION_CHANNEL] || process.env[PREPARATION_PROFILE]),
    }) + "\n",
    { flag: "wx" },
  );
  console.error("SYNTHETIC_STUBBORN_LISTENER_READY");
} else if (mode === "block") {
  ignore();
  writeFileSync(process.argv[3], JSON.stringify({ pid: process.pid }) + "\n", { flag: "wx" });
  setInterval(() => {}, 1000);
} else if (["advance", "hosted-advance", "silent", "hosted-silent", "duplicate", "wrong-source"].includes(mode)) {
  const channel = process.env[PREPARATION_CHANNEL];
  const directory = path.join(path.dirname(channel), "probe");
  mkdirSync(directory);
  const delay = mode === "hosted-advance" ? 8000 : 30;
  if (mode === "wrong-source") {
    const state = JSON.parse(readFileSync(path.join(channel, "state.json"), "utf8"));
    state.binding.candidate = "c".repeat(40);
    writeFileSync(path.join(channel, "state.json"), JSON.stringify(state));
  }
  emitPreparationPhase("ADMISSION");
  if (mode === "duplicate") {
    emitPreparationPhase("ADMISSION");
    setInterval(() => {}, 1000);
  } else if (mode === "wrong-source") {
    setInterval(() => {}, 1000);
  } else {
    await pause(delay);
    emitPreparationPhase("PLANNING");
    await pause(delay);
    emitPreparationPhase("STAGING", {
      sourceDigest: "1".repeat(64),
      contractDigest: "2".repeat(64),
      planDigest: "3".repeat(64),
    });
    if (mode === "silent" || mode === "hosted-silent") {
      process.env[PREPARATION_PROFILE] = "1";
      emitPreparationPhase("FIXTURE_PRISMA");
      ignore();
      const cleanEnvironment = preparationProductEnvironment(process.env);
      spawn(process.execPath, [file, "descendant", path.join(directory, "descendant.json")], {
        env: cleanEnvironment,
        stdio: ["ignore", "inherit", "inherit"],
        detached: true,
        windowsHide: true,
      });
      // Deliberately reproduce a controller blocked in a synchronous child.
      spawnSync(process.execPath, [file, "block", path.join(directory, "blocker.json")], {
        env: cleanEnvironment,
        stdio: "inherit",
        windowsHide: true,
      });
    } else {
      await pause(delay);
      emitPreparationPhase("VALIDATION");
      await pause(delay);
      emitPreparationPhase("COMPLETE");
    }
  }
} else throw new Error("SYNTHETIC_PREPARATION_MODE_INVALID");
