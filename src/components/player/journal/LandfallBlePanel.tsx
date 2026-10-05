"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import {
  landfallNativeHost,
  subscribeLandfallNativeLifecycle,
  subscribeNativeLandfallPower,
} from "@/landfall/native-bridge";
import { NativeLandfallBleProvider, type BleProjection } from "@/landfall/native-ble";

const subscribe = (notify: () => void) => {
  window.addEventListener("landfall-native-event", notify);
  return () => window.removeEventListener("landfall-native-event", notify);
};
const snapshot = () => Boolean(landfallNativeHost());
export function LandfallBlePanel({ bootstrap }: { bootstrap: PlayerLandfallBootstrap }) {
  const world = bootstrap.runtimeDefinition.worldspaces[0];
  if (world.kind !== "PHYSICAL" || bootstrap.paused || bootstrap.replayOnly || !bootstrap.activeWaypointId) return null;
  const key = JSON.stringify([
    bootstrap.sessionId,
    bootstrap.publishedVersionId,
    bootstrap.currentSequence,
    bootstrap.activeWaypointId,
    world.id,
  ]);
  return <BleControls key={key} bootstrap={bootstrap} />;
}
function BleControls({ bootstrap }: { bootstrap: PlayerLandfallBootstrap }) {
  const native = useSyncExternalStore(subscribe, snapshot, () => false);
  const [busy, setBusy] = useState(false),
    [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Bluetooth scanning is off.");
  const provider = useRef<NativeLandfallBleProvider | null>(null),
    generation = useRef(0);
  const stop = useCallback((update = true) => {
    generation.current++;
    const current = provider.current;
    provider.current = null;
    void current?.stop();
    if (update) {
      setBusy(false);
      setRunning(false);
      setMessage("Bluetooth scan stopped and observations cleared.");
    }
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    const reset = () => stop();
    const lifecycle = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") stop();
    });
    const power = subscribeNativeLandfallPower((state) => {
      if (state.lowPower || state.thermalPressure || state.critical) stop();
    });
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("landfall-offline-cleared", reset);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("landfall-offline-cleared", reset);
      lifecycle();
      power();
      stop(false);
    };
  }, [stop]);
  const start = async () => {
    if (!native || busy || running || document.hidden) return;
    stop(false);
    const attempt = ++generation.current;
    const current = new NativeLandfallBleProvider(bootstrap.runtimeDefinition.worldspaces[0]);
    provider.current = current;
    setBusy(true);
    setMessage("Checking optional Bluetooth availability…");
    let terminal = false;
    const state = await current.start(true, (value: BleProjection) => {
      if (attempt !== generation.current) return;
      if (["STOPPED", "EXPIRED", "UNAVAILABLE"].includes(value.state)) {
        terminal = true;
        setRunning(false);
        setBusy(false);
      }
      setMessage(
        value.state === "UNTRUSTED"
          ? `${value.unverifiedPeers} unverified device signals. ${value.band === "STRONG_SIGNAL" ? "Strong" : value.band === "WEAK_SIGNAL" ? "Weak" : "Uncertain"} signal; distance and identity are unknown. No arrival recorded.`
          : value.state === "STALE"
            ? "Signals expired. No current proximity hint or arrival."
            : `Bluetooth: ${value.state.toLowerCase()}.`,
      );
    });
    if (attempt !== generation.current) return;
    if (terminal) return;
    setBusy(false);
    const active = state === "GRANTED" || state === "INITIALIZING";
    setRunning(active);
    if (!active)
      setMessage(
        state === "PROMPTABLE"
          ? "Respond to the permission prompt, then start a new scan deliberately."
          : `Bluetooth: ${state.toLowerCase().replaceAll("_", " ")}. The readable chart and fallback remain available.`,
      );
  };
  return (
    <details
      className="landfall-ble-panel"
      onToggle={(event) => {
        if (!event.currentTarget.open) stop();
      }}
    >
      <summary>Optional Bluetooth signal hints</summary>
      <p>
        Older Android versions may require location permission for Bluetooth discovery. This scan never requests GPS
        readings.
      </p>
      <p>
        A 30-second foreground scan can show unverified signals. Signal strength varies with walls, interference and
        spoofing; it cannot identify a waypoint, measure distance or record a visit. No device names or addresses are
        shown, saved or uploaded.
      </p>
      {!native && (
        <p>Scanning requires the native companion. The readable chart and existing fallback remain available.</p>
      )}
      <div className="landfall-ble-actions">
        <button type="button" disabled={!native || busy || running} onClick={() => void start()}>
          Scan optional Bluetooth
        </button>
        <button type="button" disabled={!busy && !running} onClick={() => stop()}>
          Stop Bluetooth scan
        </button>
      </div>
      <p role="status" aria-label="Bluetooth scan status" aria-live="polite">
        {message}
      </p>
    </details>
  );
}
