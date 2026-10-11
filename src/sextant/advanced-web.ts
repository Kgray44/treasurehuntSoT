import { webMediaCapabilities } from "./media-capability";
import { NearbySessions, WebBleCapability, WebNfcCapability, type WebBluetooth, type NfcReader } from "./nearby";
import { WebMagneticFieldProvider, type MagneticSensor } from "./field-provider";

export type AdvancedWebTarget = {
  isSecureContext?: boolean;
  navigator?: {
    bluetooth?: WebBluetooth;
    mediaDevices?: { getUserMedia?: unknown; getSupportedConstraints?: () => Record<string, boolean> };
  };
  NDEFReader?: new () => NfcReader;
  Magnetometer?: new (options: { frequency: number }) => MagneticSensor;
};
/** One advanced capability runtime per shared surface; discovery/acquisition remain separate. */
export class AdvancedWebSextant {
  private paused = false;
  readonly media;
  readonly nearby;
  readonly ble;
  readonly nfc;
  readonly magnetic;
  constructor(target: AdvancedWebTarget | null, now: () => number, emulationIdentity?: string) {
    this.media = webMediaCapabilities(target, now);
    this.nearby = new NearbySessions(now);
    this.ble = new WebBleCapability(
      target?.navigator?.bluetooth ?? null,
      target?.isSecureContext === true,
      this.nearby,
    );
    this.nfc = new WebNfcCapability(
      target?.NDEFReader ? () => new target.NDEFReader!() : null,
      target?.isSecureContext === true,
      this.nearby,
      emulationIdentity,
    );
    this.magnetic = new WebMagneticFieldProvider(
      target?.Magnetometer ?? null,
      target?.isSecureContext === true,
      now,
      emulationIdentity,
    );
  }
  setForeground(value: boolean) {
    this.media.setForeground(value && !this.paused);
    this.nearby.setForeground(value && !this.paused);
    if (!value || this.paused) void this.magnetic.stop();
  }
  setPaused(value: boolean, foreground: boolean) {
    this.paused = value;
    this.setForeground(foreground);
  }
  dispose() {
    this.media.dispose();
    this.nearby.dispose();
    void this.magnetic.stop();
  }
}
