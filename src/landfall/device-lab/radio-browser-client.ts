import { landfallFixture } from "@/landfall/fixtures";
import { NativeLandfallUwbProvider, type NativeUwbConfiguration } from "@/landfall/native-uwb";
import { landfallNativeRequest } from "@/landfall/native-bridge";
import { z } from "zod";
import { NativeLandfallBleProvider } from "@/landfall/native-ble";

/** Owned lab origin only; bundled separately and never imported by the application. */
const provider = new NativeLandfallUwbProvider(landfallFixture.worldspaces[0]);
const ble = new NativeLandfallBleProvider(landfallFixture.worldspaces[0]);
let validatedSignals = 0;
let validatedRanges = 0;
Object.defineProperty(window, "__LandfallLabRadio", {
  value: Object.freeze({
    ble: Object.freeze({
      start: () =>
        ble.start(true, (value) => {
          if (value.state === "UNTRUSTED") validatedSignals++;
        }),
      stop: () => ble.stop(),
      snapshot: () => ({ ...ble.snapshot(), validatedSignals }),
    }),
    prepare: (role: "CONTROLLER" | "CONTROLEE") => provider.prepare(role, true),
    start: (configuration: NativeUwbConfiguration) =>
      provider.start(configuration, (projection) => {
        if (projection.rangeAvailable && projection.state === "UNTRUSTED") validatedRanges++;
      }),
    stop: () => provider.stop(),
    snapshot: () => ({ ...provider.snapshot(), validatedRanges }),
    nativeState: async () =>
      z
        .strictObject({
          state: z.enum(["UNAVAILABLE", "READY", "INITIALIZING", "UNSUPPORTED", "PROMPTABLE", "EXPIRED"]),
          supported: z.boolean(),
          sessionProtected: z.boolean(),
          peerVerified: z.literal(false),
        })
        .parse(await landfallNativeRequest("UWB_STATE")),
  }),
});
