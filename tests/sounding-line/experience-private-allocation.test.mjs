import assert from "node:assert/strict";
import test from "node:test";
import {
  PRIVATE_CAPTURE_RESERVE_BYTES as floor,
  admitPrivateNativeCapture,
  assessPrivateCaptureAllocation,
  createPrivateAllocationFixtureRealm,
  privateCaptureAllocationPlan,
} from "../../scripts/sounding-line/experience-private-allocation.mjs";

test("full retained native and transport ceilings are finite with no speculative cleanup credit", () => {
  const plan = privateCaptureAllocationPlan();
  assert.equal(plan.peak.C, 0);
  assert.equal(plan.peak.D, 79 * 1073741824 + 96 * 1048576);
  assert(plan.resources.some((r) => r.name === "nativeTemp"));
  assert(plan.resources.some((r) => r.name === "readyAndOriginalJson"));
  const result = assessPrivateCaptureAllocation({ C: floor + 1, D: floor + plan.peak.D });
  assert.deepEqual(result.blockers, ["D_PROJECTED_RESERVE", "NATIVE_WRITE_CONFINEMENT_NOT_INSTALLED"]);
  assert.deepEqual(assessPrivateCaptureAllocation({ C: floor + 1, D: floor + plan.peak.D + 1 }).blockers, [
    "NATIVE_WRITE_CONFINEMENT_NOT_INSTALLED",
  ]);
  assert.throws(
    () => admitPrivateNativeCapture({ enforced: true, peak: 1 }),
    /NATIVE_WRITE_CONFINEMENT_NOT_INSTALLED/u,
  );
});
test("synthetic hard write admission tracks peak and refuses the next byte before allocation", async () => {
  let used = 0,
    stops = 0,
    calls = 0;
  const realm = createPrivateAllocationFixtureRealm({
    caps: { C: 0, D: 64 },
    sampleFree: async () => ({ C: floor + 1, D: floor + 1024 - used }),
    sampleUsed: async () => ({ C: 0, D: used }),
    stopOwned: async () => stops++,
    persist: async (_, bytes) => {
      calls++;
      used += bytes.length;
    },
  });
  await realm.write("D", Buffer.alloc(32));
  await realm.write("D", Buffer.alloc(32));
  await assert.rejects(realm.write("D", Buffer.alloc(1)), /HARD_CAP_REACHED/u);
  assert.equal(calls, 2);
  assert.equal(stops, 1);
  assert.equal(realm.receipt().peak.D, 64);
});
test("both reserves are checked independently and monitored growth stops only the owned writer", async () => {
  for (const exhausted of ["C", "D"]) {
    let stops = 0,
      writes = 0;
    const realm = createPrivateAllocationFixtureRealm({
      caps: { C: 0, D: 64 },
      sampleFree: async () => ({
        C: exhausted === "C" ? floor : floor + 1,
        D: exhausted === "D" ? floor : floor + 1024,
      }),
      sampleUsed: async () => ({ C: 0, D: 0 }),
      stopOwned: async () => stops++,
      persist: async () => writes++,
    });
    await assert.rejects(realm.write("D", Buffer.alloc(1)), /MONITORED_BOUND_REACHED/u);
    assert.equal(stops, 1);
    assert.equal(writes, 0);
  }
  let stops = 0;
  const monitor = createPrivateAllocationFixtureRealm({
    caps: { C: 0, D: 64 },
    sampleFree: async () => ({ C: floor + 1, D: floor + 1024 }),
    sampleUsed: async () => ({ C: 0, D: 65 }),
    stopOwned: async () => stops++,
    persist: async () => assert.fail("must not write"),
  });
  await assert.rejects(monitor.sample(), /MONITORED_BOUND_REACHED/u);
  assert.equal(stops, 1);
});

test("nonzero starting usage and external growth cannot cross a cap before the next write", async () => {
  for (const initial of [0, 63]) {
    let used = initial,
      writes = 0,
      stops = 0;
    const realm = createPrivateAllocationFixtureRealm({
      caps: { C: 0, D: 64 },
      sampleFree: async () => ({ C: floor + 1, D: floor + 1024 - used }),
      sampleUsed: async () => ({ C: 0, D: used }),
      stopOwned: async () => stops++,
      persist: async (_, bytes) => {
        writes++;
        used += bytes.length;
      },
    });
    if (initial === 0) {
      await realm.write("D", Buffer.alloc(1));
      used = 63;
    }
    const before = writes;
    await assert.rejects(realm.write("D", Buffer.alloc(2)), /HARD_CAP_REACHED/u);
    assert.equal(writes, before);
    assert.equal(used, 63);
    assert.equal(stops, 1);
  }
});

test("caller mutation before or during an awaited sample cannot increase the admitted caps", async () => {
  for (const duringSample of [false, true]) {
    const caps = { C: 0, D: 64 };
    let writes = 0,
      stops = 0;
    const mutate = () => {
      caps.C = 100;
      caps.D = 1024;
    };
    const realm = createPrivateAllocationFixtureRealm({
      caps,
      sampleFree: async () => {
        if (duringSample) {
          await Promise.resolve();
          mutate();
        }
        return { C: floor + 1, D: floor + 4096 };
      },
      sampleUsed: async () => ({ C: 0, D: 0 }),
      stopOwned: async () => stops++,
      persist: async () => writes++,
    });
    if (!duringSample) mutate();
    await assert.rejects(realm.write("D", Buffer.alloc(65)), /HARD_CAP_REACHED/u);
    assert.equal(writes, 0);
    assert.equal(stops, 1);
  }
});
