"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { qualifyNearbyPairLease, type NearbyPairLease } from "@/landfall/nearby-pairing-lease";
import {
  landfallNativeHost,
  subscribeLandfallNativeLifecycle,
  subscribeNativeLandfallPower,
} from "@/landfall/native-bridge";
import { NativeLandfallUwbProvider, nativeUwbConfigurationSchema } from "@/landfall/native-uwb";
import {
  NativeLandfallNearbyInteractionProvider,
  nativeNearbyInteractionConfigurationSchema,
} from "@/landfall/native-nearby-interaction";

const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const base = {
  available: z.literal(true),
  expiresAt: z.number().int().nonnegative(),
  remainingMs: z.number().int().min(1).max(45000),
  peerVerified: z.literal(false),
  canComplete: z.literal(false),
};
const ready = z.discriminatedUnion("platform", [
  z.strictObject({
    ...base,
    state: z.literal("READY"),
    platform: z.literal("ANDROID"),
    configuration: nativeUwbConfigurationSchema,
    handle: secret.optional(),
  }),
  z.strictObject({
    ...base,
    state: z.literal("READY"),
    platform: z.literal("IOS"),
    configuration: nativeNearbyInteractionConfigurationSchema,
    handle: secret.optional(),
  }),
]);
const waiting = z.strictObject({
  ...base,
  state: z.literal("WAITING"),
  code: secret.optional(),
  handle: secret.optional(),
});
type Device =
  | { platform: "ANDROID"; provider: NativeLandfallUwbProvider }
  | { platform: "IOS"; provider: NativeLandfallNearbyInteractionProvider };
type Active = {
  device: Device;
  handle: string | null;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  attempt: number;
  lease?: NearbyPairLease;
};
type Exchange = { body: unknown; requestedAt: number };

/** Optional peer hints never enter the progression or location evidence writer. */
export function LandfallNearbyPanel(props: { bootstrap: PlayerLandfallBootstrap; csrfToken: string }) {
  const value = props.bootstrap;
  const key = JSON.stringify([
    value.sessionId,
    value.publishedVersionId,
    value.currentSequence,
    value.activeWaypointId,
    value.paused,
    value.replayOnly,
    value.runtimeDefinition.worldspaces[0].id,
    value.runtimeDefinition.worldspaces[0].kind,
  ]);
  return <NearbyControls key={key} {...props} />;
}
const subscribeHost = (notify: () => void) => {
  window.addEventListener("landfall-native-event", notify);
  return () => window.removeEventListener("landfall-native-event", notify);
};
const hostSnapshot = () => Boolean(landfallNativeHost());
const serverSnapshot = () => false;
function NearbyControls({ bootstrap, csrfToken }: { bootstrap: PlayerLandfallBootstrap; csrfToken: string }) {
  const native = useSyncExternalStore(subscribeHost, hostSnapshot, serverSnapshot);
  const [busy, setBusy] = useState(false),
    [role, setRole] = useState<"IDLE" | "OWNER" | "RUNNING">("IDLE"),
    [code, setCode] = useState(""),
    [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("Nearby device hints are off.");
  const generation = useRef(0),
    active = useRef<Active | null>(null);
  const stopTail = useRef<Promise<void>>(Promise.resolve());
  const pendingHttp = useRef<AbortController | null>(null);
  const endpoint = `/api/player/playthroughs/${encodeURIComponent(bootstrap.sessionId)}/landfall/nearby`;
  const call = useCallback(
    async (body: unknown, signal?: AbortSignal) => {
      const abort = new AbortController(),
        onAbort = () => abort.abort();
      if (signal?.aborted) abort.abort();
      else signal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => abort.abort(), 8000);
      const requestedAt = performance.now();
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify(body),
          signal: abort.signal,
        });
        if (!response.ok) throw new Error(response.status === 503 ? "NOT_CONFIGURED" : "PAIR_CHANGED");
        return { body: (await response.json()) as unknown, requestedAt };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
    [endpoint, csrfToken],
  );
  const stop = useCallback(
    async (update = true) => {
      generation.current++;
      const current = active.current;
      active.current = null;
      pendingHttp.current?.abort();
      pendingHttp.current = null;
      if (current) {
        current.abort.abort();
        clearTimeout(current.timer);
      }
      if (update) {
        setBusy(false);
        setRole("IDLE");
        setCode("");
        setJoinCode("");
        setMessage("Nearby device hints are stopped.");
      }
      const cleanup = stopTail.current.then(async () => {
        if (current) {
          await current.device.provider.stop();
          if (current.handle) await call({ operation: "STOP", handle: current.handle }).catch(() => undefined);
        }
      });
      stopTail.current = cleanup.catch(() => undefined);
      await cleanup;
    },
    [call],
  );
  useEffect(() => {
    const pause = () => {
      setMessage("Nearby hints paused. Prepare both devices again when you return.");
      setRole("IDLE");
      setCode("");
      setBusy(false);
      void stop(false);
    };
    const lifecycle = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") pause();
    });
    const power = subscribeNativeLandfallPower((state) => {
      if (state.lowPower || state.thermalPressure || state.state !== "READY") pause();
    });
    const visibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    const clear = () => pause();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("landfall-offline-cleared", clear);
    return () => {
      lifecycle();
      power();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("landfall-offline-cleared", clear);
      void stop(false);
    };
  }, [stop]);
  const arm = (current: Active, response: { expiresAt: number; remainingMs: number }, requestedAt: number) => {
    const lease = qualifyNearbyPairLease(response, requestedAt, performance.now(), Date.now(), current.lease);
    current.lease = lease;
    clearTimeout(current.timer);
    current.timer = setTimeout(() => {
      if (active.current !== current) return;
      setMessage("Nearby pairing expired. Prepare both devices again.");
      setRole("IDLE");
      setCode("");
      setBusy(false);
      void stop(false);
    }, lease.remainingMs);
    return lease.nativeExpiresAt;
  };
  const start = async (current: Active, exchange: Exchange) => {
    const response = ready.parse(exchange.body);
    if (response.expiresAt !== response.configuration.expiresAt) throw new Error("PAIR_CHANGED");
    if (response.platform !== current.device.platform || current.attempt !== generation.current)
      throw new Error("PAIR_CHANGED");
    const nativeExpiresAt = arm(current, response, exchange.requestedAt);
    const receive = (projection: { rangeAvailable: boolean; state: string }) => {
      if (current.attempt !== generation.current) return;
      setMessage(
        projection.rangeAvailable
          ? "A nearby range was reported. Precision and device identity are unverified. This cannot confirm arrival."
          : projection.state === "INITIALIZING"
            ? "Waiting for a native nearby report. Keep both devices in the foreground."
            : "Nearby reports are unavailable. The chart and readable guidance remain available.",
      );
    };
    if (current.device.platform === "ANDROID" && response.platform === "ANDROID")
      await current.device.provider.start({ ...response.configuration, expiresAt: nativeExpiresAt }, receive);
    else if (current.device.platform === "IOS" && response.platform === "IOS")
      await current.device.provider.start({ ...response.configuration, expiresAt: nativeExpiresAt }, receive);
    else throw new Error("PAIR_CHANGED");
    if (!["INITIALIZING", "UNTRUSTED"].includes(current.device.provider.snapshot().state))
      throw new Error("PAIR_CHANGED");
    if (current.attempt === generation.current) {
      setRole("RUNNING");
      setCode("");
      setJoinCode("");
    }
  };
  const begin = async (join: boolean) => {
    const parsedCode = secret.safeParse(joinCode);
    if (join && !parsedCode.success) {
      setMessage("Enter the full pairing code from your other device.");
      return;
    }
    const submittedCode = join && parsedCode.success ? parsedCode.data : null;
    const stopping = stop(false),
      attempt = generation.current;
    setBusy(true);
    setCode("");
    setRole("IDLE");
    await stopping;
    if (attempt !== generation.current) return;
    const abort = new AbortController();
    pendingHttp.current = abort;
    let current: Active | null = null;
    try {
      z.object({
        available: z.literal(true),
        state: z.literal("CONFIGURED"),
        peerVerified: z.literal(false),
        canComplete: z.literal(false),
      }).parse((await call({ operation: "STATUS" }, abort.signal)).body);
      if (attempt !== generation.current) return;
      const host = landfallNativeHost(),
        world = bootstrap.runtimeDefinition.worldspaces[0];
      if (!host || world.kind !== "PHYSICAL" || bootstrap.paused || bootstrap.replayOnly)
        throw new Error("PAIR_CHANGED");
      const device: Device =
        host.platform === "ANDROID"
          ? { platform: "ANDROID", provider: new NativeLandfallUwbProvider(world) }
          : { platform: "IOS", provider: new NativeLandfallNearbyInteractionProvider(world) };
      current = { device, handle: null, abort, attempt };
      active.current = current;
      let offer: unknown;
      if (device.platform === "ANDROID") {
        const prepared = await device.provider.prepare(join ? "CONTROLEE" : "CONTROLLER", true);
        if (!prepared) throw new Error("DEVICE_UNAVAILABLE");
        offer = join
          ? { platform: "ANDROID", address: prepared.address }
          : { platform: "ANDROID", address: prepared.address, channel: prepared.channel, preamble: prepared.preamble };
      } else {
        const prepared = await device.provider.prepare(true);
        if (!prepared) throw new Error("DEVICE_UNAVAILABLE");
        offer = { platform: "IOS", discoveryToken: prepared.discoveryToken };
      }
      if (attempt !== generation.current) return;
      const response = await call(
        join ? { operation: "JOIN", code: submittedCode, offer } : { operation: "CREATE", offer },
        current.abort.signal,
      );
      if (attempt !== generation.current) return;
      current.handle = z.object({ handle: secret }).parse(response.body).handle;
      if (join) await start(current, response);
      else {
        const result = waiting.parse(response.body);
        arm(current, result, response.requestedAt);
        setCode(secret.parse(result.code));
        setRole("OWNER");
        setMessage(
          "On your other device, sign in as the same Player and open this objective. Enter this code, then choose Start hints here. The code expires within 45 seconds.",
        );
      }
    } catch (error) {
      if (attempt !== generation.current) return;
      const cleanup = stop(false),
        stoppedAttempt = generation.current;
      await cleanup;
      if (stoppedAttempt !== generation.current) return;
      setRole("IDLE");
      setCode("");
      setBusy(false);
      setMessage(
        error instanceof Error && error.message === "NOT_CONFIGURED"
          ? "Nearby companion pairing is unavailable on this deployment. The chart and readable guidance remain available."
          : error instanceof Error && error.message === "DEVICE_UNAVAILABLE"
            ? "Nearby ranging is unsupported, disabled, or awaiting permission. Review the system prompt and try again, or continue with the chart."
            : "The pairing expired or access changed. Prepare both devices again; the chart remains available.",
      );
    } finally {
      if (pendingHttp.current === abort) pendingHttp.current = null;
      if (attempt === generation.current) setBusy(false);
    }
  };
  const finish = async () => {
    const current = active.current;
    if (!current?.handle || role !== "OWNER") return;
    setBusy(true);
    try {
      const response = await call({ operation: "READ", handle: current.handle }, current.abort.signal);
      if (current.attempt !== generation.current) return;
      const pending = waiting.safeParse(response.body);
      if (pending.success) {
        arm(current, pending.data, response.requestedAt);
        setMessage("Your other device has not joined yet. Keep this screen open and enter the code there.");
        return;
      }
      await start(current, response);
    } catch {
      if (current.attempt === generation.current) {
        const cleanup = stop(false),
          stoppedAttempt = generation.current;
        await cleanup;
        if (stoppedAttempt === generation.current) {
          setRole("IDLE");
          setCode("");
          setBusy(false);
          setMessage("The pairing expired or access changed. Prepare both devices again.");
        }
      }
    } finally {
      if (current.attempt === generation.current) setBusy(false);
    }
  };
  if (
    !native ||
    bootstrap.paused ||
    bootstrap.replayOnly ||
    bootstrap.runtimeDefinition.worldspaces[0].kind !== "PHYSICAL"
  )
    return null;
  return (
    <details className="landfall-nearby-panel">
      <summary>Optional nearby device hints</summary>
      <p>
        Pair your other device for brief foreground hints. Both devices must use the same platform and Player account.
        Pairing details pass through this first-party service and expire within 45 seconds. Device identity and distance
        accuracy remain unverified; these hints cannot confirm arrival.
      </p>
      <p role="status" aria-live="polite" aria-label="Nearby device hint status">
        {message}
      </p>
      <button type="button" disabled={busy || role !== "IDLE"} onClick={() => void begin(false)}>
        Create pairing code
      </button>
      {code && (
        <label>
          Pairing code
          <output aria-label="Pairing code" style={{ display: "block", overflowWrap: "anywhere" }}>
            {code}
          </output>
        </label>
      )}
      <label>
        Code from your other device
        <input
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={43}
          value={joinCode}
          disabled={busy || role !== "IDLE"}
          onChange={(event) => setJoinCode(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || role !== "IDLE" || !secret.safeParse(joinCode).success}
        onClick={() => void begin(true)}
      >
        Join my other device
      </button>
      <button type="button" disabled={busy || role !== "OWNER"} onClick={() => void finish()}>
        Start hints
      </button>
      <button type="button" disabled={!busy && role === "IDLE"} onClick={() => void stop()}>
        Stop nearby hints
      </button>
    </details>
  );
}
