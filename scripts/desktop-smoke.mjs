import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const executable = path.resolve("dist", "win-unpacked", "The Forever Treasure Companion.exe");
await access(executable);
const defaultDatabase = `file:${path.resolve("prisma", "b1-execute.db").replaceAll("\\", "/")}`;
const child = spawn(executable, [], {
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || defaultDatabase,
    TALL_TALE_DESKTOP_SMOKE: "1",
  },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
const timeout = setTimeout(() => child.kill(), 60_000);
const code = await new Promise((resolve) => child.once("close", resolve));
clearTimeout(timeout);
const resultLine = stdout.split(/\r?\n/).find((line) => line.includes('"area":"desktop-smoke"'));
const result = resultLine ? JSON.parse(resultLine) : null;
if (
  code !== 0 ||
  !result?.loaded ||
  result.desktopAdapterScan?.result !== "EVIDENCE_CAPTURED" ||
  result.desktopAdapterScan?.rawFramesCleared !== true ||
  result.desktopAdapterScan?.verificationResult !== null
) {
  throw new Error(`Packaged desktop smoke failed (exit ${code}).\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}
console.log(stdout.trim());
