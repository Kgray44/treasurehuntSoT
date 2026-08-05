import { reconcileClaimedAccountCapabilities } from "../../src/homeport/workspace-capabilities";

async function main() {
  const commit = process.argv.includes("--commit");
  const accountFlag = process.argv.find((argument) => argument.startsWith("--account-id="));
  const accountId = accountFlag?.slice("--account-id=".length);
  const result = await reconcileClaimedAccountCapabilities({ ...(accountId ? { accountId } : {}), commit });
  process.stdout.write(
    `${JSON.stringify({ status: "HOMEPORT_CLAIMED_ACCOUNT_CAPABILITIES_RECONCILED", ...result }, null, 2)}\n`,
  );
}

main().catch((cause) => {
  console.error(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause));
  process.exitCode = 1;
});
