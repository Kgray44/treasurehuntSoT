"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { storageKey } from "@/crossdeck/client";
import { createHttpSyncTransport, type SurfaceSyncTransport, SyncTransportError } from "@/crossdeck/transport";
import {
  modes,
  objectKey,
  type ObjectRef,
  type Continuity,
  type Presentation,
  type SyncSnapshot,
  type SyncCommand,
  type TransferMode,
} from "@/crossdeck/sync-contracts";
import type { SurfaceDto } from "@/crossdeck/service";
import { useCrossdeckContinuity } from "./CrossdeckContinuity";
import styles from "./CrossdeckDevices.module.css";

const modeNames: Record<TransferMode, string> = {
  MOVE_FOCUS: "Continue there",
  MOVE_CUSTODY: "Control there",
  MIRROR: "Mirror view",
  OPEN_COMPANION: "Open companion",
  PIN_TO_SURFACE: "Keep on that device",
  SEND_VIEW: "Send read-only view",
};
type HandoffProps = {
  voyageId: string;
  csrfToken: string;
  object: ObjectRef | null;
  context: Continuity;
  captureContext?: () => Continuity;
  resume: (object: ObjectRef, context: Continuity) => void | Promise<void>;
};
export function CrossdeckHandoff(props: HandoffProps) {
  return <CrossdeckHandoffSession key={`${props.voyageId}:${props.csrfToken}`} {...props} />;
}
function CrossdeckHandoffSession({ voyageId, csrfToken, object, context, captureContext, resume }: HandoffProps) {
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);
  const [surfaces, setSurfaces] = useState<SurfaceDto[]>([]);
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<TransferMode>("MOVE_FOCUS");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryPayload, setRetryPayload] = useState<SyncCommand["payload"] | null>(null);
  const transport = useRef<SurfaceSyncTransport | null>(null);
  const commandController = useRef<AbortController | null>(null);
  const current = useRef<SyncSnapshot | null>(null);
  const pending = useRef<SyncCommand | null>(null);
  const lock = useRef(false);
  const resumed = useRef(new Set<string>());
  const lastApplied = useRef(new Map<string, number>());
  const bridge = useCrossdeckContinuity();
  const resumeRef = useRef(resume);
  const synchronize = useRef<() => void>(() => {});
  useEffect(() => {
    resumeRef.current = resume;
  }, [resume]);
  useEffect(() => {
    const id = sessionStorage.getItem(storageKey(voyageId));
    if (!id) return;
    const sync = createHttpSyncTransport(voyageId, id, csrfToken);
    transport.current = sync;
    const controller = new AbortController();
    commandController.current = controller;
    const applied = resumed.current;
    const versions = lastApplied.current;
    let stopped = false;
    let hadFailure = false;
    const unsubscribe = sync.subscribe(
      (next) => {
        if (stopped || (current.current && next.revision < current.current.revision)) return;
        const unchanged =
          !hadFailure &&
          current.current &&
          JSON.stringify({ ...current.current, observedAt: "" }) === JSON.stringify({ ...next, observedAt: "" });
        const restored = hadFailure;
        current.current = next;
        hadFailure = false;
        if (!unchanged) setSnapshot(next);
        setOnline(true);
        if (restored) setMessage("Connection restored. Check your current view status above.");
      },
      (error) => {
        if (stopped) return;
        hadFailure = true;
        setOnline(false);
        setMessage(
          error instanceof SyncTransportError && [401, 403].includes(error.status)
            ? "Device access ended. Reconnect from Devices."
            : "Connection interrupted. Your item stays recoverable. Reconnect to check its receipt.",
        );
        // Clear private presentation and offers on every failed authority/network refresh.
        setSnapshot(null);
        if (error instanceof SyncTransportError && [401, 403].includes(error.status)) {
          controller.abort();
          current.current = null;
          pending.current = null;
          transport.current = null;
          lock.current = false;
          setBusy(false);
          setRetryPayload(null);
          setSurfaces([]);
        }
      },
    );
    const devices = async () => {
      try {
        const r = await fetch(`/api/crossdeck?voyage=${encodeURIComponent(voyageId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) throw new Error("Devices unavailable");
        const data = await r.json();
        if (!stopped) setSurfaces(data.surfaces);
      } catch {
        if (!stopped) setSurfaces([]);
      }
    };
    void devices();
    const timer = setInterval(() => void devices(), 10000);
    return () => {
      stopped = true;
      controller.abort();
      unsubscribe();
      clearInterval(timer);
      transport.current = null;
      commandController.current = null;
      current.current = null;
      pending.current = null;
      lock.current = false;
      applied.clear();
      versions.clear();
    };
  }, [voyageId, csrfToken]);

  const command = useCallback(
    async (payload: SyncCommand["payload"], retry = false) => {
      if (lock.current || !transport.current || !current.current) return;
      lock.current = true;
      setBusy(true);
      setMessage("Passing it over...");
      const input =
        retry && pending.current
          ? pending.current
          : {
              messageId: crypto.randomUUID(),
              surfaceId: current.current.surfaceId,
              voyageId,
              sequence: current.current.nextSequence,
              payloadSchemaVersion: 1 as const,
              payload,
            };
      pending.current = input;
      setRetryPayload(payload);
      const sessionTransport = transport.current;
      const signal = commandController.current?.signal;
      const stillCurrent = () => !signal?.aborted && transport.current === sessionTransport;
      try {
        const next = await sessionTransport.send(input, signal);
        if (!stillCurrent()) return;
        pending.current = null;
        setRetryPayload(null);
        if (current.current && next.revision < current.current.revision) return current.current;
        current.current = next;
        setSnapshot(next);
        setOnline(true);
        setMessage(
          payload.action === "send"
            ? "View requested. Its current transfer status appears above."
            : "Your devices are up to date.",
        );
        return next;
      } catch (error) {
        if (!stillCurrent()) return;
        if (error instanceof SyncTransportError && error.status < 500) {
          pending.current = null;
          setRetryPayload(null);
        }
        setMessage(error instanceof Error ? error.message : "Check the transfer before trying again.");
      } finally {
        if (stillCurrent()) {
          lock.current = false;
          setBusy(false);
        }
      }
    },
    [voyageId],
  );

  // Apply destination view first. A rendered frame, rather than an animation timer, precedes acknowledgment.
  useEffect(() => {
    if (!snapshot || !online || busy) return;
    let cancelled = false;
    const open = async (object: ObjectRef, context: Continuity) => {
      await resumeRef.current(object, context);
      if (object.family === "MAP" && bridge) {
        const started = Date.now();
        while (!bridge.current && !cancelled && Date.now() - started < 8000)
          await new Promise((r) => setTimeout(r, 50));
        if (!bridge.current) throw new Error("Chart not ready");
        await bridge.current.resume(context);
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    };
    const apply = async () => {
      for (const h of snapshot.handoffs) {
        if (h.targetId !== snapshot.surfaceId || h.state !== "COMMITTED" || resumed.current.has(h.id)) continue;
        resumed.current.add(h.id);
        try {
          await open(h.object, h.context);
          if (cancelled) {
            resumed.current.delete(h.id);
            return;
          }
          const next = await command({ action: "acknowledge", handoffId: h.id });
          if (!next) resumed.current.delete(h.id);
          else {
            const p = next.presentations.find((p) => objectKey(p.object) === objectKey(h.object));
            if (p) lastApplied.current.set(objectKey(p.object), p.revision);
          }
        } catch {
          resumed.current.delete(h.id);
          setMessage("This view could not open. The transfer remains recoverable.");
        }
      }
      for (const p of snapshot.presentations) {
        if (cancelled) return;
        const previous = lastApplied.current.get(objectKey(p.object));
        if ((p.custody === snapshot.surfaceId && previous !== undefined) || previous === p.revision) continue;
        try {
          await open(p.object, p.context);
          if (!cancelled) lastApplied.current.set(objectKey(p.object), p.revision);
        } catch {
          setMessage("This view could not open. Refresh the Voyage to recover it.");
        }
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [snapshot, online, busy, bridge, command]);

  const destinations = surfaces.filter((s) => s.surfaceId !== snapshot?.surfaceId && s.presence === "ACTIVE");
  const preferred = object ? snapshot?.focus[object.family] : undefined;
  const selectedTarget = target || (destinations.some((s) => s.surfaceId === preferred) ? preferred : "") || "";
  const confirmationKey = object ? `${objectKey(object)}:${object.version}:${selectedTarget}` : "";
  const confirmed = Boolean(confirmationKey && confirmation === confirmationKey);
  const presentation = object && snapshot?.presentations.find((p) => objectKey(p.object) === objectKey(object));
  const incoming = snapshot?.handoffs.filter((h) => h.targetId === snapshot.surfaceId && h.state === "OFFERED") ?? [];
  const outgoing = snapshot?.handoffs.filter((h) => h.sourceId === snapshot.surfaceId) ?? [];
  const captured = (): Continuity => ({
    ...context,
    ...captureContext?.(),
    ...(object?.family === "MAP" ? (bridge?.current?.capture() ?? {}) : {}),
  });
  const send = () => {
    if (object && selectedTarget)
      void command({
        action: "send",
        targetId: selectedTarget,
        object,
        context: captured(),
        mode,
        privateConfirmed: confirmed,
      });
  };
  const syncView = (p: Presentation) =>
    void command({ action: "update", object: p.object, context: captured(), expectedRevision: p.revision });
  useEffect(() => {
    synchronize.current = () => {
      const latest = object && current.current?.presentations.find((p) => objectKey(p.object) === objectKey(object));
      const captured = {
        ...context,
        ...captureContext?.(),
        ...(object?.family === "MAP" ? (bridge?.current?.capture() ?? {}) : {}),
      };
      if (
        latest &&
        latest.custody === current.current?.surfaceId &&
        Object.keys(latest.views).length > 1 &&
        !lock.current &&
        !pending.current &&
        JSON.stringify(latest.context) !== JSON.stringify(captured)
      )
        void command({ action: "update", object: latest.object, context: captured, expectedRevision: latest.revision });
    };
  }, [object, context, captureContext, bridge, command]);
  useEffect(() => {
    if (!bridge) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => synchronize.current(), 250);
    };
    bridge.changes.addEventListener("change", changed);
    return () => {
      bridge.changes.removeEventListener("change", changed);
      if (timer) clearTimeout(timer);
    };
  }, [bridge]);
  return (
    <section className={styles.handoff} aria-label="Send to your devices">
      <details>
        <summary>Send to...</summary>
        {!snapshot && (
          <p>
            <Link href={`/account/devices?voyage=${encodeURIComponent(voyageId)}`}>Connect this device</Link> to send
            and receive your Voyage views.
          </p>
        )}
        {object && snapshot && (
          <>
            <label>
              Destination
              <select
                aria-label="Send destination"
                value={selectedTarget}
                onChange={(e) => setTarget(e.target.value)}
                disabled={busy || !online}
              >
                <option value="">Choose your other device</option>
                {destinations.map((s) => (
                  <option key={s.surfaceId} value={s.surfaceId}>
                    {s.label}
                    {s.role === "SHARED_CREW_DISPLAY" ? " (crew display)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              How to open
              <select
                aria-label="Transfer mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as TransferMode)}
                disabled={busy}
              >
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {modeNames[m]}
                  </option>
                ))}
              </select>
            </label>
            {object.family === "NOTE" && (
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmation(e.target.checked ? confirmationKey : "")}
                />{" "}
                Send this private note to my selected device
              </label>
            )}
            <button
              type="button"
              disabled={busy || !online || !selectedTarget || (object.family === "NOTE" && !confirmed)}
              onClick={send}
            >
              Send view
            </button>
            {presentation && presentation.custody === snapshot.surfaceId && (
              <button type="button" disabled={busy || !online} onClick={() => syncView(presentation)}>
                Update companion views
              </button>
            )}
            <button
              type="button"
              disabled={busy || !online || !selectedTarget}
              onClick={() => void command({ action: "focus", family: object.family, targetId: selectedTarget })}
            >
              Prefer this device for {object.family.toLowerCase()} views
            </button>
          </>
        )}
        {outgoing.slice(-3).map((h) => (
          <p key={h.id}>
            {h.state === "ACKNOWLEDGED"
              ? `${h.title} is open on your other device.`
              : h.state === "COMMITTED"
                ? `${h.title} arrived. Waiting for that device to open it.`
                : h.state === "OFFERED"
                  ? `${h.title} is ready to receive. It stays here until opened there.`
                  : "That transfer ended. The item stayed recoverable."}
            {h.state === "OFFERED" && (
              <button
                type="button"
                disabled={busy || !online}
                onClick={() => void command({ action: "cancel", handoffId: h.id })}
              >
                Cancel send
              </button>
            )}
            {["COMMITTED", "ACKNOWLEDGED"].includes(h.state) &&
              !snapshot?.presentations.some((p) => objectKey(p.object) === objectKey(h.object)) && (
                <button
                  type="button"
                  disabled={busy || !online}
                  onClick={() => void command({ action: "recover", object: h.object })}
                >
                  Recover {h.title} here
                </button>
              )}
          </p>
        ))}
        {snapshot?.presentations.map((p) => (
          <div key={objectKey(p.object)}>
            <p>
              {p.title} — {p.custody === snapshot.surfaceId ? "Controlled here" : "Read-only companion view"}
            </p>
            {p.custody !== snapshot.surfaceId && (
              <button
                type="button"
                disabled={busy || !online}
                onClick={() => void command({ action: "recover", object: p.object })}
              >
                Recover view here
              </button>
            )}
            <button
              type="button"
              disabled={busy || !online}
              onClick={() => void command({ action: "close", object: p.object })}
            >
              Close companion view
            </button>
          </div>
        ))}
      </details>
      {incoming.map((h) => (
        <div key={h.id}>
          <p>{h.title} is ready from your other device.</p>
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => void command({ action: "accept", handoffId: h.id })}
          >
            Receive {h.title}
          </button>
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => void command({ action: "cancel", handoffId: h.id })}
          >
            Decline
          </button>
        </div>
      ))}
      {retryPayload && !busy && (
        <button type="button" disabled={!online} onClick={() => void command(retryPayload, true)}>
          Check and retry transfer
        </button>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
