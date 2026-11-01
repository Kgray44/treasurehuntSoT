import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
const [mode, root] = process.argv.slice(2);
if (mode === "leaf") {
  const server = createServer();
  server.listen(0, "127.0.0.1", () =>
    writeFileSync(path.join(root, "leaf.json"), JSON.stringify({ pid: process.pid, port: server.address().port })),
  );
  process.on("SIGTERM", () => {});
} else {
  writeFileSync(path.join(root, "parent.json"), JSON.stringify({ pid: process.pid }));
  if (mode === "fail") process.exit(17);
  if (mode === "pass") process.exit(0);
  if (mode === "command-hang") {
    const { run } = await import("../../../scripts/sounding-line/ordinary.mjs");
    try {
      run(root, process.execPath, [process.argv[1], "hang", root], { timeout: 200 });
    } catch (error) {
      writeFileSync(
        path.join(root, "command-failure.json"),
        JSON.stringify({ code: error.message, causeCode: error.cause?.code }),
      );
      process.exit(17);
    }
  }
  if (mode === "orphan") spawn(process.execPath, [process.argv[1], "leaf", root], { stdio: "inherit", detached: true });
  // Block the verifier's event loop, including its own JS timeout handlers.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
