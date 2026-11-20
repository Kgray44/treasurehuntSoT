// A sampled free-space value is not an enforceable native writer quota.
// No host confinement is installed or inferred by this local draft.
const GiB = 1073741824,
  MiB = 1048576;
export const PRIVATE_CAPTURE_RESERVE_BYTES = 30 * GiB;
export const PRIVATE_CAPTURE_ALLOCATION_RESOURCES = Object.freeze(
  [
    ["checkout", 2 * GiB],
    ["dependencies", 6 * GiB],
    ["browserCache", 2 * GiB],
    ["build", 8 * GiB],
    ["databaseProfiles", 2 * GiB],
    ["nativeTemp", 8 * GiB],
    ["logs", GiB],
    ["hostTools", 3 * GiB],
    ["captureProducer", 4 * GiB],
    ["readyAndOriginalJson", 8 * GiB],
    ["rawProducer", 4 * GiB],
    ["encryptedRaw", 9 * GiB],
    ["encryptedCurrent", 9 * GiB],
    ["providerArchive", 9 * GiB + 32 * MiB],
    ["privateView", 4 * GiB],
    ["metadataAndJournals", 64 * MiB],
  ].map(([name, bytes]) => Object.freeze({ name, bytes, drive: "D" })),
);
export function privateCaptureAllocationPlan() {
  const peak = { C: 0, D: 0 };
  for (const row of PRIVATE_CAPTURE_ALLOCATION_RESOURCES) peak[row.drive] += row.bytes;
  return Object.freeze({
    version: 1,
    classification: "PROPOSED_HARD_CEILINGS_NOT_MEASURED_CAPACITY",
    peak: Object.freeze(peak),
    resources: PRIVATE_CAPTURE_ALLOCATION_RESOURCES,
    overlap: "ALL_RETAINED;NO_UNPROVED_CLEANUP_CREDIT",
    requiredConfinement: "ALL_WRITES_DENIED_OUTSIDE_OWNED_CAPPED_VOLUMES",
    monitorIntervalMs: 1000,
  });
}
export function assessPrivateCaptureAllocation(freeBytes) {
  const plan = privateCaptureAllocationPlan(),
    blockers = [];
  for (const drive of ["C", "D"]) {
    if (!Number.isSafeInteger(freeBytes?.[drive]) || freeBytes[drive] < 0)
      throw new Error("PRIVATE_CAPTURE_ALLOCATION_FREE_BYTES_INVALID");
    if (freeBytes[drive] - plan.peak[drive] <= PRIVATE_CAPTURE_RESERVE_BYTES)
      blockers.push(`${drive}_PROJECTED_RESERVE`);
  }
  blockers.push("NATIVE_WRITE_CONFINEMENT_NOT_INSTALLED");
  return { status: "BLOCKED", plan, freeBytes: { ...freeBytes }, blockers };
}
export function admitPrivateNativeCapture() {
  throw new Error("PRIVATE_CAPTURE_ALLOCATION_NATIVE_WRITE_CONFINEMENT_NOT_INSTALLED");
}

// Test-only write admission and peak monitoring; never grants native producer
// admission. Every synthetic write crosses the cap before any disk allocation.
export function createPrivateAllocationFixtureRealm({ caps, sampleFree, sampleUsed, stopOwned, persist }) {
  caps = Object.freeze({ C: caps?.C, D: caps?.D });
  if (
    ![sampleFree, sampleUsed, stopOwned, persist].every((fn) => typeof fn === "function") ||
    !["C", "D"].every(
      (drive) =>
        Number.isSafeInteger(caps?.[drive]) &&
        caps[drive] >= 0 &&
        caps[drive] <= privateCaptureAllocationPlan().peak[drive],
    )
  )
    throw new Error("PRIVATE_CAPTURE_ALLOCATION_FIXTURE_INVALID");
  let stopped = false,
    busy = false;
  const reserved = { C: 0, D: 0 },
    peak = { C: 0, D: 0 };
  async function stop(reason) {
    if (!stopped) {
      stopped = true;
      await stopOwned(reason);
    }
    throw new Error(`PRIVATE_CAPTURE_ALLOCATION_${reason}`);
  }
  async function sample() {
    const free = await sampleFree(),
      used = await sampleUsed();
    for (const drive of ["C", "D"]) {
      if (![free[drive], used[drive]].every((value) => Number.isSafeInteger(value) && value >= 0))
        return stop("MEASUREMENT_INVALID");
      peak[drive] = Math.max(peak[drive], used[drive]);
      if (free[drive] <= PRIVATE_CAPTURE_RESERVE_BYTES || used[drive] > caps[drive])
        return stop("MONITORED_BOUND_REACHED");
    }
    return { free, used };
  }
  async function write(drive, bytes) {
    if (stopped || busy || !["C", "D"].includes(drive) || !Buffer.isBuffer(bytes))
      throw new Error("PRIVATE_CAPTURE_ALLOCATION_WRITE_NOT_ADMITTED");
    busy = true;
    try {
      const { free, used } = await sample();
      for (const volume of ["C", "D"])
        if (free[volume] - (caps[volume] - used[volume]) <= PRIVATE_CAPTURE_RESERVE_BYTES)
          return await stop("PROJECTED_RESERVE");
      const accounted = Math.max(used[drive], reserved[drive]);
      if (accounted + bytes.length > caps[drive]) return await stop("HARD_CAP_REACHED");
      reserved[drive] = accounted + bytes.length;
      await persist(drive, bytes);
      await sample();
    } finally {
      busy = false;
    }
  }
  return Object.freeze({
    write,
    sample,
    receipt: () => ({
      classification: "SYNTHETIC_ONLY_NOT_NATIVE_CONFINEMENT",
      peak: { ...peak },
      reserved: { ...reserved },
      stopped,
    }),
  });
}
