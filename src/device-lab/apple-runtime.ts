type AppleRuntime = { id: string; available: boolean };
type AppleDevice = { runtime: string; available: boolean };

export const appleRuntimeSelectionPolicy = "PREINSTALLED_LATEST_SUPPORTED" as const;

/** Read the same source deployment floor used by the native companion build. */
export function appleMinimumIosFromProject(project: string): string {
  const minimum = project.match(/^\s+iOS:\s*"([0-9.]+)"/m)?.[1];
  if (!minimum) throw new Error("LANDFALL_APPLE_DEPLOYMENT_TARGET_UNAVAILABLE");
  return minimum;
}

/** The existing companion policy, shared with other owned Apple lab consumers. */
export function selectLatestSupportedAppleRuntime<T extends AppleRuntime>(
  inventory: { runtimes: readonly T[]; devices: readonly AppleDevice[] },
  minimumIOS: string,
): T {
  const versionScore = (value: string) =>
    value
      .split(/[.-]/)
      .map(Number)
      .reduce((total, part, index) => total + part * (index === 0 ? 1000000 : index === 1 ? 1000 : 1), 0);
  const runtime = inventory.runtimes
    .filter((item) => {
      const version = item.id.match(/\.iOS-([0-9-]+)$/)?.[1];
      return (
        item.available &&
        version !== undefined &&
        versionScore(version) >= versionScore(minimumIOS) &&
        inventory.devices.some((device) => device.available && device.runtime === item.id)
      );
    })
    .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0];
  if (!runtime) throw new Error("LANDFALL_APPLE_RUNTIME_UNAVAILABLE");
  return runtime;
}
