"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createCrossdeckId, storageKey } from "@/crossdeck/client";
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
import { roleNames } from "@/crossdeck/experiences";

const modeNames: Record<TransferMode, string> = {
  MOVE_FOCUS: "Continue there",
  MOVE_CUSTODY: "Control there",
  MIRROR: "Mirror view",
  OPEN_COMPANION: "Open companion",
  PIN_TO_SURFACE: "Keep on that device",
  SEND_VIEW: "Send read-only view",
};
export type CrossdeckSyncConnection = "connecting" | "live" | "reconnecting" | "offline" | "revoked";
type HandoffProps = {
  voyageId: string;
  csrfToken: string;
  object: ObjectRef | null;
  context: Continuity;
  captureContext?: () => Continuity;
  /** A companion purpose follows only its own background views; accepted arrivals still open explicitly. */
  followingFamily?: ObjectRef["family"] | null;
  /** Projects this transport's verified state without opening another synchronization channel. */
  onConnectionChange?: (connection: CrossdeckSyncConnection) => void;
  resume: (
    object: ObjectRef,
    context: Continuity,
    policy?: { mode: TransferMode; readOnly: boolean },
  ) => void | Promise<void>;
};
export function CrossdeckHandoff(props: HandoffProps) {
  return <CrossdeckHandoffSession key={`${props.voyageId}:${props.csrfToken}`} {...props} />;
}
function CrossdeckHandoffSession({
  voyageId,
  csrfToken,
  object,
  context,
  captureContext,
  followingFamily,
  onConnectionChange,
  resume,
}: HandoffProps) {
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);
  const [surfaces, setSurfaces] = useState<SurfaceDto[]>([]);
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<TransferMode>("OPEN_COMPANION");
  const [ownId, setOwnId] = useState<string | null>(null);
  const picker = useRef<HTMLDialogElement>(null);
  const pickerTitle = useId();
  const sendTrigger = useRef<HTMLButtonElement>(null);
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
  const followingFamilyRef = useRef(followingFamily);
  const connectionRef = useRef(onConnectionChange);
  const synchronize = useRef<() => void>(() => {});
  useEffect(() => {
    resumeRef.current = resume;
  }, [resume]);
  useEffect(() => {
    followingFamilyRef.current = followingFamily;
  }, [followingFamily]);
  useEffect(() => {
    connectionRef.current = onConnectionChange;
  }, [onConnectionChange]);
  useEffect(() => {
    const changed = () => setOwnId(sessionStorage.getItem(storageKey(voyageId)));
    changed();
    window.addEventListener("crossdeck-surface-changed", changed);
    return () => window.removeEventListener("crossdeck-surface-changed", changed);
  }, [voyageId]);
  useEffect(() => {
    connectionRef.current?.("connecting");
    const id = ownId;
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
        const connectedNow = navigator.onLine !== false;
        setOnline(connectedNow);
        connectionRef.current?.(connectedNow ? "live" : "offline");
        if (restored) setMessage("Connection restored. Check your current view status above.");
      },
      (error) => {
        if (stopped) return;
        hadFailure = true;
        setOnline(false);
        connectionRef.current?.(
          error instanceof SyncTransportError && [401, 403].includes(error.status)
            ? "revoked"
            : navigator.onLine === false
              ? "offline"
              : "reconnecting",
        );
        setMessage(
          error instanceof SyncTransportError && [401, 403].includes(error.status)
            ? "This device’s access ended. Connect it again to continue."
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
  }, [voyageId, csrfToken, ownId]);

  const command = useCallback(
    async (payload: SyncCommand["payload"], retry = false) => {
      if (lock.current || !transport.current || !current.current) return;
      lock.current = true;
      setBusy(true);
      setMessage(
        payload.action === "send"
          ? "Preparing the view for your other screen…"
          : payload.action === "accept"
            ? "Opening your view…"
            : "Updating your connected screens…",
      );
      const input =
        retry && pending.current
          ? pending.current
          : {
              messageId: createCrossdeckId(),
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
        const connectedNow = navigator.onLine !== false;
        setOnline(connectedNow);
        connectionRef.current?.(connectedNow ? "live" : "offline");
        setMessage(
          payload.action === "send" ? "Ready to receive on your other screen." : "Your devices are up to date.",
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
    const open = async (object: ObjectRef, context: Continuity, mode: TransferMode, readOnly: boolean) => {
      await resumeRef.current(object, context, { mode, readOnly });
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
          const committed = snapshot.presentations.find((p) => objectKey(p.object) === objectKey(h.object));
          await open(h.object, h.context, h.mode, committed?.custody !== snapshot.surfaceId);
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
        if (followingFamilyRef.current !== undefined && followingFamilyRef.current !== p.object.family) continue;
        const previous = lastApplied.current.get(objectKey(p.object));
        if ((p.custody === snapshot.surfaceId && previous !== undefined) || previous === p.revision) continue;
        try {
          await open(p.object, p.context, p.views[snapshot.surfaceId] ?? "SEND_VIEW", p.custody !== snapshot.surfaceId);
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
  const selectedTarget =
    (destinations.some((s) => s.surfaceId === target) ? target : "") ||
    (destinations.some((s) => s.surfaceId === preferred) ? preferred : "") ||
    (destinations.length === 1 ? destinations[0].surfaceId : "");
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
    if (object && selectedTarget) {
      picker.current?.close();
      sendTrigger.current?.focus();
      void command({
        action: "send",
        targetId: selectedTarget,
        object,
        context: captured(),
        mode,
        privateConfirmed: confirmed,
      });
    }
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
      <button
        ref={sendTrigger}
        className={styles.sendTrigger}
        type="button"
        onClick={() => picker.current?.showModal()}
      >
        {destinations.length === 1 ? `Send to ${destinations[0].label}` : "Send to another screen"}
      </button>
      <dialog
        ref={picker}
        className={styles.sendDialog}
        aria-labelledby={pickerTitle}
        onCancel={() => sendTrigger.current?.focus()}
      >
        <div className={styles.dialogHeading}>
          <div>
            <p className={styles.eyebrow}>Continue together</p>
            <h2 id={pickerTitle}>Send this view</h2>
          </div>
          <button
            className={styles.close}
            type="button"
            aria-label="Close send options"
            onClick={() => {
              picker.current?.close();
              sendTrigger.current?.focus();
            }}
          >
            ×
          </button>
        </div>
        {!snapshot ? (
          <p>Connect this screen using “Connect another device” in your Chronicle to send and receive views.</p>
        ) : !object ? (
          <p>Open a Chart, released Journal passage, note or artifact to send it.</p>
        ) : (
          <>
            <p>Choose where to open it. Your current place stays here.</p>
            {destinations.length === 0 ? (
              <p>No other screen is available. Reopen your companion to reconnect.</p>
            ) : (
              <fieldset className={styles.destinations}>
                <legend>Your connected screens</legend>
                {destinations.map((surface) => (
                  <label
                    key={surface.surfaceId}
                    className={selectedTarget === surface.surfaceId ? styles.selectedDevice : styles.destination}
                  >
                    <input
                      type="radio"
                      name="sendDestination"
                      value={surface.surfaceId}
                      checked={selectedTarget === surface.surfaceId}
                      onChange={() => setTarget(surface.surfaceId)}
                      disabled={busy || !online}
                    />
                    <span>
                      <strong>{surface.label}</strong>
                      <small>{roleNames[surface.role as keyof typeof roleNames]}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {object.family === "NOTE" && (
              <label className={styles.privateConfirmation}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmation(event.target.checked ? confirmationKey : "")}
                />
                Send this private note to my selected device
              </label>
            )}
            <details className={styles.advanced}>
              <summary>More ways to open</summary>
              <label>
                How this screen participates
                <select
                  aria-label="Transfer mode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as TransferMode)}
                  disabled={busy}
                >
                  {modes.map((value) => (
                    <option key={value} value={value}>
                      {modeNames[value]}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.muted}>
                {mode === "MOVE_CUSTODY"
                  ? "Your other screen controls this view. You can recover it here."
                  : mode === "MIRROR"
                    ? "Follow the controlling screen’s view as it changes."
                    : mode === "SEND_VIEW"
                      ? "Share a read-only view of this moment."
                      : mode === "PIN_TO_SURFACE"
                        ? "Keep this moment on your selected screen."
                        : "Open alongside your Chronicle without moving its story."}
              </p>
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
                Use this screen next time
              </button>
            </details>
            <button
              className={styles.primary}
              type="button"
              disabled={busy || !online || !selectedTarget || (object.family === "NOTE" && !confirmed)}
              onClick={send}
            >
              Send view
            </button>
          </>
        )}
      </dialog>
      {incoming.map((handoff) => (
        <div className={styles.arrival} key={handoff.id}>
          <div>
            <small>From your other screen</small>
            <p>{handoff.title} is ready to open.</p>
          </div>
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => void command({ action: "accept", handoffId: handoff.id })}
          >
            Receive {handoff.title}
          </button>
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => void command({ action: "cancel", handoffId: handoff.id })}
          >
            Decline
          </button>
        </div>
      ))}
      {outgoing.slice(-1).map((handoff) => (
        <div className={styles.receipt} key={handoff.id}>
          <p>
            {handoff.state === "ACKNOWLEDGED"
              ? `${handoff.title} is open on your other device.`
              : handoff.state === "COMMITTED"
                ? `${handoff.title} arrived. Waiting for that device to open it.`
                : handoff.state === "OFFERED"
                  ? `${handoff.title} is ready to receive. It stays here until opened there.`
                  : handoff.state === "EXPIRED"
                    ? "The invitation expired. Your view remains recoverable."
                    : "That transfer ended. Your view remains recoverable."}
          </p>
          {handoff.state === "OFFERED" && (
            <button
              type="button"
              disabled={busy || !online}
              onClick={() => void command({ action: "cancel", handoffId: handoff.id })}
            >
              Cancel send
            </button>
          )}
          {["COMMITTED", "ACKNOWLEDGED"].includes(handoff.state) &&
            !snapshot?.presentations.some((p) => objectKey(p.object) === objectKey(handoff.object)) && (
              <button
                type="button"
                disabled={busy || !online}
                onClick={() => void command({ action: "recover", object: handoff.object })}
              >
                Recover {handoff.title} here
              </button>
            )}
        </div>
      ))}
      {snapshot?.presentations.length ? (
        <details className={styles.viewOptions}>
          <summary>Connected view options</summary>
          {snapshot.presentations.map((p) => (
            <div key={objectKey(p.object)}>
              <p>
                {p.title} · {p.custody === snapshot.surfaceId ? "Controlled here" : "Read-only companion view"}
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
      ) : null}
      {retryPayload && !busy && (
        <button type="button" disabled={!online} onClick={() => void command(retryPayload, true)}>
          Check and retry transfer
        </button>
      )}
      <p className={styles.status} role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
