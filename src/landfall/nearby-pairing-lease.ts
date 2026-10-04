import { z } from "zod";

const leaseSchema = z.object({
  expiresAt: z.number().int().nonnegative(),
  remainingMs: z.number().int().min(1).max(45000),
});
export type NearbyPairLease = { serverExpiresAt: number; monotonicExpiresAt: number; monotonicObservedAt: number };

/** Server authority stays absolute; client/native timers use conservative remaining time. */
export function qualifyNearbyPairLease(
  response: unknown,
  requestedAt: number,
  monotonicNow: number,
  deviceWallNow: number,
  previous?: NearbyPairLease,
) {
  const lease = leaseSchema.parse(response);
  if (
    ![requestedAt, monotonicNow].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER,
    ) ||
    monotonicNow < requestedAt ||
    !Number.isSafeInteger(deviceWallNow) ||
    deviceWallNow < 0
  )
    throw new Error("PAIR_CHANGED");
  let deadline = monotonicNow + lease.remainingMs - Math.ceil(monotonicNow - requestedAt);
  if (previous) {
    if (
      previous.serverExpiresAt !== lease.expiresAt ||
      !Number.isFinite(previous.monotonicExpiresAt) ||
      !Number.isFinite(previous.monotonicObservedAt) ||
      monotonicNow < previous.monotonicObservedAt
    )
      throw new Error("PAIR_CHANGED");
    deadline = Math.min(deadline, previous.monotonicExpiresAt);
  }
  const remainingMs = Math.floor(deadline - monotonicNow);
  const nativeExpiresAt = deviceWallNow + remainingMs;
  if (remainingMs <= 0 || remainingMs > 45000 || !Number.isSafeInteger(nativeExpiresAt))
    throw new Error("PAIR_CHANGED");
  return {
    serverExpiresAt: lease.expiresAt,
    monotonicExpiresAt: deadline,
    monotonicObservedAt: monotonicNow,
    nativeExpiresAt,
    remainingMs,
  };
}
