import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { deviceLabSourceIdentity } from "./source";
import { labTool } from "./host";
import { createSyntheticPrivateStorage } from "./private-content-storage";
import { createBrowserDiagnosticSession } from "../../sounding-line/browser-diagnostics.mjs";

/** Ephemeral synthetic signing configuration, never a deployment key or saved artifact. */
async function main() {
  const candidate = process.argv[2],
    databaseUrl = process.argv[3];
  const suite = process.argv[4] ?? "landfall";
  if (
    ![
      "landfall",
      "sextant-consumers",
      "sextant-resources",
      "sextant-paired-clue",
      "sextant-community",
      "sextant-authoring-resources",
      "sextant-history",
      "sextant-catalog",
      "sextant-creator-entry",
      "sextant-admiralty",
      "sextant-private-content",
      "sextant-account-recovery",
      "sextant-invitation",
    ].includes(suite)
  )
    throw new Error("LANDFALL_CONFIGURED_BROWSER_SUITE_INVALID");
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
  // Private package validation must never borrow a configured real store/key.
  let privateStorage: Awaited<ReturnType<typeof createSyntheticPrivateStorage>> | null = null;
  if (suite === "sextant-private-content") {
    if (
      [
        "PRIVATE_CONTENT_ROOT",
        "PRIVATE_CONTENT_STAGING_ROOT",
        "PRIVATE_CONTENT_PROVIDER_ROOT",
        "PRIVATE_CONTENT_LOCAL_MASTER_KEY",
        "SEXTANT_PRIVATE_CONTENT_TEST_ROOT",
      ].some((name) => process.env[name])
    )
      throw new Error("SEXTANT_PRIVATE_CONTENT_EXISTING_CONFIGURATION_REFUSED");
    privateStorage = await createSyntheticPrivateStorage(candidate, databaseUrl);
  }
  let succeeded = false;
  let diagnostics: ReturnType<typeof createBrowserDiagnosticSession> | null = null;
  try {
    diagnostics =
      suite !== "landfall"
        ? createBrowserDiagnosticSession(
            process.cwd(),
            JSON.parse(
              await labTool(process.execPath, [
                "--input-type=module",
                "-e",
                'import{developmentDiagnosticBinding,developmentSourceFingerprint}from"./scripts/sounding-line/develop-browser-suite.mjs";process.stdout.write(JSON.stringify(developmentDiagnosticBinding(await developmentSourceFingerprint(process.cwd()))));',
              ]),
            ),
          )
        : null;
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
        ...(suite === "sextant-consumers"
          ? ["tests/e2e/sextant-consumer-journeys.spec.ts"]
          : suite === "sextant-resources"
            ? ["tests/e2e/sextant-resource-journeys.spec.ts"]
            : suite === "sextant-paired-clue"
              ? ["tests/e2e/sextant-parallax-paired-journeys.spec.ts"]
              : suite === "sextant-community"
                ? ["tests/e2e/sextant-community-journeys.spec.ts"]
                : suite === "sextant-authoring-resources"
                  ? ["tests/e2e/sextant-authoring-resource-journeys.spec.ts"]
                  : suite === "sextant-history"
                    ? ["tests/e2e/sextant-history-journeys.spec.ts"]
                    : suite === "sextant-catalog"
                      ? ["tests/e2e/sextant-catalog-journeys.spec.ts"]
                      : suite === "sextant-creator-entry"
                        ? ["tests/e2e/sextant-creator-entry-journeys.spec.ts"]
                        : suite === "sextant-admiralty"
                          ? ["tests/e2e/sextant-admiralty-journeys.spec.ts"]
                          : suite === "sextant-private-content"
                            ? ["tests/e2e/sextant-private-content-journeys.spec.ts"]
                            : suite === "sextant-account-recovery"
                              ? ["tests/e2e/sextant-account-recovery-journeys.spec.ts"]
                              : suite === "sextant-invitation"
                                ? ["tests/e2e/sextant-invitation-journeys.spec.ts"]
                                : [
                                    "tests/e2e/landfall-phase1-live-position.spec.ts",
                                    "tests/e2e/landfall-phase2.spec.ts",
                                    "tests/e2e/landfall-closure.spec.ts",
                                    "tests/e2e/landfall-phase3.spec.ts",
                                    "tests/e2e/landfall-phase3-creator.spec.ts",
                                    "tests/e2e/landfall-phase4.spec.ts",
                                    "tests/e2e/landfall-offline-region.spec.ts",
                                  ]),
      ],
      {
        windowsHide: true,
        stdio: "inherit",
        env: {
          ...process.env,
          ...privateStorage?.environment,
          ...diagnostics?.beginScope(),
          LANDFALL_LAB_SYNTHETIC_PACKAGES: "1",
          LANDFALL_PACKAGE_KEY_ID: "synthetic-device-lab-package",
          LANDFALL_PACKAGE_SIGNING_KEY: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
        },
      },
    );
    succeeded = !result.error && result.status === 0;
    if (!succeeded) throw new Error("LANDFALL_CONFIGURED_BROWSER_FAILED");
  } finally {
    if (privateStorage) {
      const observed = await diagnostics?.read();
      const storage = await privateStorage.close({ succeeded, runtime: observed?.runtime });
      if (succeeded && !storage.removed) throw new Error("SEXTANT_PRIVATE_STORAGE_CLEANUP_UNPROVED");
    }
  }
}
void main().catch(() => {
  process.stderr.write("LANDFALL_CONFIGURED_BROWSER_FAILED\n");
  process.exitCode = 1;
});
