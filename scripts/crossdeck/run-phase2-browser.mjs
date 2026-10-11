import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve("artifacts/crossdeck/phase2");
mkdirSync(root, { recursive: true });
const port = process.env.CROSSDECK_TEST_PORT ?? "3172";
const env = {
  ...process.env,
  DATABASE_URL: `file:${resolve(root, "browser.db")}`,
  PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`,
  FOREVER_PLAYWRIGHT_EXTERNAL_SERVER: "1",
  NODE_ENV: "test",
};
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "db", "push", "--schema", "prisma/schema.sqlite.prisma", "--skip-generate"],
  { env, stdio: "inherit" },
);
const log = [];
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", port], {
  env: { ...env, NODE_ENV: "production" },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => log.push(String(chunk)));
server.stderr.on("data", (chunk) => log.push(String(chunk)));
try {
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < 60000) {
    try {
      const response = await fetch(env.PLAYWRIGHT_BASE_URL);
      if (response.status < 500) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!ready) throw new Error("OWNED_BROWSER_SERVER_NOT_READY");
  execFileSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/e2e/crossdeck-phase2.spec.ts",
      "--project=chromium",
      "--workers=1",
      "--reporter=list",
    ],
    { env, stdio: "inherit", timeout: 600000 },
  );
} finally {
  server.kill();
  writeFileSync(resolve(root, "server.log"), log.join(""));
}
