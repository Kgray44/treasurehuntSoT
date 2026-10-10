import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { deviceLabSourceIdentity } from "../device-lab/source";
import { labTool } from "../device-lab/host";
import { runDeviceLabScenario } from "../../src/device-lab/runner";
import { createSextantPhase1ScenarioPacks, phase1ScenarioIds } from "../../src/sextant/phase1-scenarios";
import { loadDeviceLabRegistry } from "../../src/device-lab/registry";
async function main() {
  const args = process.argv.slice(2);
  if (
    args.length &&
    (args.length !== 2 || args[0] !== "--scenario" || !phase1ScenarioIds.some((id) => `sextant.${id}` === args[1]))
  )
    throw new Error("SEXTANT_D0_ARGUMENT_INVALID");
  const source = await deviceLabSourceIdentity(["scripts/sextant"]),
    baseSha = (await labTool("git", ["rev-parse", "origin/main"])).trim();
  const packs = createSextantPhase1ScenarioPacks();
  const registry = loadDeviceLabRegistry();
  await mkdir("artifacts/sextant-device-lab", { recursive: true });
  for (const id of args.length ? [args[1]] : phase1ScenarioIds.map((s) => `sextant.${s}`)) {
    const declaration = registry.scenarios.find((s) => s.scenarioId === id)!;
    const receipt = await runDeviceLabScenario(packs, id, {
      source,
      baseSha,
      tier: "D0",
      profile: "synthetic",
      hostOs: `${os.platform()} ${os.release()}`,
      runtimeVersion: process.version,
      capabilitySnapshot: declaration.requiredCapabilities,
    });
    await writeFile(`artifacts/sextant-device-lab/${id}.json`, `${JSON.stringify(receipt, null, 2)}\n`);
    process.stdout.write(`${id}: ${receipt.passFailDisposition}\n`);
    if (receipt.passFailDisposition !== "PASS") process.exitCode = 1;
  }
}
void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "SEXTANT_D0_FAILED"}\n`);
  process.exitCode = 1;
});
