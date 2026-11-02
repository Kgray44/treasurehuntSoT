import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  INTERNAL_CUSTODY_TARGETS,
  REAL_CUSTODY_OPERATIONS_ENABLED,
  CUSTODY_AGE_CANDIDATE,
  planInternalRegistryCustody,
  runPublicCustodyDummyPair,
  inspectPublicCustodyDummy,
  runRegistryCustodyBootstrap,
  custodyInventoryEnvironment,
} from "../../scripts/sounding-line/registry-custody-bootstrap.mjs";

const observation = () => ({
  partitions: [
    { DriveLetter: "C", DiskNumber: 1 },
    { DriveLetter: "D", DiskNumber: 0 },
  ],
  disks: [
    { Number: 1, FriendlyName: "synthetic-first", BusType: "NVMe", Size: 1024, UniqueIdSha256: "a".repeat(64) },
    { Number: 0, FriendlyName: "synthetic-second", BusType: "NVMe", Size: 2048, UniqueIdSha256: "b".repeat(64) },
  ],
  physicalDisks: [
    { DeviceId: "1", FriendlyName: "synthetic-first", BusType: "NVMe", MediaType: "SSD", Size: 1024 },
    { DeviceId: "0", FriendlyName: "synthetic-second", BusType: "NVMe", MediaType: "SSD", Size: 2048 },
  ],
});
test("inventory child receives only explicit Windows environment names", () => {
  assert.deepEqual(
    custodyInventoryEnvironment({
      SystemRoot: "C:\\Windows",
      TEMP: "D:\\temp",
      innocentName: "credential",
      PATH: "untrusted",
      NODE_OPTIONS: "injection",
      PSModulePath: "untrusted",
    }),
    { SystemRoot: "C:\\Windows", TEMP: "D:\\temp" },
  );
});
test("internal custody plan distinguishes metadata devices without granting secret or recovery authority", () => {
  const plan = planInternalRegistryCustody(observation());
  assert.equal(plan.profile, "INTERNAL_TWO_DEVICE_SINGLE_LAPTOP");
  assert.deepEqual(
    plan.devices.map((d) => d.diskNumber),
    [1, 0],
  );
  for (const field of [
    "realKeyOperationsEnabled",
    "twoOffHostCopies",
    "laptopLossRecoveryProved",
    "ransomwareRecoveryProved",
    "qualification",
    "reuseAuthorized",
  ])
    assert.equal(plan[field], false);
  assert.equal(plan.secretCustody, "UNESTABLISHED");
  assert.equal(REAL_CUSTODY_OPERATIONS_ENABLED, false);
  assert.equal(
    INTERNAL_CUSTODY_TARGETS.C,
    "C:\\VoyagewrightRecovery\\SoundingLine\\B\\generation-0001\\registry-key.pkcs8.age",
  );
  assert.equal(
    INTERNAL_CUSTODY_TARGETS.D,
    "D:\\VoyagewrightRecovery\\SoundingLine\\B\\generation-0001\\registry-key.pkcs8.age",
  );
  assert.equal(CUSTODY_AGE_CANDIDATE.sha256, "f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7");
});
test("letters alone, duplicated devices and mismatched physical metadata never establish a plan", () => {
  const cases = [
    (v) => {
      v.physicalDisks = [];
    },
    (v) => {
      v.partitions[1].DiskNumber = 1;
    },
    (v) => {
      v.disks[1].UniqueIdSha256 = v.disks[0].UniqueIdSha256;
    },
    (v) => {
      v.physicalDisks[1].Size++;
    },
    (v) => {
      v.disks[1].BusType = "USB";
    },
    (v) => {
      v.partitions.push(v.partitions[0]);
    },
    (v) => {
      v.disks[0].Size = Infinity;
    },
    (v) => {
      v.disks[0].UniqueIdSha256 = "unknown";
    },
  ];
  for (const mutate of cases) {
    const v = observation();
    mutate(v);
    assert.throws(() => planInternalRegistryCustody(v), /CUSTODY_BOOTSTRAP/u);
  }
});
test("metadata getters, proxies and callback-like objects are rejected without invoking them", () => {
  let called = 0;
  const v = observation();
  Object.defineProperty(v, "extra", {
    get() {
      called++;
      throw Error("GETTER");
    },
  });
  assert.throws(() => planInternalRegistryCustody(v), /METADATA_DESCRIPTOR/u);
  assert.equal(called, 0);
  assert.throws(() => planInternalRegistryCustody(new Proxy({}, {})), /METADATA_OBJECT/u);
  assert.throws(() => planInternalRegistryCustody({ callback() {} }), /METADATA_OBJECT/u);
});
test("real operations and unknown CLI flags fail before any key, file or inventory action", async () => {
  for (const operation of ["setup", "create", "unlock", "export", "install", "rotate", "copy"]) {
    await assert.rejects(runRegistryCustodyBootstrap(["--operation", operation]), /REAL_OPERATION_UNAVAILABLE/u);
  }
  await assert.rejects(runRegistryCustodyBootstrap(["--operation", "plan", "--enabled", "true"]), /CLI/u);
});
test("fixed public dummy copies can be inspected independently and retire only verified owned files", () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), "custody-parent-a-"));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), "custody-parent-b-"));
  try {
    const result = runPublicCustodyDummyPair(first, second);
    assert.equal(result.copies.length, 2);
    assert.equal(result.copies[0].sha256, result.copies[1].sha256);
    assert(result.cleanup.every((r) => r.status === "VERIFIED_PUBLIC_DUMMY_RETIRED"));
    assert.equal(result.encryptionPerformed, false);
    assert.equal(result.secretOperations, 0);
    assert.equal(result.physicalDeviceFailureTest, false);
    assert.equal(result.profileLossRecoveryProved, false);
    assert.equal(result.qualification, false);
    assert.deepEqual(fs.readdirSync(first), []);
    assert.deepEqual(fs.readdirSync(second), []);
  } finally {
    fs.rmdirSync(first);
    fs.rmdirSync(second);
  }
});
test("dummy reader refuses hardlinks, changed bytes and arbitrary filenames", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "custody-parent-"));
  const dir = fs.mkdtempSync(path.join(parent, "sounding-line-custody-dummy-"));
  const file = path.join(dir, "public-canary.bin"),
    link = path.join(dir, "alias.bin");
  try {
    fs.writeFileSync(file, "not a canary", { flag: "wx" });
    assert.throws(() => inspectPublicCustodyDummy(dir), /DUMMY_FILE/u);
    fs.writeFileSync(
      file,
      "X".repeat(Buffer.byteLength("VW_PUBLIC_DUMMY_CUSTODY_CANARY_V1\nNO_PRIVATE_KEY_OR_PASSPHRASE\n")),
    );
    assert.throws(() => inspectPublicCustodyDummy(dir), /DUMMY_BYTES/u);
    fs.linkSync(file, link);
    assert.throws(() => inspectPublicCustodyDummy(dir), /DUMMY_FILE/u);
    assert.throws(() => inspectPublicCustodyDummy(parent), /DUMMY_PATH/u);
  } finally {
    if (fs.existsSync(link)) fs.unlinkSync(link);
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
    fs.rmdirSync(parent);
  }
});
