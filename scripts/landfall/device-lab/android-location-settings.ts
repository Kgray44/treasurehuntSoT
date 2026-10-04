/** Public OS settings only, on an exclusively owned ephemeral hosted guest.
 * Raw UI hierarchies stay in memory and are never archived. No undocumented
 * Google settings key, mock geofence callback or injected broadcast is used. */
export async function inspectOwnedAndroidLocationAccuracy(adb: (args: string[], timeout?: number) => Promise<string>) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted")
    throw new Error("HOSTED_EPHEMERAL_LOCATION_SETTINGS_REQUIRED");
  if (!["ranchu", "goldfish"].includes((await adb(["shell", "getprop", "ro.hardware"])).trim()))
    throw new Error("LOCATION_SETTINGS_EMULATOR_REQUIRED");
  const file = "/data/local/tmp/landfall-location-settings.xml";
  type Node = { text: string; bounds: string; checked: string; className: string; packageName: string };
  const observed = {
    screens: 0,
    serviceEntryObserved: false,
    accuracyEntryObserved: false,
    accuracySwitchBefore: "UNOBSERVED",
    accuracySwitchAfter: "UNOBSERVED",
    changed: false,
  };
  const snapshot = async (): Promise<Node[]> => {
    await adb(["shell", "uiautomator", "dump", file], 15000);
    const xml = await adb(["shell", "cat", file]);
    observed.screens++;
    if (xml.length > 262144) throw new Error("LOCATION_SETTINGS_HIERARCHY_TOO_LARGE");
    return [...xml.matchAll(/<node\b([^>]+)>/g)]
      .map((match) => {
        const attr = (key: string) => new RegExp(`(?:^|\\s)${key}="([^"]*)"`).exec(match[1])?.[1] ?? "";
        return {
          text: attr("text"),
          bounds: attr("bounds"),
          checked: attr("checked"),
          className: attr("class"),
          packageName: attr("package"),
        };
      })
      .filter((node) => ["com.android.settings", "com.google.android.gms"].includes(node.packageName));
  };
  const tap = async (node: Node) => {
    const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(node.bounds);
    if (!match) throw new Error("LOCATION_SETTINGS_BOUNDS_UNOBSERVED");
    const [left, top, right, bottom] = match.slice(1).map(Number);
    if (right <= left || bottom <= top || right > 4096 || bottom > 4096)
      throw new Error("LOCATION_SETTINGS_BOUNDS_INVALID");
    await adb([
      "shell",
      "input",
      "tap",
      String(Math.floor((left + right) / 2)),
      String(Math.floor((top + bottom) / 2)),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 750));
  };
  try {
    await adb(["shell", "am", "start", "-W", "-a", "android.settings.LOCATION_SOURCE_SETTINGS"]);
    await new Promise((resolve) => setTimeout(resolve, 750));
    let nodes = await snapshot();
    const service = nodes.find((node) => node.text === "Location services");
    if (service) {
      observed.serviceEntryObserved = true;
      await tap(service);
      nodes = await snapshot();
    }
    const entry = nodes.find((node) => ["Google Location Accuracy", "Location Accuracy"].includes(node.text));
    if (entry) {
      observed.accuracyEntryObserved = true;
      await tap(entry);
      nodes = await snapshot();
    }
    const labels = nodes.some((node) => ["Improve Location Accuracy", "Improve location accuracy"].includes(node.text));
    const switches = nodes.filter((node) => /Switch/.test(node.className) && ["true", "false"].includes(node.checked));
    if (labels && switches.length === 1) {
      observed.accuracySwitchBefore = switches[0].checked === "true" ? "ENABLED" : "DISABLED";
      if (switches[0].checked === "false") {
        await tap(switches[0]);
        observed.changed = true;
        nodes = await snapshot();
      }
      const after = nodes.filter((node) => /Switch/.test(node.className) && ["true", "false"].includes(node.checked));
      if (after.length === 1) observed.accuracySwitchAfter = after[0].checked === "true" ? "ENABLED" : "DISABLED";
    }
    return observed;
  } finally {
    // This fixed single file was created above by the owned OS tool. The entire
    // ephemeral AVD, including any changed setting, is retired by its backend.
    await adb(["shell", "rm", "-f", file]);
    await adb(["shell", "input", "keyevent", "3"]);
  }
}
