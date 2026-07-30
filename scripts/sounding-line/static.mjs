import { spawn } from "node:child_process";

const commands = [
  [process.execPath, "node_modules/prettier/bin/prettier.cjs", "--check", "."],
  [process.execPath, "node_modules/eslint/bin/eslint.js", "."],
  [process.execPath, "node_modules/typescript/bin/tsc", "--noEmit"],
  [process.execPath, "node_modules/tsx/dist/cli.mjs", "scripts/validate-user-facing-language.ts"],
  [process.execPath, "node_modules/tsx/dist/cli.mjs", "scripts/validate-project-one-voyage.ts"],
];
for (const [file, ...args] of commands) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: process.cwd(), shell: false, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("close", (code) => resolve(code));
  });
  if (result !== 0) process.exit(result ?? 1);
}
