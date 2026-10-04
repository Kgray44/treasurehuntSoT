import { physicalCoordinate, virtualCoordinate } from "@/landfall/fixtures";
import { deviceLabScenarioSchema, type DeviceLabAction, type DeviceLabScenario } from "@/landfall/device-lab/scenario";

const location = (overrides: Partial<Extract<DeviceLabAction, { type: "LOCATION" }>> = {}): DeviceLabAction => ({
  type: "LOCATION",
  coordinate: physicalCoordinate(44, -72),
  accuracy: 8,
  ageMs: 0,
  provider: "ANDROID",
  duplicate: false,
  ...overrides,
});
const assertion = (
  field: Extract<DeviceLabAction, { type: "ASSERT" }>["field"],
  value: Extract<DeviceLabAction, { type: "ASSERT" }>["value"],
): DeviceLabAction => ({ type: "ASSERT", field, value });
const network = (state: Extract<DeviceLabAction, { type: "NETWORK" }>["state"]): DeviceLabAction => ({
  type: "NETWORK",
  state,
  latencyMs: state === "DEGRADED" ? 5000 : 0,
  packetLossPercent: state === "DEGRADED" ? 30 : state === "OFFLINE" ? 100 : 0,
});
const power = (saver: boolean, batteryPercent = saver ? 15 : 75): DeviceLabAction => ({
  type: "POWER",
  batteryPercent,
  saver,
  charging: false,
  thermal: false,
  doze: false,
});
const lifecycle = (
  state: Extract<DeviceLabAction, { type: "LIFECYCLE" }>["state"],
  operation?: Extract<DeviceLabAction, { type: "LIFECYCLE" }>["operation"],
): DeviceLabAction => ({ type: "LIFECYCLE", state, ...(operation ? { operation } : {}) });
const cases: DeviceLabScenario[] = [];
function scenario(
  id: string,
  providers: DeviceLabScenario["providers"],
  actions: DeviceLabAction[],
  physicalRequired: DeviceLabScenario["physicalRequired"] = [],
  canonicalAuthority: DeviceLabScenario["canonicalAuthority"] = "NONE",
  worldspace: DeviceLabScenario["worldspace"] = "PHYSICAL",
) {
  cases.push(
    deviceLabScenarioSchema.parse({
      id,
      version: 1,
      seed: 1729,
      description: `Reproduce ${id.replaceAll("-", " ")} through canonical Landfall adapters.`,
      worldspace,
      publishedFixture: "landfall-device-lab-v1",
      canonicalAuthority,
      targets: ["provider-simulation", "android-emulator", "ios-simulator", "real-android", "real-ios"],
      deviceProfiles: ["primary-phone", "compatibility-phone", "low-resource", "tablet"],
      providers,
      timing: "LOGICAL",
      toleranceMs: 0,
      physicalRequired,
      timeline: actions.map((action, index) => ({ atMs: index * 1000, action })),
    }),
  );
}
scenario(
  "gps-perfect-walk",
  ["LOCATION"],
  [
    location(),
    location({ coordinate: physicalCoordinate(44.00002, -72) }),
    assertion("confidence", "CONFIRMED"),
    assertion("completionRequests", 1),
    assertion("serverConfirmed", false),
  ],
  ["FIELD_ENVIRONMENT"],
);
scenario(
  "gps-noisy-walk",
  ["LOCATION"],
  [location({ accuracy: 200 }), location({ accuracy: 200 }), assertion("completionRequests", 0)],
  ["GPS_MULTIPATH"],
);
scenario("gps-stale", ["LOCATION"], [location({ ageMs: 120000 }), assertion("completionRequests", 0)]);
scenario(
  "gps-lost",
  ["LOCATION"],
  [
    { type: "PROVIDER", family: "LOCATION", health: "UNAVAILABLE" },
    assertion("providerState", "UNAVAILABLE"),
    assertion("completionRequests", 0),
  ],
);
scenario(
  "gps-impossible-jump",
  ["LOCATION"],
  [
    location({ provider: "BROWSER" }),
    location({ provider: "BROWSER", coordinate: physicalCoordinate(45, -73) }),
    assertion("rejection", "IMPOSSIBLE_SPEED"),
    assertion("completionRequests", 0),
  ],
);
scenario(
  "route-deviation",
  ["LOCATION", "ROUTING"],
  [location({ coordinate: physicalCoordinate(44.02, -72.02) }), assertion("completionRequests", 0)],
  ["FIELD_ENVIRONMENT"],
);
scenario(
  "approximate-location",
  ["LOCATION"],
  [
    { type: "PERMISSION", permission: "FOREGROUND_LOCATION", state: "APPROXIMATE" },
    location({ accuracy: 300 }),
    assertion("powerProfile", "BALANCED_ACTIVE"),
    assertion("completionRequests", 0),
  ],
);
scenario(
  "permission-revoked-mid-route",
  ["LOCATION"],
  [
    location(),
    { type: "PERMISSION", permission: "FOREGROUND_LOCATION", state: "REVOKED" },
    location(),
    assertion("completionRequests", 0),
    assertion("powerProfile", "SUSPENDED"),
  ],
);
scenario(
  "permission-denied-native",
  ["LOCATION"],
  [
    { type: "PERMISSION", permission: "FOREGROUND_LOCATION", state: "DENIED" },
    location(),
    assertion("completionRequests", 0),
    assertion("powerProfile", "SUSPENDED"),
    assertion("serverConfirmed", false),
  ],
);
scenario(
  "permission-approximate-native",
  ["LOCATION"],
  [
    { type: "PERMISSION", permission: "FOREGROUND_LOCATION", state: "APPROXIMATE" },
    assertion("powerProfile", "BALANCED_ACTIVE"),
    assertion("completionRequests", 0),
    assertion("serverConfirmed", false),
  ],
);
cases[cases.length - 1].targets = ["provider-simulation", "android-emulator", "real-android", "real-ios"];
scenario(
  "gps-urban-canyon-synthetic",
  ["LOCATION"],
  [
    location({ accuracy: 500 }),
    location({ accuracy: 1000, coordinate: physicalCoordinate(44.01, -72) }),
    assertion("completionRequests", 0),
  ],
  ["GPS_MULTIPATH"],
);
for (const [id, state, operation] of [
  ["screen-lock", "SCREEN_LOCKED"],
  ["background", "BACKGROUND"],
  ["long-background", "SUSPENDED"],
  ["force-close", "TERMINATED", "FORCE_STOP"],
  ["process-kill", "TERMINATED", "PROCESS_KILL"],
  ["activity-recreation", "RELAUNCH", "ACTIVITY_RECREATE"],
  ["relaunch", "RELAUNCH"],
  ["resume", "FOREGROUND"],
] as const)
  scenario(
    id,
    ["LOCATION"],
    [location(), lifecycle(state, operation), assertion("serverConfirmed", false)],
    ["SUSPENSION", "OEM_PROCESS_POLICY"],
  );
scenario(
  "background-geofence-arrival",
  ["GEOFENCE", "LOCATION"],
  [
    lifecycle("BACKGROUND"),
    { type: "GEOFENCE", event: "ENTER", ageMs: 0, duplicate: false },
    assertion("backgroundResult", "NEARBY_HINT"),
    assertion("completionRequests", 0),
    lifecycle("FOREGROUND"),
    location(),
    location(),
    assertion("confidence", "CONFIRMED"),
    assertion("serverConfirmed", false),
  ],
  ["SUSPENSION", "FIELD_ENVIRONMENT"],
);
scenario(
  "geofence-duplicate",
  ["GEOFENCE"],
  [
    { type: "GEOFENCE", event: "ENTER", ageMs: 0, duplicate: false },
    { type: "GEOFENCE", event: "ENTER", ageMs: 0, duplicate: true },
    assertion("backgroundResult", "DUPLICATE"),
    assertion("completionRequests", 0),
  ],
);
scenario(
  "geofence-stale",
  ["GEOFENCE"],
  [
    { type: "GEOFENCE", event: "ENTER", ageMs: 600000, duplicate: false },
    assertion("backgroundResult", "STALE"),
    assertion("completionRequests", 0),
  ],
);
for (const [id, operation, state] of [
  ["notification-return", "OPEN", "CURRENT_JOURNEY"],
  ["notification-stale", "EXPIRE", "EXPIRED"],
  ["notification-revoked", "REVOKE_SESSION", "UNAVAILABLE"],
  ["notification-completed", "COMPLETE_SESSION", "COMPLETED_JOURNEY"],
  ["notification-duplicate", "DUPLICATE", "CURRENT_JOURNEY"],
] as const)
  scenario(
    id,
    ["NOTIFICATION"],
    [{ type: "NOTIFICATION", operation }, assertion("notificationState", state), assertion("serverConfirmed", false)],
  );
scenario("battery-normal", ["LOCATION"], [power(false), assertion("powerProfile", "PRECISION_ACTIVE")], ["BATTERY"]);
scenario("battery-low", ["LOCATION"], [power(false, 10), assertion("powerProfile", "BALANCED_ACTIVE")], ["BATTERY"]);
scenario("battery-saver", ["LOCATION"], [power(true), assertion("powerProfile", "BALANCED_ACTIVE")], ["BATTERY"]);
scenario(
  "low-power-mode",
  ["LOCATION"],
  [power(true), lifecycle("BACKGROUND"), assertion("powerProfile", "BACKGROUND_LOW_POWER")],
  ["BATTERY"],
);
scenario(
  "doze",
  ["LOCATION"],
  [
    { ...power(true), type: "POWER", batteryPercent: 15, saver: true, charging: false, thermal: false, doze: true },
    lifecycle("BACKGROUND"),
    assertion("completionRequests", 0),
  ],
  ["SUSPENSION", "OEM_PROCESS_POLICY"],
);
scenario(
  "charger-change",
  ["LOCATION"],
  [
    { type: "POWER", batteryPercent: 50, saver: false, charging: true, thermal: false, doze: false },
    { type: "POWER", batteryPercent: 49, saver: false, charging: false, thermal: false, doze: false },
    assertion("serverConfirmed", false),
  ],
  ["BATTERY"],
);
for (const [id, states] of [
  ["good-network", ["ONLINE"]],
  ["poor-network", ["DEGRADED"]],
  ["high-latency", ["DEGRADED"]],
  ["offline", ["OFFLINE"]],
  ["reconnect", ["OFFLINE", "ONLINE"]],
  ["network-flapping", ["OFFLINE", "ONLINE", "OFFLINE", "ONLINE"]],
] as const)
  scenario(id, ["CONNECTIVITY"], [...states.map(network), assertion("serverConfirmed", false)]);
for (const family of ["MAP_DATA", "GEOCODING", "ROUTING", "ELEVATION", "VISION", "GAME_STATE"] as const)
  scenario(
    `${family.toLowerCase().replaceAll("_", "-")}-outage`,
    [family],
    [
      { type: "PROVIDER", family, health: "UNAVAILABLE" },
      assertion("providerState", "UNAVAILABLE"),
      assertion("serverConfirmed", false),
    ],
  );
scenario(
  "provider-rate-limit",
  ["MAP_DATA"],
  [
    { type: "PROVIDER", family: "MAP_DATA", health: "RATE_LIMITED" },
    assertion("providerState", "RATE_LIMITED"),
    assertion("serverConfirmed", false),
  ],
);
for (const [id, kind, values] of [
  ["heading-turn", "HEADING", [90, 10]],
  ["heading-drift", "HEADING", [180, 120]],
  ["motion-walk", "MOTION", [1]],
  ["stationary", "MOTION", [0]],
  ["barometer-floor-change", "BAROMETER", [1013, 1012]],
  ["sensor-conflict", "CONFLICT", [0, 180]],
  ["sensor-missing", "MISSING", []],
  ["accelerometer-walk", "ACCELEROMETER", [1, 0, 9.8]],
  ["orientation-turn", "ORIENTATION", [90, 0, 0]],
] as const) {
  scenario(
    id,
    [kind === "HEADING" ? "HEADING" : kind === "BAROMETER" ? "BAROMETER" : "MOTION"],
    [
      { type: "SENSOR", kind, values: kind === "BAROMETER" ? [values[0]] : [...values] },
      ...(kind === "BAROMETER" ? [{ type: "SENSOR" as const, kind, values: [values[1]] }] : []),
      assertion("sensorState", kind === "CONFLICT" ? "CONFLICT" : kind === "MISSING" ? "UNAVAILABLE" : "READY"),
      assertion("completionRequests", 0),
      assertion("serverConfirmed", false),
    ],
    ["SENSOR_DRIFT"],
  );
  cases[cases.length - 1].version = 2;
}
for (const family of ["UWB", "BLE"] as const)
  for (const state of (family === "UWB"
    ? ["APPROACH", "RETREAT", "DIRECTION", "DISCONNECT", "RECONNECT", "PEER_LOST", "UNSUPPORTED"]
    : ["STRONG", "WEAK", "DISCONNECT", "RECONNECT", "MULTIPLE", "DISABLED"]) as Extract<
    DeviceLabAction,
    { type: "NEARBY" }
  >["state"][])
    scenario(
      `${family.toLowerCase()}-${state.toLowerCase().replaceAll("_", "-")}`,
      [family],
      [{ type: "NEARBY", family, state, distance: 2, uncertainty: 1 }, assertion("completionRequests", 0)],
      ["RF"],
    );
for (const medium of ["QR", "NFC"] as const)
  for (const fixture of [
    "VALID",
    "EXPIRED",
    "DUPLICATE",
    "WRONG_CHRONICLE",
    "WRONG_VERSION",
    "TAMPERED",
    "MALFORMED",
    "UNSIGNED",
    "REPLAY",
    "UNRELATED",
  ] as const)
    scenario(
      `${medium.toLowerCase()}-${fixture.toLowerCase().replaceAll("_", "-")}`,
      [medium],
      [{ type: "TOKEN", medium, fixture }, assertion("serverConfirmed", false)],
      medium === "QR" ? ["CAMERA"] : ["NFC_RADIO"],
    );
for (const operation of ["DOWNLOAD", "INTERRUPT", "CORRUPT", "STORAGE_LOW", "STALE", "DELETE", "EXPIRE"] as const)
  scenario(
    `package-${operation.toLowerCase().replaceAll("_", "-")}`,
    ["OFFLINE_PACKAGE"],
    [{ type: "PACKAGE", operation }, assertion("serverConfirmed", false)],
  );
for (const outcome of ["ACCEPT", "CONFLICT", "REVOKED", "UNAVAILABLE", "DUPLICATE"] as const)
  scenario(
    `reconcile-${outcome.toLowerCase()}`,
    ["OFFLINE_PACKAGE"],
    [
      network("OFFLINE"),
      location(),
      location(),
      lifecycle("TERMINATED"),
      lifecycle("RELAUNCH"),
      network("ONLINE"),
      { type: "RECONCILE", outcome },
      assertion("serverConfirmed", false),
    ],
  );
scenario(
  "compound-chaos",
  ["LOCATION", "GEOFENCE", "OFFLINE_PACKAGE", "NOTIFICATION"],
  [
    location({ accuracy: 100 }),
    network("OFFLINE"),
    lifecycle("BACKGROUND"),
    lifecycle("SCREEN_LOCKED"),
    power(true),
    { type: "GEOFENCE", event: "ENTER", ageMs: 0, duplicate: false },
    assertion("completionRequests", 0),
    lifecycle("FOREGROUND"),
    location(),
    location(),
    assertion("serverConfirmed", false),
    lifecycle("TERMINATED"),
    network("ONLINE"),
    lifecycle("RELAUNCH"),
    { type: "RECONCILE", outcome: "ACCEPT" },
    assertion("serverConfirmed", false),
  ],
  ["SUSPENSION", "BATTERY", "GPS_MULTIPATH", "FIELD_ENVIRONMENT"],
);

scenario(
  "offline-native-canonical-reconcile",
  ["LOCATION", "OFFLINE_PACKAGE"],
  [
    network("OFFLINE"),
    location(),
    location({ coordinate: physicalCoordinate(44.00002, -72) }),
    assertion("serverConfirmed", false),
    network("ONLINE"),
    { type: "RECONCILE", outcome: "ACCEPT" },
    assertion("serverConfirmed", true),
    assertion("canonicalProgressionEvents", 1),
  ],
  ["FIELD_ENVIRONMENT"],
  "ONE_VOYAGE",
);

/** One semantic corpus; backends translate these actions rather than maintaining independent test stories. */
scenario(
  "offline-lost-response-canonical-reconcile",
  ["LOCATION", "OFFLINE_PACKAGE"],
  [
    network("OFFLINE"),
    location(),
    location({ coordinate: physicalCoordinate(44.00002, -72) }),
    network("ONLINE"),
    { type: "RECONCILE", outcome: "LOST_RESPONSE" },
    assertion("canonicalProgressionEvents", 1),
    assertion("clientConfirmed", false),
    { type: "RECONCILE", outcome: "DUPLICATE" },
    assertion("canonicalProgressionEvents", 1),
    assertion("clientConfirmed", true),
  ],
  ["FIELD_ENVIRONMENT"],
  "ONE_VOYAGE",
);

scenario(
  "offline-restart-canonical-reconcile",
  ["LOCATION", "OFFLINE_PACKAGE"],
  [
    network("OFFLINE"),
    location(),
    location({ coordinate: physicalCoordinate(44.00002, -72) }),
    assertion("completionRequests", 1),
    assertion("canonicalProgressionEvents", 0),
    lifecycle("TERMINATED", "FORCE_STOP"),
    lifecycle("RELAUNCH"),
    assertion("completionRequests", 1),
    assertion("clientConfirmed", false),
    network("ONLINE"),
    { type: "RECONCILE", outcome: "ACCEPT" },
    assertion("clientConfirmed", true),
    assertion("canonicalProgressionEvents", 1),
  ],
  ["FIELD_ENVIRONMENT"],
  "ONE_VOYAGE",
);

scenario(
  "virtual-player-navigation",
  ["VIRTUAL_REGION"],
  [
    location({ coordinate: virtualCoordinate(0.1, 0.1), accuracy: 0.001, provider: "BROWSER" }),
    assertion("completionRequests", 0),
    location({ coordinate: virtualCoordinate(0.5, 0.5), accuracy: 0.001, provider: "BROWSER" }),
    assertion("completionRequests", 1),
    assertion("physicalAcquisitionStarts", 0),
    assertion("serverConfirmed", false),
  ],
  [],
  "NONE",
  "VIRTUAL",
);

scenario(
  "virtual-offline-canonical-reconcile",
  ["VIRTUAL_REGION", "OFFLINE_PACKAGE"],
  [
    network("OFFLINE"),
    location({ coordinate: virtualCoordinate(0.5, 0.5), accuracy: 0.001, provider: "BROWSER" }),
    assertion("completionRequests", 1),
    assertion("canonicalProgressionEvents", 0),
    assertion("physicalAcquisitionStarts", 0),
    network("ONLINE"),
    { type: "RECONCILE", outcome: "ACCEPT" },
    assertion("canonicalProgressionEvents", 1),
    assertion("clientConfirmed", true),
    assertion("physicalAcquisitionStarts", 0),
  ],
  [],
  "ONE_VOYAGE",
  "VIRTUAL",
);

for (const minutes of [5, 30]) {
  const duration = minutes * 60_000;
  const ticks = duration / 10_000;
  const timeline: DeviceLabScenario["timeline"] = [];
  for (let tick = 0; tick <= ticks; tick++) {
    const distanceMeters = ((duration - tick * 10_000) / 1000) * 1.4;
    timeline.push({
      atMs: tick * 10_000,
      action: location({ coordinate: physicalCoordinate(44 - distanceMeters / 111320, -72) }),
    });
    if (tick === 0) timeline.push({ atMs: 0, action: assertion("completionRequests", 0) });
  }
  timeline.push(
    { atMs: duration + 1000, action: location() },
    { atMs: duration + 1001, action: assertion("confidence", "CONFIRMED") },
    { atMs: duration + 1002, action: assertion("completionRequests", 1) },
    { atMs: duration + 1003, action: assertion("serverConfirmed", false) },
  );
  scenario(
    `gps-${minutes}-minute-walk`,
    ["LOCATION", "ROUTING"],
    timeline.map((step) => step.action),
    ["BATTERY", "FIELD_ENVIRONMENT"],
  );
  const generated = cases.pop()!;
  cases.push(
    deviceLabScenarioSchema.parse({
      ...generated,
      description: `Synthetic ${minutes}-minute 1.4 m/s walk; logical provider time or real OS time. It does not measure physical battery endurance.`,
      timeline,
    }),
  );
}

for (const worldspace of ["PHYSICAL", "VIRTUAL"] as const) {
  for (const [fixture, expected] of [
    ["MATCH", "PRESENT"],
    ["UNCERTAIN", "UNCERTAIN"],
    ["NOT_MATCH", "ABSENT"],
    ["NOT_CONFIGURED", "NOT_CONFIGURED"],
    ["WRONG_SCOPE", "LANDFALL_WATCHGLASS_SCOPE_MISMATCH"],
    ["WRONG_PACKAGE", "LANDFALL_WATCHGLASS_SCOPE_MISMATCH"],
    ["EXPIRED", "LANDFALL_WATCHGLASS_STALE"],
    ["CIRCULAR", "LANDFALL_WATCHGLASS_CIRCULAR_EVIDENCE"],
  ] as const) {
    scenario(
      `watchglass-${worldspace.toLowerCase()}-${fixture.toLowerCase().replaceAll("_", "-")}`,
      ["VISION"],
      [
        { type: "WATCHGLASS", fixture },
        assertion("watchglassState", expected),
        assertion("completionRequests", 0),
        assertion("serverConfirmed", false),
      ],
      [],
      "NONE",
      worldspace,
    );
    const generated = cases.pop()!;
    cases.push(
      deviceLabScenarioSchema.parse({
        ...generated,
        targets: ["provider-simulation"],
        description:
          "Synthetic trusted Watchglass handoff contract only. No recognition model, frames, installed package or real certification is exercised.",
      }),
    );
  }
}

// A fresh OS fix is requested at each distinct route point; repeated simctl set
// commands at an unchanged coordinate need not cause another Core Location event.
for (const id of [
  "gps-perfect-walk",
  "offline-native-canonical-reconcile",
  "offline-lost-response-canonical-reconcile",
  "offline-restart-canonical-reconcile",
]) {
  cases.find((item) => item.id === id)!.version = 2;
}

scenario(
  "uwb-native-peer-session",
  ["UWB"],
  [
    { type: "NEARBY", family: "UWB", state: "RECONNECT" },
    assertion("serverConfirmed", false),
    { type: "NEARBY", family: "UWB", state: "DISCONNECT" },
    assertion("nearbyState", "UNAVAILABLE"),
    assertion("canonicalProgressionEvents", 0),
  ],
  ["RF"],
  "ONE_VOYAGE",
);
const radioScenario = cases.pop()!;
cases.push(
  deviceLabScenarioSchema.parse({
    ...radioScenario,
    targets: ["provider-simulation", "android-emulator", "real-android"],
    deviceProfiles: ["primary-phone", "low-resource"],
    description:
      "Pair two configured peers, observe an actual native UWB report where supported, stop both sessions and retain zero canonical progression. No distance accuracy or peer-identity claim.",
  }),
);

for (const [operation, fixture, expected, requests] of [
  ["STATUS", "VALID", "STATUS", 0],
  ["SEARCH", "VALID", "RESULT", 1],
  ["REVERSE", "VALID", "RESULT", 1],
  ["ROUTE", "VALID", "RESULT", 1],
  ["ELEVATION", "VALID", "RESULT", 1],
  ["SEARCH", "NOT_CONFIGURED", "NOT_CONFIGURED", 0],
  ["SEARCH", "RATE_LIMITED", "RATE_LIMITED", 1],
  ["SEARCH", "MALFORMED", "UNAVAILABLE", 1],
  ["SEARCH", "ABORTED", "UNAVAILABLE", 1],
] as const) {
  scenario(
    `remote-${operation.toLowerCase()}-${fixture.toLowerCase().replaceAll("_", "-")}`,
    [operation === "ROUTE" ? "ROUTING" : operation === "ELEVATION" ? "ELEVATION" : "GEOCODING"],
    [
      { type: "REMOTE_DATA", operation, fixture },
      assertion("remoteDataState", expected),
      assertion("remoteDataRequests", requests),
      ...(fixture === "RATE_LIMITED"
        ? ([
            { type: "REMOTE_DATA", operation, fixture },
            assertion("remoteDataState", expected),
            assertion("remoteDataRequests", 1),
          ] satisfies DeviceLabAction[])
        : []),
      assertion("physicalAcquisitionStarts", 0),
      assertion("completionRequests", 0),
      assertion("serverConfirmed", false),
    ],
  );
  const generated = cases.pop()!;
  cases.push(
    deviceLabScenarioSchema.parse({
      ...generated,
      targets: ["provider-simulation"],
      description:
        "Actual online adapters with synthetic transport and logical quota time. No external network, service credentials, OS behavior or physical arrival is exercised.",
    }),
  );
}

export function landfallDeviceScenarios(): DeviceLabScenario[] {
  return structuredClone(cases);
}
export function landfallDeviceScenario(id: string): DeviceLabScenario {
  const scenario = cases.find((item) => item.id === id);
  if (!scenario) throw new Error("LANDFALL_LAB_SCENARIO_UNKNOWN");
  return structuredClone(scenario);
}
