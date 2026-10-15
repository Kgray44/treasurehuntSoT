import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { snapshotTree } from "./process-state.mjs";

const [role, kind] = process.argv.slice(2);
const root = process.env.LIFECYCLE_FIXTURE_ROOT;
const save = (name, value) => writeFile(path.join(root, name), JSON.stringify(value));
if (role === "server" || role === "leaf") {
  const port = Number(process.argv[process.argv.indexOf("-p") + 1]) || 0;
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      '<!doctype html><html lang="en"><head><title>Lifecycle</title></head><body><main><h1>Capture ready</h1><a href="/">Return to capture</a></main></body></html>',
    );
  });
  if (kind !== "startup") await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  await save(`${role}.json`, { pid: process.pid, port: server.address()?.port ?? null });
  if ((kind === "orphan" || kind === "sanitized-orphan") && role === "server") {
    const env = kind === "sanitized-orphan" ? { LIFECYCLE_FIXTURE_ROOT: root } : process.env;
    spawn(process.execPath, [process.argv[1], "leaf", "stubborn"], { env, stdio: "inherit", detached: true });
  }
  if (kind === "stubborn" || role === "leaf") process.on("SIGTERM", () => {});
  else process.on("SIGTERM", () => server.close(() => process.exit(0)));
  setInterval(() => {}, 1000);
} else if (role === "capture") {
  if (process.env.LIFECYCLE_WAIT_FOR_LEAF === "1") {
    const { access } = await import("node:fs/promises");
    const end = performance.now() + 5000;
    while (performance.now() < end) {
      try {
        await access(path.join(root, "leaf.json"));
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    await access(path.join(root, "leaf.json"));
  }
  if (kind.startsWith("browser-")) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(process.env.PLAYWRIGHT_BASE_URL);
    await save("browser-active.json", { pid: process.pid, ownedPids: await snapshotTree(process.pid) });
    // Deliberately leave Chromium open to exercise OS tree cleanup.
    if (kind === "browser-fail") process.exit(1);
    else setInterval(() => {}, 1000);
  } else if (kind === "hang") {
    await save("active.json", { pid: process.pid });
    setInterval(() => {}, 1000);
  } else {
    const response = await fetch(process.env.PLAYWRIGHT_BASE_URL);
    await response.text();
    if (kind === "orphan") {
      spawn(process.execPath, [process.argv[1], "leaf", "stubborn"], {
        env: process.env,
        stdio: "inherit",
        detached: true,
      });
      // Wait for an observable owned descendant, never an arbitrary sleep.
      const { access } = await import("node:fs/promises");
      for (;;) {
        try {
          await access(path.join(root, "leaf.json"));
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    }
    await save("capture-operation.json", { status: response.ok ? "PASS" : "FAIL" });
    process.exit(kind === "fail" ? 1 : 0);
  }
}
