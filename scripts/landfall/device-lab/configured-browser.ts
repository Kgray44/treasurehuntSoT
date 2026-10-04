import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { deviceLabSourceIdentity } from "./source";

/** Ephemeral synthetic signing configuration, never a deployment key or saved artifact. */
async function main() {
  const candidate = process.argv[2],
    databaseUrl = process.argv[3];
  const source = await deviceLabSourceIdentity();
  if (
    !/^[a-f0-9]{40}$/.test(candidate ?? "") ||
    candidate !== source.sourceSha ||
    source.dirty ||
    !databaseUrl?.startsWith("file:") ||
    process.env.LANDFALL_PACKAGE_SIGNING_KEY ||
    process.env.LANDFALL_PACKAGE_KEY_ID
  )
    throw new Error("LANDFALL_CONFIGURED_BROWSER_ISOLATION_REQUIRED");
  const databasePath = databaseUrl.slice(5);
  const relative = path.relative(path.join(process.cwd(), "artifacts", "sounding-line"), databasePath);
  const segments = relative.split(path.sep);
  if (
    !path.isAbsolute(databasePath) ||
    segments.length !== 2 ||
    segments[0] !== `generic-${candidate.slice(0, 12)}` ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(segments[1])
  )
    throw new Error("LANDFALL_CONFIGURED_BROWSER_DATABASE_REFUSED");
  const { privateKey } = generateKeyPairSync("ed25519");
  const result = spawnSync(
    process.execPath,
    [
      "scripts/sounding-line/run-browser-suite.mjs",
      "--profile",
      "generic",
      "--candidate",
      candidate,
      "--database-url",
      databaseUrl,
      "--",
      "tests/e2e/landfall-phase4.spec.ts",
      "tests/e2e/landfall-offline-region.spec.ts",
    ],
    {
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        LANDFALL_LAB_SYNTHETIC_PACKAGES: "1",
        LANDFALL_PACKAGE_KEY_ID: "synthetic-device-lab-package",
        LANDFALL_PACKAGE_SIGNING_KEY: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      },
    },
  );
  if (result.error || result.status !== 0) throw new Error("LANDFALL_CONFIGURED_BROWSER_FAILED");
}
void main().catch(() => {
  process.stderr.write("LANDFALL_CONFIGURED_BROWSER_FAILED\n");
  process.exitCode = 1;
});
