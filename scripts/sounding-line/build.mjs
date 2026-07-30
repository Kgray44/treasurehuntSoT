#!/usr/bin/env node
/* A production build cannot consume dev-server generated route types. */
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const output = path.resolve(process.cwd(), ".next");
if (path.dirname(output) !== path.resolve(process.cwd())) throw new Error("INVALID_BUILD_OUTPUT_ROOT");
await rm(output, { recursive: true, force: true });
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: "inherit",
  windowsHide: true,
});
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
