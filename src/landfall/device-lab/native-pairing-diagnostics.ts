/** Export only a finite clock category; exchange secrets and epochs stay in memory. */
export function nativePairingLeaseClockBand(expiresAt: unknown, clientNow: unknown) {
  if (
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < 0 ||
    typeof clientNow !== "number" ||
    !Number.isSafeInteger(clientNow) ||
    clientNow < 0
  )
    return "UNOBSERVED" as const;
  const remaining = expiresAt - clientNow;
  return remaining <= 0
    ? ("EXPIRED" as const)
    : remaining > 45000
      ? ("BEYOND_CLIENT_45S" as const)
      : ("WITHIN_CLIENT_45S" as const);
}
