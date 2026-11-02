// Disabled owner bootstrap. Metadata and public dummy bytes never grant custody,
// recipient, provider, reuse or release authority. No key/age operation exists here.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import { spawnOwnedProcess, processExit, stopOwnedProcess } from "./owned-process.mjs";

export const INTERNAL_CUSTODY_PROFILE = "INTERNAL_TWO_DEVICE_SINGLE_LAPTOP";
export const REAL_CUSTODY_OPERATIONS_ENABLED = false;
export const INTERNAL_CUSTODY_TARGETS = Object.freeze({
  C: "C:\\VoyagewrightRecovery\\SoundingLine\\B\\generation-0001\\registry-key.pkcs8.age",
  D: "D:\\VoyagewrightRecovery\\SoundingLine\\B\\generation-0001\\registry-key.pkcs8.age",
});
export const CUSTODY_AGE_CANDIDATE = Object.freeze({
  version: "1.3.2",
  archive: "age-v1.3.2-windows-amd64.zip",
  bytes: 20250704,
  sha256: "f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7",
  url: "https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-windows-amd64.zip",
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_CUSTODY_BOOTSTRAP_${code}`);
};
function data(value, depth = 0) {
  need(depth <= 8 && value !== undefined, "METADATA_BOUND");
  if (value === null || ["string", "boolean", "number"].includes(typeof value)) {
    need(typeof value !== "number" || Number.isFinite(value), "METADATA_NUMBER");
    return value;
  }
  need(typeof value === "object" && !types.isProxy(value), "METADATA_OBJECT");
  need(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype, "METADATA_OBJECT");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = Object.entries(descriptors).filter(([key]) => key !== "length");
  need(entries.length <= 128 && entries.every(([, d]) => Object.hasOwn(d, "value")), "METADATA_DESCRIPTOR");
  return Array.isArray(value)
    ? entries.map(([, d]) => data(d.value, depth + 1))
    : Object.fromEntries(entries.map(([key, d]) => [key, data(d.value, depth + 1)]));
}

export function planInternalRegistryCustody(observation) {
  const input = data(observation);
  need(Buffer.byteLength(JSON.stringify(input)) <= 65536, "METADATA_BOUND");
  need(
    Array.isArray(input.partitions) && Array.isArray(input.disks) && Array.isArray(input.physicalDisks),
    "INVENTORY",
  );
  const selected = ["C", "D"].map((drive) => {
    const partitions = input.partitions.filter((p) => p.DriveLetter === drive);
    need(partitions.length === 1, "PARTITION_IDENTITY");
    const partition = partitions[0];
    need(Number.isSafeInteger(partition.DiskNumber) && partition.DiskNumber >= 0, "DISK_IDENTITY");
    const disks = input.disks.filter((d) => d.Number === partition.DiskNumber);
    need(disks.length === 1, "DISK_IDENTITY");
    const disk = disks[0];
    need(disk.BusType === "NVMe" && Number.isSafeInteger(disk.Size) && disk.Size > 0, "PHYSICAL_DEVICE");
    need(typeof disk.UniqueIdSha256 === "string" && /^[a-f0-9]{64}$/u.test(disk.UniqueIdSha256), "DISK_IDENTITY");
    const physical = input.physicalDisks.filter(
      (d) => String(d.DeviceId) === String(disk.Number) && d.FriendlyName === disk.FriendlyName && d.Size === disk.Size,
    );
    need(physical.length === 1 && physical[0].BusType === "NVMe" && physical[0].MediaType === "SSD", "PHYSICAL_DEVICE");
    return { drive, diskNumber: disk.Number, deviceIdentitySha256: disk.UniqueIdSha256, model: disk.FriendlyName };
  });
  need(selected[0].diskNumber !== selected[1].diskNumber, "SAME_DEVICE");
  need(selected[0].deviceIdentitySha256 !== selected[1].deviceIdentitySha256, "SAME_DEVICE");
  return Object.freeze({
    kind: "DISABLED_INTERNAL_CUSTODY_PLAN_ONLY",
    profile: INTERNAL_CUSTODY_PROFILE,
    devices: selected,
    targets: INTERNAL_CUSTODY_TARGETS,
    ageCandidate: CUSTODY_AGE_CANDIDATE,
    packageMaximumBytes: 1048576,
    setupPeakBytes: { C: 268435456, D: 67108864 },
    realKeyOperationsEnabled: false,
    secretCustody: "UNESTABLISHED",
    twoOffHostCopies: false,
    laptopLossRecoveryProved: false,
    ransomwareRecoveryProved: false,
    qualification: false,
    reuseAuthorized: false,
  });
}

const canary = Buffer.from("VW_PUBLIC_DUMMY_CUSTODY_CANARY_V1\nNO_PRIVATE_KEY_OR_PASSPHRASE\n");
const signature = (s) => [s.dev, s.ino, s.size, s.nlink, s.mtimeNs, s.ctimeNs].map(String).join(":");
function canonicalDirectory(directory) {
  need(path.isAbsolute(directory) && path.resolve(directory) === directory, "DUMMY_PATH");
  const st = fs.lstatSync(directory);
  need(
    st.isDirectory() && !st.isSymbolicLink() && fs.realpathSync.native(directory) === directory,
    "DUMMY_DIRECTORY_ALIAS",
  );
}
export function inspectPublicCustodyDummy(directory) {
  canonicalDirectory(directory);
  need(path.basename(directory).startsWith("sounding-line-custody-dummy-"), "DUMMY_PATH");
  const file = path.join(directory, "public-canary.bin");
  const before = fs.lstatSync(file, { bigint: true });
  need(
    before.isFile() && !before.isSymbolicLink() && before.nlink === 1n && before.size === BigInt(canary.length),
    "DUMMY_FILE",
  );
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    need(signature(fs.fstatSync(fd, { bigint: true })) === signature(before), "DUMMY_CHANGED");
    // A racing grow must not turn a fixed public canary into an unbounded read.
    const buffer = Buffer.alloc(canary.length + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, length);
      if (count === 0) break;
      length += count;
    }
    const bytes = buffer.subarray(0, length);
    need(bytes.equals(canary), "DUMMY_BYTES");
    need(signature(fs.fstatSync(fd, { bigint: true })) === signature(before), "DUMMY_CHANGED");
    return { path: file, bytes: bytes.length, sha256: hash(bytes), kind: "PUBLIC_DUMMY_NOT_ENCRYPTED_KEY_BACKUP" };
  } finally {
    fs.closeSync(fd);
  }
}

// A fixed public canary only. Callers cannot supply payloads, secret paths or keys.
export function runPublicCustodyDummyPair(firstParent, secondParent) {
  canonicalDirectory(firstParent);
  canonicalDirectory(secondParent);
  need(firstParent !== secondParent, "DUMMY_PARENTS");
  const directories = [];
  let copies, failure;
  const cleanup = [];
  try {
    for (const parent of [firstParent, secondParent]) {
      const directory = fs.mkdtempSync(path.join(parent, "sounding-line-custody-dummy-"));
      directories.push(directory);
      fs.writeFileSync(path.join(directory, "public-canary.bin"), canary, { flag: "wx", mode: 0o600 });
    }
    // Each inspection has only its selected directory and the fixed public value.
    copies = directories.map((directory) => inspectPublicCustodyDummy(directory));
  } catch (error) {
    failure = error;
  } finally {
    for (const directory of directories) {
      try {
        need(
          JSON.stringify(fs.readdirSync(directory)) === JSON.stringify(["public-canary.bin"]),
          "DUMMY_UNKNOWN_ENTRY",
        );
        inspectPublicCustodyDummy(directory);
        fs.unlinkSync(path.join(directory, "public-canary.bin"));
        fs.rmdirSync(directory);
        cleanup.push({ directory, status: "VERIFIED_PUBLIC_DUMMY_RETIRED" });
      } catch (error) {
        cleanup.push({ directory, status: "HELD", error: error.message.slice(0, 512) });
      }
    }
  }
  if (failure) {
    // Preserve the original error and report every owned path even when a
    // partial write cannot be verified for retirement.
    failure.custodyDummyCleanup = cleanup;
    throw failure;
  }
  need(
    cleanup.length === 2 && cleanup.every((c) => c.status === "VERIFIED_PUBLIC_DUMMY_RETIRED"),
    "DUMMY_CLEANUP_HELD",
  );
  return {
    kind: "PUBLIC_DUMMY_FILE_COPY_CHECK_ONLY",
    copies,
    cleanup,
    encryptionPerformed: false,
    secretOperations: 0,
    physicalDeviceFailureTest: false,
    profileLossRecoveryProved: false,
    qualification: false,
    reuseAuthorized: false,
  };
}

async function inventory() {
  need(process.platform === "win32", "PLATFORM_NOT_SUPPORTED");
  const script = fileURLToPath(new URL("./registry-custody-inventory.ps1", import.meta.url));
  const env = custodyInventoryEnvironment(process.env);
  const powershell = path.win32.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const child = spawnOwnedProcess(powershell, ["-NoProfile", "-NonInteractive", "-File", script], {
    root: process.cwd(),
    env,
    inheritExecutionPolicy: true,
    cleanupOptions: { gracefulMs: 500, forceMs: 1000 },
  });
  const chunks = [];
  let size = 0,
    timer,
    result,
    cleanup,
    failure;
  child.stdout.on("data", (b) => {
    size += b.length;
    if (size <= 65536) chunks.push(Buffer.from(b));
  });
  child.stderr.on("data", () => {});
  try {
    result = await Promise.race([
      processExit(child),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("SOUNDING_LINE_CUSTODY_BOOTSTRAP_INVENTORY_DEADLINE")), 15000);
      }),
    ]);
    need(result.code === 0 && size <= 65536, "INVENTORY_FAILED");
  } catch (error) {
    failure = error;
  } finally {
    clearTimeout(timer);
    cleanup = await stopOwnedProcess(child);
  }
  if (failure) throw failure;
  need(cleanup.status === "PASS" && cleanup.treeReaped && cleanup.streamsClosed, "INVENTORY_CLEANUP");
  return {
    observation: JSON.parse(
      Buffer.concat(chunks)
        .toString("utf8")
        .replace(/^\uFEFF/u, ""),
    ),
    cleanup,
  };
}

// Do not forward arbitrary credential variables, regardless of their names.
export function custodyInventoryEnvironment(parent) {
  const allowed = new Set([
    "SYSTEMROOT",
    "WINDIR",
    "SYSTEMDRIVE",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "LOCALAPPDATA",
    "PROGRAMDATA",
  ]);
  return Object.fromEntries(Object.entries(parent).filter(([key]) => allowed.has(key.toUpperCase())));
}

export async function runRegistryCustodyBootstrap(args) {
  need(args.length === 2 && args[0] === "--operation", "CLI");
  need(["plan", "dummy-check"].includes(args[1]), "REAL_OPERATION_UNAVAILABLE");
  if (args[1] === "plan") {
    const observed = await inventory();
    return { ...planInternalRegistryCustody(observed.observation), inventoryCleanup: observed.cleanup };
  }
  need(process.platform === "win32", "PLATFORM_NOT_SUPPORTED");
  const cParent = path.join(os.homedir(), "AppData", "Local", "Temp");
  const dParent = path.resolve("artifacts/tmp");
  need(
    path.parse(cParent).root.toUpperCase() === "C:\\" && path.parse(dParent).root.toUpperCase() === "D:\\",
    "DUMMY_DRIVES",
  );
  return runPublicCustodyDummyPair(cParent, dParent);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await runRegistryCustodyBootstrap(process.argv.slice(2))));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message, cleanup: error.custodyDummyCleanup ?? [] }));
    process.exitCode = 1;
  }
}
