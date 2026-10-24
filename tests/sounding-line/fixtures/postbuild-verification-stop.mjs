// Inert postbuild callbacks only; never starts an application or browser.
import { createPreparationCapture } from "../../../scripts/sounding-line/development-preparation-evidence.mjs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const [directory, stoppedPhase] = process.argv.slice(2);
const capture = createPreparationCapture({}, directory);
capture.phase("MANIFEST");
for (const phase of ["BUILD_TREE_FINGERPRINT", "FINAL_DEPENDENCY_FINGERPRINT", "MANIFEST_WRITE"]) {
  await capture.measurePostbuild(phase, async () => {
    if (phase !== stoppedPhase) return;
    await writeFile(path.join(directory, "synthetic-ready.json"), JSON.stringify({ ready: true, pid: process.pid }), {
      flag: "wx",
    });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  });
}
