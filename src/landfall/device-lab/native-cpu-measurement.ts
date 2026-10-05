type CpuSnapshot = { system: number[]; processTicks: number; processStart: number };

/** Parse in memory only. No process identifier, name or epoch is exported. */
export function nativeCpuSnapshot(systemStat: string, processStat: string): CpuSnapshot {
  const aggregate = /^cpu\s+([0-9]+(?:\s+[0-9]+){7,9})\s*$/m.exec(systemStat);
  const process = /^[0-9]+ \([^\r\n]*\) ([A-Za-z]) (.*)\s*$/.exec(processStat.trim());
  if (!aggregate || !process) throw new Error("NATIVE_CPU_COUNTERS_UNOBSERVED");
  const system = aggregate[1].trim().split(/\s+/).slice(0, 8).map(Number);
  const fields = process[2].trim().split(/\s+/);
  // fields begin at stat field 4: utime=14, stime=15, starttime=22.
  const user = Number(fields[10]),
    kernel = Number(fields[11]),
    processStart = Number(fields[18]);
  if (![...system, user, kernel, processStart].every((value) => Number.isSafeInteger(value) && value >= 0))
    throw new Error("NATIVE_CPU_COUNTERS_INVALID");
  if (!Number.isSafeInteger(user + kernel)) throw new Error("NATIVE_CPU_COUNTERS_INVALID");
  return { system, processTicks: user + kernel, processStart };
}

/** Capacity-normalized parent CPU and whole-guest CPU during a real Journal interval. */
export function nativeCpuMeasurement(before: CpuSnapshot, after: CpuSnapshot, elapsedMs: number) {
  if (
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 10000 ||
    elapsedMs > 60000 ||
    before.processStart !== after.processStart
  )
    throw new Error("NATIVE_CPU_INTERVAL_INVALID");
  const deltas = after.system.map((value, index) => value - before.system[index]);
  const total = deltas.reduce((sum, value) => sum + value, 0);
  const parent = after.processTicks - before.processTicks;
  if (
    !deltas.every((value) => Number.isSafeInteger(value) && value >= 0) ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    parent < 0 ||
    parent > total
  )
    throw new Error("NATIVE_CPU_INTERVAL_INVALID");
  // Exclude idle, iowait and steal from active execution; guest columns are
  // already included in user/nice and must not be counted twice.
  const active = deltas[0] + deltas[1] + deltas[2] + deltas[5] + deltas[6];
  return {
    elapsedMs,
    capacity: "ALL_GUEST_VCPUS" as const,
    nativeParentCpuPercent: Number(((100 * parent) / total).toFixed(3)),
    wholeGuestActiveCpuPercent: Number(((100 * active) / total).toFixed(3)),
    rendererAttribution: "INCLUDED_IN_GUEST_NOT_SEPARATELY_ATTRIBUTED" as const,
  };
}
