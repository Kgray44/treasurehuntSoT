import { readFile } from "node:fs/promises";
import {
  createPrivateBackup,
  exportPrivateImport,
  importPrivatePackage,
  inspectPrivatePackage,
  retryPrivateImportFinalization,
  verifyPrivateBackup,
  writePrivateExport,
} from "../../src/private-content/service";
import { decryptPrivatePackage } from "../../src/private-content/package";
import { scanBuildOutput, scanPrivateContent } from "../../src/private-content/security";

const [command, ...args] = process.argv.slice(2);
const usage = `Usage: private-content <command> [arguments]\n\nCommands:\n  inspect <package>              inspect an encrypted package\n  verify <package>               authenticate and verify a package\n  import-dry-run <package>       validate without creating content\n  import-commit <package> <actor> explicit durable import\n  export <import-id> <output>    export and round-trip verify\n  backup <import-id> <output>    encrypted backup and verification\n  restore-verify <package>       verify an isolated restore source\n  finalize-retry <import-id>     retry protected asset finalization\n  repository-scan                scan the repository\n  build-output-scan [root]       scan public build output\n\nPass the passphrase only through standard input. It is never accepted on the command line.\n`;

function output(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
async function passphrase() {
  if (process.stdin.isTTY) throw new Error("Read the passphrase from standard input.");
  let value = "";
  for await (const chunk of process.stdin) value += String(chunk);
  return value.trimEnd();
}
async function packageInput() {
  const packagePath = args[0];
  if (!packagePath) throw new Error("A package path is required.");
  return { bytes: await readFile(packagePath), passphrase: await passphrase() };
}

async function main() {
  if (!command || command === "--help" || command === "help") {
    process.stdout.write(usage);
    return;
  }
  if (command === "repository-scan") {
    const hits = await scanPrivateContent();
    if (hits.length) throw new Error("Repository scan found protected-content indicators.");
    output({ status: "clean" });
    return;
  }
  if (command === "build-output-scan") {
    const hits = await scanBuildOutput(args[0]);
    if (hits.length) throw new Error("Build scan found protected-content indicators.");
    output({ status: "clean" });
    return;
  }
  if (command === "inspect" || command === "import-dry-run") {
    const input = await packageInput();
    output(await inspectPrivatePackage(input.bytes, input.passphrase));
    return;
  }
  if (command === "verify" || command === "restore-verify") {
    const input = await packageInput();
    output(
      command === "verify"
        ? { status: "valid", manifest: (await decryptPrivatePackage(input.bytes, input.passphrase)).manifest }
        : await verifyPrivateBackup(input.bytes, input.passphrase),
    );
    return;
  }
  if (command === "import-commit") {
    const input = await packageInput();
    const actorId = args[1];
    if (!actorId) throw new Error("An authenticated actor reference is required.");
    output(
      await importPrivatePackage({ packageBytes: input.bytes, passphrase: input.passphrase, actorId, confirm: true }),
    );
    return;
  }
  if (command === "export") {
    const importId = args[0];
    const outputPath = args[1];
    if (!importId || !outputPath) throw new Error("An import ID and output path are required.");
    output(await writePrivateExport({ importId, outputPath, passphrase: await passphrase() }));
    return;
  }
  if (command === "backup") {
    const importId = args[0];
    const outputPath = args[1];
    if (!importId || !outputPath) throw new Error("An import ID and output path are required.");
    output(await createPrivateBackup({ importId, outputPath, passphrase: await passphrase() }));
    return;
  }
  if (command === "finalize-retry") {
    const importId = args[0];
    if (!importId) throw new Error("An import ID is required.");
    output(await retryPrivateImportFinalization({ importId }));
    return;
  }
  throw new Error("Unknown private-content command.");
}

void main().catch(() => {
  process.stderr.write(
    "Private-content operation failed. Inspect authorization, package integrity, and configured private roots.\n",
  );
  process.exitCode = 1;
});
