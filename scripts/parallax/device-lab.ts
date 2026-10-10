import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { deviceLabSourceIdentity } from "../device-lab/source";
import { labTool } from "../device-lab/host";
import { runDeviceLabScenario } from "../../src/device-lab/runner";
import { createParallaxPhase1ScenarioPacks, parallaxPhase1ScenarioIds } from "../../src/parallax/device-lab";
async function main() {
  if (process.argv.length > 2) throw new Error("PARALLAX_D0_ARGUMENT_INVALID");
  const source = await deviceLabSourceIdentity(["scripts/parallax"]),
    baseSha = (await labTool("git", ["rev-parse", "origin/main"])).trim();
  await mkdir("artifacts/parallax-device-lab", { recursive: true });
  for (const suffix of parallaxPhase1ScenarioIds) {
    const id = `parallax.${suffix}`;
    const r = await runDeviceLabScenario(createParallaxPhase1ScenarioPacks(), id, {
      source,
      baseSha,
      tier: "D0",
      profile: "synthetic",
      hostOs: `${os.platform()} ${os.release()}`,
      runtimeVersion: process.version,
      capabilitySnapshot: ["spatial.entity", "spatial.anchor"],
    });
    await writeFile(`artifacts/parallax-device-lab/${id}.json`, JSON.stringify(r, null, 2) + "\n");
    process.stdout.write(`${id}: ${r.passFailDisposition}\n`);
    if (r.passFailDisposition !== "PASS") process.exitCode = 1;
  }
}
void main().catch(() => {
  process.stderr.write("PARALLAX_D0_FAILED\n");
  process.exitCode = 1;
});
