type InputState = "ATTEMPT" | "ACKNOWLEDGED" | "TIMED_OUT";

/** One bounded retry of an idempotent OS input on a newly owned Simulator. */
export async function setOwnedAppleLabPosition(
  ownership: { deviceId: string; createdForScenario: boolean },
  coordinate: { latitude: number; longitude: number },
  driver: {
    run: (args: string[], timeoutMs: number) => Promise<unknown>;
    delay: (ms: number) => Promise<void>;
    observe: (attempt: number, state: InputState) => void;
  },
) {
  if (
    !ownership.createdForScenario ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(ownership.deviceId) ||
    !Number.isFinite(coordinate.latitude) ||
    Math.abs(coordinate.latitude) > 90 ||
    !Number.isFinite(coordinate.longitude) ||
    Math.abs(coordinate.longitude) > 180
  )
    throw new Error("LANDFALL_OWNED_APPLE_INPUT_REQUIRED");
  for (let attempt = 1; attempt <= 2; attempt++) {
    driver.observe(attempt, "ATTEMPT");
    try {
      await driver.run(
        ["simctl", "location", ownership.deviceId, "set", `${coordinate.latitude},${coordinate.longitude}`],
        15000,
      );
      driver.observe(attempt, "ACKNOWLEDGED");
      return;
    } catch (error) {
      const tool = error as { name?: unknown; code?: unknown; killed?: unknown; signal?: unknown } | null;
      if (
        !tool ||
        tool.name === "AbortError" ||
        tool.code != null ||
        tool.killed !== true ||
        tool.signal !== "SIGTERM"
      )
        throw error;
      driver.observe(attempt, "TIMED_OUT");
      if (attempt === 2) throw error;
      await driver.delay(250);
    }
  }
}
