import { loadDeviceLabRegistry } from "../../src/device-lab/registry";
import { DeviceLabScenarioPacks } from "../../src/device-lab/scenario-pack";
const registry = loadDeviceLabRegistry();
process.stdout.write(
  `${JSON.stringify({ registry: registry.registry, tierVocabulary: registry.tierVocabulary, scenarios: new DeviceLabScenarioPacks(registry).status() }, null, 2)}\n`,
);
