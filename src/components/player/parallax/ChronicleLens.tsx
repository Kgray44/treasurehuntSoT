"use client";
import { createBrowserUuid } from "@/lib/browser-uuid";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ParallaxLensRuntime, type LensSnapshot, type SpatialRuntimeAdapter } from "@/parallax/runtime";
import { unknownState, type CapabilityState } from "@/sextant/contracts";
import type { InstanceBinding, InteractionReceipt, SpatialMoment } from "@/parallax/contracts";
import { NativeSpatialAdapter } from "@/parallax/native";
import { landfallNativeHost } from "@/landfall/native-bridge";
import styles from "./ChronicleLens.module.css";
import { fieldConsentDisclosure, type FieldMetadata } from "@/parallax/field-contracts";

class LensAccessError extends Error {}
type LoadedBinding = {
  moment: SpatialMoment;
  binding: InstanceBinding;
  replayOnly: boolean;
  fieldObservationId?: string | null;
};
type SpatialSelection = (id: string, type: "PICK" | "INSPECT" | "PLACE", signal: AbortSignal) => void;
export interface ChronicleLensAdapter extends SpatialRuntimeAdapter {
  discover?(): Promise<{ supported: boolean }>;
  authorize?(): Promise<CapabilityState>;
}
const deviceLabContext = createContext<((select: SpatialSelection) => ChronicleLensAdapter) | null>(null);
const accessFailure = (status: number, message: string) =>
  [401, 403, 404, 409, 410].includes(status) ? new LensAccessError(message) : new Error(message);
const bindingIdentity = (value: LoadedBinding) =>
  JSON.stringify([
    value.binding.sessionId,
    value.binding.chronicleVersionId,
    value.binding.blockId,
    value.binding.actorId,
    value.binding.runId,
    value.moment.version.id,
    value.moment.version.checksum,
    value.moment.attachment.id,
  ]);
async function boundedLensOperation<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Waiting for connection. Return to the Lens and retry.")), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function LensMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="11" />
      <path d="M16 1v7M16 24v7M1 16h7M24 16h7M12 20l3-7 5-1-3 7z" />
    </svg>
  );
}

const context = createContext<{ sessionId: string; csrfToken: string } | null>(null);
export function ParallaxJournalProvider({
  sessionId,
  csrfToken,
  children,
}: {
  sessionId: string;
  csrfToken: string;
  children: ReactNode;
}) {
  return <context.Provider value={{ sessionId, csrfToken }}>{children}</context.Provider>;
}
export function ChronicleLensEntry({
  moment,
  blockId,
  replayOnly,
}: {
  moment: SpatialMoment;
  blockId: string;
  replayOnly: boolean;
}) {
  const voyage = useContext(context);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.entry}>
      <span aria-hidden="true" className={styles.mark}>
        <LensMark />
      </span>
      <div>
        <strong>{moment.version.title}</strong>
        <p>A spatial moment is tucked into this passage.</p>
      </div>
      <button type="button" onClick={() => setOpen(true)}>
        Open Chronicle Lens
      </button>
      {open && (
        <ChronicleLens
          moment={moment}
          binding={{
            sessionId: voyage?.sessionId ?? "preview-voyage",
            chronicleVersionId: "preview-edition",
            blockId,
            actorId: "preview-player",
            runId: voyage?.sessionId ?? "preview-run",
          }}
          replayOnly={replayOnly || !voyage}
          loadBinding={
            voyage
              ? async () => {
                  const response = await fetch(
                    `/api/player/playthroughs/${encodeURIComponent(voyage.sessionId)}/parallax?block=${encodeURIComponent(blockId)}`,
                    { cache: "no-store" },
                  );
                  if (!response.ok)
                    throw accessFailure(
                      response.status,
                      "This released passage is no longer available. Return to your Journal.",
                    );
                  return response.json();
                }
              : undefined
          }
          record={
            voyage
              ? async (receipt) => {
                  const response = await fetch(
                    `/api/player/playthroughs/${encodeURIComponent(voyage.sessionId)}/parallax`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-csrf-token": voyage.csrfToken },
                      body: JSON.stringify(receipt),
                    },
                  );
                  if (!response.ok)
                    throw accessFailure(
                      response.status,
                      "This interaction could not be recorded. Try again while this passage is active.",
                    );
                }
              : undefined
          }
          onClose={() => setOpen(false)}
          field={
            voyage
              ? async (body) => {
                  const response = await fetch(
                    `/api/player/playthroughs/${encodeURIComponent(voyage.sessionId)}/parallax/field`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-csrf-token": voyage.csrfToken },
                      body: JSON.stringify(body),
                    },
                  );
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error ?? "Feedback was not retained.");
                  return data;
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
export type ChronicleLensProps = {
  moment: SpatialMoment;
  binding: InstanceBinding;
  replayOnly: boolean;
  loadBinding?: () => Promise<LoadedBinding>;
  record?: (receipt: unknown) => Promise<void>;
  onClose: () => void;
  field?: (body: unknown) => Promise<{ observationId?: string; withdrawn?: boolean }>;
};

/** Explicit existing Device Lab bundle injection. Ordinary Player callers cannot
 * enable this through a URL, storage value, host event or runtime capability.
 * Simulated receipts still pass through the unchanged production authorizer.
 */
export function ChronicleLensDeviceLab({
  createAdapter,
  ...props
}: ChronicleLensProps & { createAdapter: (select: SpatialSelection) => ChronicleLensAdapter }) {
  return (
    <deviceLabContext.Provider value={createAdapter}>
      <ChronicleLens {...props} />
    </deviceLabContext.Provider>
  );
}

export function ChronicleLens({
  moment,
  binding,
  replayOnly,
  loadBinding,
  record,
  onClose,
  field,
}: ChronicleLensProps) {
  const createLabAdapter = useContext(deviceLabContext);
  const dialog = useRef<HTMLDialogElement>(null),
    runtime = useRef<ParallaxLensRuntime | null>(null);
  const [state, setState] = useState<LensSnapshot | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [observed, setObserved] = useState(false),
    [activeMoment, setActiveMoment] = useState(moment);
  const native = useRef<ChronicleLensAdapter | null>(null),
    nativeInteraction = useRef<SpatialSelection | null>(null);
  const lifecycle = useRef(0),
    mounted = useRef(false),
    operationBusy = useRef(false),
    accessInvalid = useRef(false),
    intentTail = useRef(Promise.resolve()),
    opening = useRef<Promise<void> | null>(null),
    pinned = useRef<LoadedBinding | null>(null),
    replayRef = useRef(replayOnly);
  const [accessLost, setAccessLost] = useState(false);
  const scopeKey = JSON.stringify([
    binding.sessionId,
    binding.chronicleVersionId,
    binding.blockId,
    binding.actorId,
    binding.runId,
    moment.version.checksum,
    !!createLabAdapter,
  ]);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [replay, setReplay] = useState(replayOnly);
  const [pending, setPending] = useState<Awaited<ReturnType<ParallaxLensRuntime["interact"]>> | null>(null);
  const [consent, setConsent] = useState(false),
    [physicalReport, setPhysicalReport] = useState(false),
    [fieldQuality, setFieldQuality] = useState<FieldMetadata["placementQuality"]>("BELIEVABLE"),
    [fieldId, setFieldId] = useState(""),
    [fieldStatus, setFieldStatus] = useState(""),
    [reading, setReading] = useState(false);
  const fieldKey = useRef(createBrowserUuid());
  const [manualConfidence, setManualConfidence] = useState<FieldMetadata["confidence"]>("ACCEPTABLE");
  const [manualResolved, setManualResolved] = useState(false),
    [manualSurface, setManualSurface] = useState<FieldMetadata["surface"]>("TABLE");
  useEffect(() => {
    let active = true;
    const generation = ++lifecycle.current;
    mounted.current = true;
    operationBusy.current = false;
    accessInvalid.current = false;
    intentTail.current = Promise.resolve();
    const previous = document.activeElement as HTMLElement | null;
    const view = dialog.current;
    view?.showModal();
    async function initialize() {
      try {
        // Reset the previous opening at the asynchronous session boundary.
        await Promise.resolve();
        if (!active || generation !== lifecycle.current) return;
        setAccessLost(false);
        setBusy(false);
        setState(null);
        setPending(null);
        setObserved(false);
        setError(null);
        setNativeAvailable(false);
        const bound = loadBinding ? await loadBinding() : { moment, binding, replayOnly, fieldObservationId: null };
        if (!active || generation !== lifecycle.current) return;
        pinned.current = bound;
        replayRef.current = bound.replayOnly;
        setReplay(bound.replayOnly);
        setActiveMoment(bound.moment);
        setFieldId(bound.fieldObservationId ?? "");
        const lens = new ParallaxLensRuntime(
          bound.moment,
          bound.binding,
          {
            camera: unknownState(),
            replayOnly: bound.replayOnly,
            environment: createLabAdapter ? "DEVICE_LAB" : "PRODUCTION",
            searchClock: () => performance.now(),
            searchTimeStore:
              loadBinding && !bound.replayOnly
                ? {
                    load: (key) => {
                      try {
                        return Number(sessionStorage.getItem(`parallax-search:${key}`) ?? 0);
                      } catch {
                        return 0;
                      }
                    },
                    save: (key, seconds) => {
                      try {
                        sessionStorage.setItem(`parallax-search:${key}`, String(seconds));
                      } catch {
                        /* Numeric session retention is optional when browser storage is unavailable. */
                      }
                    },
                  }
                : undefined,
          },
          () => new Date(),
          (s) => {
            if (active && generation === lifecycle.current) setState(s);
          },
        );
        runtime.current = lens;
        await lens.open();
        if (!active || generation !== lifecycle.current || runtime.current !== lens) return;
        if (createLabAdapter || landfallNativeHost()) {
          const selected: SpatialSelection = (id, type, signal) => nativeInteraction.current?.(id, type, signal);
          const adapter = createLabAdapter ? createLabAdapter(selected) : new NativeSpatialAdapter(selected);
          if (createLabAdapter && adapter.mode !== "SIMULATED")
            throw new Error("Device Lab requires an explicitly simulated provider.");
          try {
            const capability = adapter.discover ? await adapter.discover() : { supported: true };
            if (active && generation === lifecycle.current && capability.supported) {
              native.current = adapter;
              setNativeAvailable(true);
            }
          } catch (cause) {
            if (createLabAdapter) throw cause;
            /* Older native builds keep Guided View. */
          }
        }
      } catch (e) {
        if (active && generation === lifecycle.current)
          setError(e instanceof Error ? e.message : "This spatial moment is unavailable.");
      }
    }
    void initialize();
    const pause = () => {
      runtime.current?.updateSearchActivity({ foreground: document.visibilityState !== "hidden" });
      // Native presentation can hide its WebView while the app remains foreground.
      // The companion's canonical lifecycle event owns camera shutdown in that case.
      if (document.visibilityState === "hidden" && !landfallNativeHost()) void runtime.current?.useGuidedView();
    };
    document.addEventListener("visibilitychange", pause);
    const lock = () => runtime.current?.updateSearchActivity({ unlocked: false });
    const unlock = () => runtime.current?.updateSearchActivity({ unlocked: true });
    window.addEventListener("blur", lock);
    window.addEventListener("focus", unlock);
    const discoveryTick = setInterval(() => {
      void runtime.current?.tickDiscovery();
    }, 1000);
    return () => {
      active = false;
      mounted.current = false;
      intentTail.current = Promise.resolve();
      nativeInteraction.current = null;
      native.current = null;
      pinned.current = null;
      clearInterval(discoveryTick);
      window.removeEventListener("blur", lock);
      window.removeEventListener("focus", unlock);
      document.removeEventListener("visibilitychange", pause);
      void runtime.current?.close().catch(() => undefined);
      runtime.current = null;
      view?.close();
      previous?.focus();
    };
    // A Lens opening binds one immutable passage until it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);
  function currentScope(lens: ParallaxLensRuntime, generation: number) {
    return mounted.current && generation === lifecycle.current && runtime.current === lens && !accessInvalid.current;
  }
  async function verifyBinding(lens: ParallaxLensRuntime, generation: number) {
    if (loadBinding) {
      const latest = await boundedLensOperation(loadBinding());
      if (!currentScope(lens, generation)) return false;
      if (!pinned.current || bindingIdentity(latest) !== bindingIdentity(pinned.current))
        throw new LensAccessError("This passage or account changed. Close the Lens and reopen it from your Journal.");
      replayRef.current = latest.replayOnly;
      setReplay(latest.replayOnly);
    }
    return currentScope(lens, generation);
  }
  function showFailure(cause: unknown, lens: ParallaxLensRuntime, generation: number) {
    if (!currentScope(lens, generation)) return;
    setError(cause instanceof Error ? cause.message : "The Lens could not finish this interaction.");
    if (cause instanceof LensAccessError) {
      accessInvalid.current = true;
      setAccessLost(true);
      setNativeAvailable(false);
      setPending(null);
      setObserved(false);
      setBusy(false);
      operationBusy.current = false;
      intentTail.current = Promise.resolve();
      void lens.close().catch(() => undefined);
    }
  }
  async function interact(
    entityId: string,
    type: "PICK" | "INSPECT" | "PLACE",
    fromProvider = false,
    sourceSignal?: AbortSignal,
  ) {
    const lens = runtime.current,
      generation = lifecycle.current;
    if (!lens || operationBusy.current || !currentScope(lens, generation)) return;
    if (fromProvider && (sourceSignal?.aborted || lens.read().mode === "GUIDED")) return;
    operationBusy.current = true;
    setBusy(true);
    setError(null);
    setObserved(false);
    let receipt: InteractionReceipt | undefined;
    let failed = false;
    try {
      if (!(await verifyBinding(lens, generation))) return;
      if (fromProvider && (sourceSignal?.aborted || lens.read().mode === "GUIDED")) return;
      receipt = await lens.interact(entityId, type, createBrowserUuid());
      if (!currentScope(lens, generation)) return;
      setPending(receipt);
      if (!replayRef.current && record) await boundedLensOperation(record(receipt));
      if (!currentScope(lens, generation)) return;
      setPending(null);
      setObserved(true);
    } catch (e) {
      failed = true;
      showFailure(e, lens, generation);
    } finally {
      if (fromProvider && (type === "INSPECT" || failed) && currentScope(lens, generation)) {
        try {
          await lens.useGuidedView({ inspection: failed ? undefined : receipt });
        } catch (cause) {
          showFailure(cause, lens, generation);
        }
      }
      if (currentScope(lens, generation)) {
        operationBusy.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    nativeInteraction.current = (id, type, signal) => {
      const lens = runtime.current,
        generation = lifecycle.current;
      if (!lens || signal.aborted || !currentScope(lens, generation)) return;
      // A mesh PICK and the following Inspect button can arrive before the first
      // observation finishes. Keep order without losing Inspect behind UI busy.
      intentTail.current = intentTail.current
        .catch(() => undefined)
        .then(async () => {
          await opening.current?.catch(() => undefined);
          if (!signal.aborted && currentScope(lens, generation)) await interact(id, type, true, signal);
        });
    };
  });
  async function openProvider() {
    const provider = native.current,
      lens = runtime.current,
      generation = lifecycle.current;
    if (!provider || !lens || operationBusy.current || !currentScope(lens, generation)) return;
    operationBusy.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!(await verifyBinding(lens, generation))) return;
      if (provider.mode !== "SIMULATED") {
        if (!provider.authorize) throw new Error("This camera provider is unavailable.");
        const camera = await provider.authorize();
        if (!currentScope(lens, generation)) return;
        await lens.updateDeviceContext(camera);
      }
      if (currentScope(lens, generation)) await lens.open(provider);
    } catch (cause) {
      showFailure(cause, lens, generation);
    } finally {
      if (currentScope(lens, generation)) {
        operationBusy.current = false;
        setBusy(false);
      }
    }
  }
  async function openNative() {
    const operation = openProvider();
    opening.current = operation;
    try {
      await operation;
    } finally {
      if (opening.current === operation) opening.current = null;
    }
  }
  async function retry() {
    const lens = runtime.current,
      generation = lifecycle.current;
    if (!pending || !record || !lens || operationBusy.current || !currentScope(lens, generation)) return;
    operationBusy.current = true;
    setBusy(true);
    try {
      if (!(await verifyBinding(lens, generation))) return;
      if (!replayRef.current) await boundedLensOperation(record(pending));
      if (!currentScope(lens, generation)) return;
      if (pending.interactionType === "INSPECT" && lens.read().mode === "GUIDED") {
        await lens.useGuidedView({ inspection: pending });
        if (!currentScope(lens, generation)) return;
      }
      setPending(null);
      setError(null);
      setObserved(true);
    } catch (cause) {
      showFailure(cause, lens, generation);
    } finally {
      if (currentScope(lens, generation)) {
        operationBusy.current = false;
        setBusy(false);
      }
    }
  }
  function closeLens() {
    mounted.current = false;
    ++lifecycle.current;
    intentTail.current = Promise.resolve();
    nativeInteraction.current = null;
    native.current = null;
    const lens = runtime.current;
    runtime.current = null;
    void lens?.close().catch(() => undefined);
    onClose();
  }
  return (
    <dialog ref={dialog} className={styles.lens} aria-labelledby="chronicle-lens-title" onCancel={closeLens}>
      <header>
        <div>
          <p>Chronicle Lens</p>
          <h2 id="chronicle-lens-title">{activeMoment.version.title}</h2>
        </div>
        <button type="button" onClick={closeLens} aria-label="Close Chronicle Lens">
          ×
        </button>
      </header>
      <div className={styles.stage}>
        <div className={styles.compass} aria-hidden="true">
          <LensMark />
        </div>
        <p className={styles.viewLabel}>
          {state?.mode === "SIMULATED"
            ? "Camera-free Device Lab"
            : state?.mode === "NATIVE"
              ? "Camera View"
              : "Guided View"}
        </p>
        <p className={styles.narrative}>
          {accessLost
            ? "This Lens is no longer available. Return to your Journal."
            : (activeMoment.attachment.overrides.narrative ?? activeMoment.version.fallback.narrative)}
        </p>
        <div className={styles.objects}>
          {activeMoment.version.entities
            .filter((e) => !accessLost && state?.visibleEntityIds.includes(e.id))
            .map((e) => (
              <article
                key={e.id}
                className={`${styles.object} ${state?.selectedEntityId === e.id || state?.highlightedEntityIds.includes(e.id) ? styles.selected : ""}`}
                aria-label={e.alternativeText}
              >
                <p className={styles.objectKind}>
                  {e.kind === "PARCHMENT"
                    ? "A note from the voyage"
                    : e.kind === "MARKER"
                      ? "A mark to remember"
                      : "Words in the world"}
                </p>
                <h3>{e.name}</h3>
                <p>{e.content}</p>
                <div className={styles.controls}>
                  {(activeMoment.version.studio?.layers.find((layer) => layer.entityId === e.id)?.selectable === false
                    ? []
                    : e.interactions
                  ).map((type) => (
                    <button
                      type="button"
                      key={type}
                      disabled={busy || !state || !["READY", "GUIDED_FALLBACK"].includes(state.state)}
                      onClick={() => void interact(e.id, type)}
                    >
                      {type === "PICK"
                        ? "Choose"
                        : type === "INSPECT"
                          ? "Inspect"
                          : state?.mode === "NATIVE"
                            ? "Place on surface"
                            : "Place in Guided View"}
                    </button>
                  ))}
                </div>
                {observed && state?.inspectedEntityId === e.id && (
                  <p className={styles.inspected}>
                    You are inspecting {e.name}. {e.alternativeText}
                  </p>
                )}
              </article>
            ))}
        </div>
      </div>
      <footer>
        {activeMoment.version.adaptive && (
          <section aria-label="Discovery assistance">
            <p aria-live="polite">
              {(state?.activeDiscoveryEntityId
                ? state.discovery?.[state.activeDiscoveryEntityId]?.message
                : undefined) ?? "Show me is always available."}
            </p>
            <button type="button" onClick={() => void runtime.current?.reveal()}>
              Show me
            </button>
            <button
              type="button"
              onClick={() => {
                setReading(!reading);
                runtime.current?.updateSearchActivity({ storyReading: !reading });
              }}
            >
              {reading ? "Resume searching" : "Pause search while reading"}
            </button>
          </section>
        )}
        {field && activeMoment.version.adaptive?.calibration.enabled && (
          <details>
            <summary>Optional field feedback</summary>
            <p>{fieldConsentDisclosure(activeMoment.version.adaptive.calibration.retentionDays)}</p>
            {!fieldId && !replay && (
              <>
                <label>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I agree to
                  share these categories
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={physicalReport}
                    onChange={(e) => setPhysicalReport(e.target.checked)}
                  />{" "}
                  I personally tested the placement in a physical environment
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={manualResolved}
                    onChange={(e) => setManualResolved(e.target.checked)}
                  />{" "}
                  The intended placement worked in my physical test
                </label>
                <label>
                  Confidence in your report
                  <select
                    value={manualConfidence}
                    onChange={(e) => setManualConfidence(e.target.value as FieldMetadata["confidence"])}
                  >
                    <option>HIGH</option>
                    <option>ACCEPTABLE</option>
                    <option>LOW</option>
                    <option>NONE</option>
                  </select>
                </label>
                <label>
                  Observed surface
                  <select
                    value={manualSurface ?? "TABLE"}
                    onChange={(e) => setManualSurface(e.target.value as FieldMetadata["surface"])}
                  >
                    {["FLOOR", "TABLE", "DESK", "SHELF", "WALL", "OPEN_SPACE", "DEVICE"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Placement quality
                  <select value={fieldQuality} onChange={(e) => setFieldQuality(e.target.value as typeof fieldQuality)}>
                    <option value="BELIEVABLE">Believable</option>
                    <option value="ADJUSTMENT_NEEDED">Needs adjustment</option>
                    <option value="UNUSABLE">Unusable</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!consent || busy}
                  onClick={() => {
                    setBusy(true);
                    const resolution = state?.resolution;
                    const p = Object.values(resolution?.placements ?? {})[0];
                    const search = Object.values(state?.discovery ?? {})[0];
                    void field({
                      action: "CONTRIBUTE",
                      blockId: activeMoment.attachment.storyMomentId,
                      versionId: activeMoment.version.id,
                      versionChecksum: activeMoment.version.checksum,
                      idempotencyKey: fieldKey.current,
                      consent: true,
                      disclosureVersion: 1,
                      metadata: {
                        schemaVersion: 1,
                        provenance: physicalReport ? "PLAYER_REPORTED_PHYSICAL" : "SIMULATED",
                        resolved: physicalReport ? manualResolved : resolution?.status === "RESOLVED",
                        surface: physicalReport ? manualSurface : (p?.surface ?? null),
                        confidence:
                          physicalReport && manualResolved
                            ? manualConfidence
                            : p?.quality === "HIGH_MATCH"
                              ? "HIGH"
                              : p
                                ? "ACCEPTABLE"
                                : "NONE",
                        meaningfulSearchSeconds: search?.meaningfulSeconds ?? 0,
                        hintStage: search?.stage ?? 0,
                        exactReveal: state?.mode === "GUIDED",
                        trackingRecovered: state?.trackingRecovered ?? false,
                        fallback: state?.mode === "GUIDED",
                        capabilityLimitation: state?.mode === "GUIDED" ? "SURFACE_CONTEXT" : "NONE",
                        placementQuality: fieldQuality,
                      },
                    })
                      .then((result) => {
                        setFieldId(result.observationId ?? "");
                        setFieldStatus("Optional feedback shared. Chronicle completion is unaffected.");
                      })
                      .catch((e) => setFieldStatus(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Share optional feedback
                </button>
              </>
            )}
            {fieldId && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void field({ action: "WITHDRAW", observationId: fieldId })
                    .then(() => {
                      setFieldId("");
                      setConsent(false);
                      setFieldStatus("Feedback withdrawn and deleted.");
                    })
                    .catch((e) => setFieldStatus(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                Withdraw feedback
              </button>
            )}
            <p aria-live="polite">{fieldStatus}</p>
          </details>
        )}
        {nativeAvailable && !accessLost && (
          <button type="button" disabled={busy} onClick={() => void openNative()}>
            {createLabAdapter ? "Open camera-free Device Lab" : "Use camera for local placement"}
          </button>
        )}
        <p role="status">
          {observed
            ? replay
              ? "Revisited. Your Voyage progress stays the same."
              : "Interaction recorded. Continue through the passage when you are ready."
            : accessLost
              ? "This Lens is closed. Return to your Journal."
              : (state?.guidance ?? "Opening this passage’s spatial moment…")}
        </p>
        <p>Readable, seated, and camera-free. The clue keeps its meaning here.</p>
        {error && <p role="alert">{error}</p>}
        {pending && (
          <button disabled={busy} type="button" onClick={() => void retry()}>
            Retry recording interaction
          </button>
        )}
      </footer>
    </dialog>
  );
}
