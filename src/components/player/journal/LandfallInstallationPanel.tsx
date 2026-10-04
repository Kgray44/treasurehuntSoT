"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { landfallId } from "@/landfall/schema";
import { installationScopeSchema } from "@/landfall/installation-token";
import { NativeLandfallInstallationProvider, type InstallationResult } from "@/landfall/native-installation";
import {
  landfallNativeHost,
  subscribeLandfallNativeLifecycle,
  subscribeNativeLandfallPower,
} from "@/landfall/native-bridge";

const trusted = z.strictObject({
  state: z.literal("CONFIGURED"),
  keyId: landfallId,
  publicKey: z.strictObject({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }),
  canComplete: z.literal(false),
  scope: installationScopeSchema.omit({ id: true, medium: true }),
  installations: z
    .array(
      z.strictObject({
        id: landfallId,
        medium: z.enum(["QR", "NFC"]),
        label: z.string().min(1).max(120),
        accessibilityAlternative: z.string().min(1).max(240),
      }),
    )
    .max(8),
});
const subscribe = (notify: () => void) => {
  window.addEventListener("landfall-native-event", notify);
  return () => window.removeEventListener("landfall-native-event", notify);
};
const snapshot = () => Boolean(landfallNativeHost());
type Props = { bootstrap: PlayerLandfallBootstrap; csrfToken: string };
export function LandfallInstallationPanel(props: Props) {
  const value = props.bootstrap;
  return (
    <InstallationControls
      key={JSON.stringify([
        value.sessionId,
        value.publishedVersionId,
        value.currentSequence,
        value.activeWaypointId,
        value.paused,
        value.replayOnly,
        value.runtimeDefinition.waypoints,
      ])}
      {...props}
    />
  );
}
function InstallationControls({ bootstrap, csrfToken }: Props) {
  const native = useSyncExternalStore(subscribe, snapshot, () => false);
  const world = bootstrap.runtimeDefinition.worldspaces[0],
    waypoint = bootstrap.runtimeDefinition.waypoints.find((item) => item.id === bootstrap.activeWaypointId);
  const available =
    world?.kind === "PHYSICAL" && waypoint?.installations?.length && !bootstrap.paused && !bootstrap.replayOnly;
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState("");
  const [medium, setMedium] = useState<"QR" | "NFC">("QR"),
    [message, setMessage] = useState("Scanning is off. Optional tags never prove presence or record arrival.");
  const provider = useRef<NativeLandfallInstallationProvider | null>(null),
    generation = useRef(0),
    abort = useRef<AbortController | null>(null);
  const stop = useCallback((update = true) => {
    generation.current++;
    abort.current?.abort();
    abort.current = null;
    const current = provider.current;
    provider.current = null;
    void current?.clear();
    if (update) {
      setReady(false);
      setBusy(false);
      setToken("");
      setMessage("Scan stopped and token cleared. Start again deliberately when ready.");
    }
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    const lifecycle = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") stop();
    });
    const power = subscribeNativeLandfallPower((state) => {
      if (state.lowPower || state.thermalPressure || state.critical) stop();
    });
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("landfall-offline-cleared", hiddenReset);
    function hiddenReset() {
      stop();
    }
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("landfall-offline-cleared", hiddenReset);
      lifecycle();
      power();
      stop(false);
    };
  }, [stop]);
  const check = async () => {
    if (!available || busy) return;
    stop(false);
    const attempt = ++generation.current,
      controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setBusy(true);
    setToken("");
    setReady(false);
    try {
      const response = await fetch(
        `/api/player/playthroughs/${encodeURIComponent(bootstrap.sessionId)}/landfall/interaction`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ operation: "STATUS" }),
          signal: controller.signal,
        },
      );
      const value = await response.json();
      if (attempt !== generation.current) return;
      if (!response.ok) throw new Error();
      if (value.state === "NOT_CONFIGURED") {
        setMessage("Signed installations are unavailable on this deployment. Use the configured readable fallback.");
        return;
      }
      const status = trusted.parse(value);
      if (
        status.scope.publishedVersionId !== bootstrap.publishedVersionId ||
        status.scope.worldspaceId !== world.id ||
        status.scope.waypointId !== waypoint!.id ||
        JSON.stringify(status.installations) !== JSON.stringify(waypoint!.installations)
      )
        throw new Error();
      const key = await crypto.subtle.importKey("jwk", status.publicKey, { name: "Ed25519" }, false, ["verify"]);
      if (attempt !== generation.current) return;
      provider.current = new NativeLandfallInstallationProvider({
        scope: status.scope,
        installations: status.installations,
        keys: new Map([[status.keyId, key]]),
      });
      setReady(true);
      setMedium(status.installations[0]?.medium ?? "QR");
      setMessage(
        "Installation identity can now be checked on this device. Camera or NFC starts only when you choose Scan. Readable confirmation remains separate.",
      );
    } catch {
      if (attempt === generation.current)
        setMessage("Installation verification is unavailable. Use the configured Player or Captain fallback.");
    } finally {
      clearTimeout(timeout);
      if (attempt === generation.current) {
        abort.current = null;
        setBusy(false);
      }
    }
  };
  const report = (result: InstallationResult) => {
    setBusy(false);
    setToken("");
    setMessage(
      result.state === "VERIFIED"
        ? "Signed installation identity verified locally. Copies do not prove presence. Check the objective, then use its separate configured confirmation below."
        : result.state === "DUPLICATE"
          ? "This installation was already checked. No arrival was recorded."
          : "Scan was stopped, expired or invalid. No arrival was recorded; use the readable fallback.",
    );
  };
  const scan = async (selected: "QR" | "NFC") => {
    if (busy || !provider.current) return;
    const attempt = generation.current;
    setBusy(true);
    setToken("");
    const state = await provider.current.scan(selected, (result) => {
      if (attempt === generation.current) report(result);
    });
    if (attempt !== generation.current) return;
    if (state === "COMPLETED") return;
    if (state !== "GRANTED") {
      setBusy(false);
      setMessage(
        state === "PROMPTABLE"
          ? "Review the device permission, then choose Scan again. Nothing starts automatically."
          : "Scanner permission or hardware is unavailable. Use the signed text alternative or readable confirmation.",
      );
    } else setMessage("Scanning for up to 30 seconds. Cancel or leave this screen to stop.");
  };
  const verifyText = async () => {
    if (busy || !provider.current) return;
    const attempt = generation.current;
    setBusy(true);
    const result = await provider.current.verify(token, medium);
    if (attempt === generation.current) report(result);
  };
  if (!available) return null;
  return (
    <details
      className="landfall-installation-panel"
      onToggle={(event) => {
        if (!event.currentTarget.open) stop();
      }}
    >
      <summary>Optional signed QR or NFC installation</summary>
      <p>
        Scanning never requests location, follows a link or completes arrival. A copied tag can be used away from the
        site. Use the separate Player, Captain or alternate waypoint fallback when needed.
      </p>
      {waypoint!.installations!.map((item) => (
        <p key={item.id}>
          {item.label}: {item.accessibilityAlternative}
        </p>
      ))}
      <button type="button" style={{ minHeight: 48 }} disabled={busy} onClick={() => void check()}>
        Check installation availability
      </button>
      {ready && (
        <div>
          {(["QR", "NFC"] as const)
            .filter((item) => waypoint!.installations!.some((installation) => installation.medium === item))
            .map((item) => (
              <button
                key={item}
                type="button"
                style={{ minHeight: 48 }}
                disabled={busy || !native}
                onClick={() => void scan(item)}
              >
                Scan optional {item}
              </button>
            ))}
          <label>
            Signed token format
            <select value={medium} disabled={busy} onChange={(event) => setMedium(event.target.value as "QR" | "NFC")}>
              <option value="QR">QR</option>
              <option value="NFC">NFC</option>
            </select>
          </label>
          <label>
            Signed text alternative
            <textarea
              value={token}
              maxLength={2048}
              disabled={busy}
              onChange={(event) => setToken(event.target.value)}
              rows={3}
            />
          </label>
          <button type="button" style={{ minHeight: 48 }} disabled={busy || !token} onClick={() => void verifyText()}>
            Check signed text
          </button>
        </div>
      )}
      <button type="button" style={{ minHeight: 48 }} onClick={() => stop()}>
        Stop scan and clear token
      </button>
      <p role="status" aria-label="Signed installation status">
        {message}
      </p>
    </details>
  );
}
