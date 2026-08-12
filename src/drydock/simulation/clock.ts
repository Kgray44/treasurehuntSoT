export const DRYDOCK_VIRTUAL_CLOCK_VERSION = "virtual-clock-v1";

export type DrydockVirtualClock = Readonly<{
  version: typeof DRYDOCK_VIRTUAL_CLOCK_VERSION;
  startedAt: string;
  currentAt: string;
  elapsedMilliseconds: number;
}>;

function validIsoInstant(value: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value)
    throw new Error("Drydock virtual time must be an exact ISO-8601 instant.");
  return milliseconds;
}

export function createDrydockVirtualClock(startedAt: string): DrydockVirtualClock {
  validIsoInstant(startedAt);
  return {
    version: DRYDOCK_VIRTUAL_CLOCK_VERSION,
    startedAt,
    currentAt: startedAt,
    elapsedMilliseconds: 0,
  };
}

export function advanceDrydockVirtualClock(
  clock: DrydockVirtualClock,
  milliseconds: number,
  maximumElapsedMilliseconds: number,
): DrydockVirtualClock {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0)
    throw new Error("Drydock virtual time advances must be non-negative safe integers.");
  if (!Number.isSafeInteger(maximumElapsedMilliseconds) || maximumElapsedMilliseconds < 0)
    throw new Error("Drydock virtual time limit must be a non-negative safe integer.");
  const elapsedMilliseconds = clock.elapsedMilliseconds + milliseconds;
  if (!Number.isSafeInteger(elapsedMilliseconds) || elapsedMilliseconds > maximumElapsedMilliseconds)
    throw new Error("Drydock virtual time limit exhausted.");
  const startedAt = validIsoInstant(clock.startedAt);
  return {
    version: DRYDOCK_VIRTUAL_CLOCK_VERSION,
    startedAt: clock.startedAt,
    currentAt: new Date(startedAt + elapsedMilliseconds).toISOString(),
    elapsedMilliseconds,
  };
}
