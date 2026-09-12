import { execFileSync } from "node:child_process";
import path from "node:path";

// Mutation journeys also run in the generic profile, which seeds its database
// before test-owned fixture setup. Use the existing nonce-marker preparer only
// after proving this exact checkout owns the candidate-specific database path.
export function ensureGenericSoundingLineIsolation() {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") return;
  const root = process.cwd();
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : "";
  const relative = path.relative(path.join(root, "artifacts", "sounding-line"), databasePath);
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/^[a-f0-9]{64}$/u.test(process.env.FOREVER_VALIDATION_NONCE_HASH ?? "") ||
    !path.isAbsolute(databasePath) ||
    !/^generic-[a-f0-9]{12}[\\/]validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(relative)
  ) {
    throw new Error("SOUNDING_LINE_GENERIC_TEST_DATABASE_REFUSED");
  }
  execFileSync(process.execPath, ["scripts/sounding-line/prepare-validation-isolation.mjs"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
}
