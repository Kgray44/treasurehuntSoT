import { reconcileClaimedAccountCapabilities } from "../../src/homeport/workspace-capabilities";

async function main() {
  const commit = process.argv.includes("--commit");
  const verify = process.argv.includes("--verify");
  if (commit && verify) throw new Error("Choose exactly one reconciliation mode.");
  const accountFlag = process.argv.find((argument) => argument.startsWith("--account-id="));
  const accountId = accountFlag?.slice("--account-id=".length);
  const result = await reconcileClaimedAccountCapabilities({
    ...(accountId ? { accountId } : {}),
    mode: commit ? "COMMIT" : verify ? "VERIFY" : "DRY_RUN",
  });
  process.stdout.write(
    `${JSON.stringify({ status: "HOMEPORT_CLAIMED_ACCOUNT_CAPABILITIES_RECONCILED", ...result }, null, 2)}\n`,
  );
  if (verify && !result.verified) process.exitCode = 1;
}

main().catch((cause) => {
  console.error(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause));
  process.exitCode = 1;
});
