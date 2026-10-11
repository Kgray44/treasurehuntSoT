import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { deviceLabSourceIdentity } from "../device-lab/source";
import { labTool } from "../device-lab/host";
import { runDeviceLabScenario } from "../../src/device-lab/runner";
import { createReachPhase1ScenarioPacks } from "../../src/reach/device-lab";
import { phase1ScenarioIds } from "../../src/reach/foundation-scenarios";
async function main() {
  if (process.argv.length > 2) throw new Error("REACH_D0_ARGUMENT_INVALID");
  const source = await deviceLabSourceIdentity(["scripts/reach", "public/reach", "tests/e2e/reach-laboratory.spec.ts"]),
    baseSha = (await labTool("git", ["rev-parse", "origin/main"])).trim();
  await mkdir("artifacts/reach-device-lab", { recursive: true });
  const packs = createReachPhase1ScenarioPacks();
  for (const suffix of phase1ScenarioIds) {
    const id = `reach.${suffix}`,
      entry = packs.resolve(id);
    const receipt = await runDeviceLabScenario(packs, id, {
      source,
      baseSha,
      tier: "D0",
      profile: "synthetic",
      hostOs: `${os.platform()} ${os.release()}`,
      runtimeVersion: process.version,
      capabilitySnapshot: entry.declaration.requiredCapabilities,
    });
    await writeFile(`artifacts/reach-device-lab/${id}.json`, JSON.stringify(receipt, null, 2) + "\n");
    process.stdout.write(`${id}: ${receipt.passFailDisposition}\n`);
    if (receipt.passFailDisposition !== "PASS") process.exitCode = 1;
  }
}
void main().catch(() => {
  process.stderr.write("REACH_D0_FAILED\n");
  process.exitCode = 1;
});
