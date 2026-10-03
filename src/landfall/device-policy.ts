import type { ConnectivityState, PermissionName, PermissionState } from "@/landfall/provider-policy";

export type LandfallLifecycle = "FOREGROUND" | "BACKGROUND" | "SCREEN_LOCKED" | "SUSPENDED" | "TERMINATED";
export type LandfallPowerProfile =
  | "PRECISION_ACTIVE"
  | "BALANCED_ACTIVE"
  | "BACKGROUND_LOW_POWER"
  | "OFFLINE_GUIDANCE"
  | "SUSPENDED";
export function landfallPowerPolicy(input: {
  lifecycle: LandfallLifecycle;
  connectivity: ConnectivityState;
  foregroundConsent: boolean;
  backgroundConsent: boolean;
  foregroundPermission: PermissionState;
  backgroundPermission: PermissionState;
  lowPower: boolean;
  thermalPressure: boolean;
  precisionRequested: boolean;
}) {
  const foreground = input.lifecycle === "FOREGROUND";
  const locationGranted = ["GRANTED", "APPROXIMATE", "LIMITED"].includes(input.foregroundPermission);
  const stopped = ["SUSPENDED", "TERMINATED"].includes(input.lifecycle) || !input.foregroundConsent || !locationGranted;
  const background = !foreground && !stopped && input.backgroundConsent && input.backgroundPermission === "GRANTED";
  let profile: LandfallPowerProfile = "SUSPENDED";
  if (!stopped && foreground) {
    profile =
      input.connectivity === "OFFLINE"
        ? "OFFLINE_GUIDANCE"
        : input.precisionRequested &&
            input.foregroundPermission === "GRANTED" &&
            !input.lowPower &&
            !input.thermalPressure
          ? "PRECISION_ACTIVE"
          : "BALANCED_ACTIVE";
  } else if (background) profile = "BACKGROUND_LOW_POWER";
  const constrained = input.lowPower || input.thermalPressure;
  return {
    profile,
    locationIntervalMs:
      profile === "SUSPENDED"
        ? null
        : profile === "PRECISION_ACTIVE"
          ? 1000
          : profile === "BACKGROUND_LOW_POWER"
            ? null
            : constrained
              ? 15_000
              : 5000,
    sensorIntervalMs: !foreground || stopped || constrained ? null : 250,
    renderMap: foreground && !["SUSPENDED", "TERMINATED"].includes(input.lifecycle),
    allowDownloads: foreground && !constrained && input.connectivity === "ONLINE",
    allowBackgroundSync: background && !constrained && input.connectivity === "ONLINE",
    geofenceWake: background,
    precisionReduced: profile !== "PRECISION_ACTIVE",
  } as const;
}

export const landfallPermissionExplanations: Record<
  PermissionName,
  { purpose: string; fallback: string; disable: string }
> = {
  FOREGROUND_LOCATION: {
    purpose: "Show your position while this journey is open.",
    fallback: "Use the written directions or ask your Captain to confirm arrival.",
    disable: "Pause location in the chart or revoke it in system settings.",
  },
  PRECISE_LOCATION: {
    purpose: "Improve outdoor position accuracy; indoor targets still need independent confirmation.",
    fallback: "Approximate location and human confirmation remain available.",
    disable: "Disable precise location in system settings.",
  },
  BACKGROUND_LOCATION: {
    purpose: "Offer broad nearby reminders when the app is in the background.",
    fallback: "Open the journey and confirm in the foreground.",
    disable: "Turn off nearby reminders or revoke background location in system settings.",
  },
  NOTIFICATIONS: {
    purpose: "Offer a private reminder to return to the current journey.",
    fallback: "Open the app to check your current waypoint.",
    disable: "Disable journey reminders or notifications in system settings.",
  },
  BLUETOOTH: {
    purpose: "Read optional nearby beacon hints for this journey.",
    fallback: "Use ordinary location, written observations or Captain confirmation.",
    disable: "Turn off beacon hints or revoke Bluetooth in system settings.",
  },
  NEARBY_DEVICES: {
    purpose: "Connect to an optional nearby ranging device selected for this journey.",
    fallback: "Use human or Captain confirmation.",
    disable: "Disconnect the device or revoke nearby-device access in system settings.",
  },
  CAMERA: {
    purpose: "Scan an optional code or compare a landmark you deliberately select.",
    fallback: "Use the written observation or Captain confirmation.",
    disable: "Close the scanner or revoke camera access in system settings.",
  },
  NFC: {
    purpose: "Read an optional journey tag when you choose to scan it.",
    fallback: "Use human or Captain confirmation.",
    disable: "Close tag scanning or disable NFC in system settings.",
  },
  MOTION: {
    purpose: "Improve short-term direction and movement hints without recording a location trail.",
    fallback: "Location and written guidance work without motion sensors.",
    disable: "Turn off sensor hints or revoke motion access in system settings.",
  },
  LOCAL_NETWORK: {
    purpose: "Connect to explicitly configured first-party local journey infrastructure.",
    fallback: "Use downloaded guidance or human confirmation.",
    disable: "Disconnect the local provider or revoke local-network access in system settings.",
  },
};

/** Request only the capability invoked by a deliberate action, never a first-launch permission sweep. */
export function contextualLandfallPermission(input: {
  permission: PermissionName;
  state: PermissionState;
  userAction: boolean;
  backgroundRequested: boolean;
  foregroundState: PermissionState;
}) {
  const explanation = landfallPermissionExplanations[input.permission];
  const available =
    input.state === "GRANTED" ||
    (input.permission === "FOREGROUND_LOCATION" && ["APPROXIMATE", "LIMITED"].includes(input.state));
  const mayPrompt =
    input.userAction &&
    ["UNKNOWN", "PROMPTABLE", "REVOKED", "APPROXIMATE", "LIMITED"].includes(input.state) &&
    !available &&
    (input.permission !== "BACKGROUND_LOCATION" ||
      (input.backgroundRequested && ["GRANTED", "APPROXIMATE", "LIMITED"].includes(input.foregroundState)));
  return {
    ...explanation,
    available,
    mayPrompt,
    openSettings: ["DENIED", "DENIED_PERMANENTLY"].includes(input.state),
    optional: true,
  };
}
