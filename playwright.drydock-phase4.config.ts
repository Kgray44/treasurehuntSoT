// Compatibility entrypoint for the source-resident Drydock local browser launcher.
// The canonical specialized configuration is maintained under tests/config/playwright/.
import config from "./tests/config/playwright/playwright.drydock-phase4.config";

export default {
  ...config,
  testDir: "./tests/e2e",
};
