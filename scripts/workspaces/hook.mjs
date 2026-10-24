import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
// Fast signal only. Reconciliation executes in the bounded scheduled task, so
// Interrupt/SessionEnd never wait for GitHub, a fleet walk, or a destructive step.
try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const registry = JSON.parse(fs.readFileSync(path.join(root, "registry.json"), "utf8"));
  const cwd = String(input.cwd ?? "")
    .replaceAll("\\", "/")
    .toLowerCase();
  const canonical = registry.config.canonical.replaceAll("\\", "/").toLowerCase();
  const owns = registry.records.some(
    (r) => r.path.replaceAll("\\", "/").toLowerCase() === cwd && r.state !== "RETIRED",
  );
  if (owns || cwd === canonical) {
    execFileSync("schtasks.exe", ["/Run", "/TN", "Voyagewright-Workspace-Reconciler"], {
      windowsHide: true,
      timeout: 1500,
      stdio: "ignore",
    });
  }
} catch (e) {
  // A missing task or trust decision never mints successful cleanup evidence.
  process.stderr.write(`Workspace reconciliation signal unavailable: ${e.message}\n`);
}
process.stdout.write('{"continue":true,"suppressOutput":true}\n');
