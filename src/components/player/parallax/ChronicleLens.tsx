"use client";
import { useOptionalMotionPolicyContext } from "@/animation/motion/MotionPolicyContext";
import { createBrowserUuid } from "@/lib/browser-uuid";
import { createContext, useContext, useEffect, useRef, useState, useCallback, useId, type ReactNode } from "react";
import { ParallaxLensRuntime, type LensSnapshot } from "@/parallax/runtime";
import { unknownState } from "@/sextant/contracts";
import type { InstanceBinding, SpatialMoment } from "@/parallax/contracts";
import { NativeSpatialAdapter } from "@/parallax/native";
import { landfallNativeHost } from "@/landfall/native-bridge";
import styles from "./ChronicleLens.module.css";
import { fieldConsentDisclosure, type FieldMetadata } from "@/parallax/field-contracts";
import { BrowserRoomView } from "./BrowserRoomView";
import { VoyageContext, type VoyageContextData } from "@/components/crossdeck/VoyageContext";

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

const context = createContext<{
  sessionId: string;
  csrfToken: string;
  voyageContext?: VoyageContextData;
  onLensPresentationChange?: (open: boolean) => void;
} | null>(null);
export function ParallaxJournalProvider({
  sessionId,
  csrfToken,
  children,
  voyageContext,
  onLensPresentationChange,
}: {
  sessionId: string;
  csrfToken: string;
  children: ReactNode;
  voyageContext?: VoyageContextData;
  onLensPresentationChange?: (open: boolean) => void;
}) {
  return (
    <context.Provider value={{ sessionId, csrfToken, voyageContext, onLensPresentationChange }}>
      {children}
    </context.Provider>
  );
}
export function ChronicleLensEntry({
  moment,
  blockId,
  replayOnly,
  initiallyOpen = false,
  compact = false,
}: {
  moment: SpatialMoment;
  blockId: string;
  replayOnly: boolean;
  initiallyOpen?: boolean;
  compact?: boolean;
}) {
  const voyage = useContext(context);
  const descriptionId = useId();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className={compact ? styles.compactEntry : styles.entry}>
      {!compact && (
        <>
          <span aria-hidden="true" className={styles.mark}>
            <LensMark />
          </span>
          <div>
            <strong>{moment.version.title}</strong>
            <p>
              {replayOnly
                ? "Revisit this released scene in view-only mode."
                : "Open this passage’s scene in your room."}
            </p>
          </div>
        </>
      )}
      {compact && (
        <span id={descriptionId} className="sr-only">
          {moment.version.title}.{" "}
          {replayOnly ? "Revisit this released scene in view-only mode." : "Open this passage’s scene in your room."}
        </span>
      )}
      <button
        type="button"
        aria-describedby={compact ? descriptionId : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
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
          voyageContext={voyage?.voyageContext?.voyageId === voyage?.sessionId ? voyage?.voyageContext : undefined}
          onPresentationChange={voyage?.onLensPresentationChange}
          loadBinding={
            voyage
              ? async () => {
                  const response = await fetch(
                    `/api/player/playthroughs/${encodeURIComponent(voyage.sessionId)}/parallax?block=${encodeURIComponent(blockId)}`,
                    { cache: "no-store" },
                  );
                  if (!response.ok) throw new Error("The released spatial moment could not be opened.");
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
                    throw new Error("This interaction could not be recorded. Try again while this passage is active.");
                }
              : undefined
          }
          onClose={() => {
            setOpen(false);
          }}
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
export function ChronicleLens({
  moment,
  binding,
  replayOnly,
  loadBinding,
  record,
  onClose,
  field,
  voyageContext,
  onPresentationChange,
}: {
  moment: SpatialMoment;
  binding: InstanceBinding;
  replayOnly: boolean;
  loadBinding?: () => Promise<{
    moment: SpatialMoment;
    binding: InstanceBinding;
    replayOnly: boolean;
    fieldObservationId?: string | null;
  }>;
  record?: (receipt: unknown) => Promise<void>;
  onClose: () => void;
  field?: (body: unknown) => Promise<{ observationId?: string; withdrawn?: boolean }>;
  voyageContext?: VoyageContextData;
  onPresentationChange?: (open: boolean) => void;
}) {
  const motionPolicy = useOptionalMotionPolicyContext();
  const motionPreference = useRef(motionPolicy?.mode ?? "full");
  useEffect(() => {
    motionPreference.current = motionPolicy?.mode ?? "full";
  }, [motionPolicy?.mode]);
  const dialog = useRef<HTMLDialogElement>(null),
    runtime = useRef<ParallaxLensRuntime | null>(null);
  const [state, setState] = useState<LensSnapshot | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [observed, setObserved] = useState(false),
    [activeMoment, setActiveMoment] = useState(moment);
  const native = useRef<NativeSpatialAdapter | null>(null),
    nativeInteraction = useRef<((id: string, type: "PICK" | "INSPECT" | "PLACE") => void) | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [browserRequested, setBrowserRequested] = useState(false);
  const browserRuntime = useCallback(() => runtime.current, []);
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
    const previous = document.activeElement as HTMLElement | null;
    const view = dialog.current;
    view?.showModal();
    onPresentationChange?.(true);
    async function initialize() {
      try {
        const bound = loadBinding ? await loadBinding() : { moment, binding, replayOnly, fieldObservationId: null };
        if (!active) return;
        setReplay(bound.replayOnly);
        setActiveMoment(bound.moment);
        setFieldId(bound.fieldObservationId ?? "");
        const lens = new ParallaxLensRuntime(
          bound.moment,
          bound.binding,
          {
            camera: unknownState(),
            replayOnly: bound.replayOnly,
            environment: "PRODUCTION",
            searchClock: () => performance.now(),
            motionPreference: () => motionPreference.current,
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
            if (active) setState(s);
          },
        );
        runtime.current = lens;
        await lens.open();
        if (landfallNativeHost()) {
          const adapter = new NativeSpatialAdapter((id, type) => nativeInteraction.current?.(id, type));
          try {
            const capability = await adapter.discover();
            if (active && capability.supported) {
              native.current = adapter;
              setNativeAvailable(true);
            }
          } catch {
            /* Older native builds keep Guided View. */
          }
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "This spatial moment is unavailable.");
      }
    }
    void initialize();
    const pause = () => {
      runtime.current?.updateSearchActivity({ foreground: document.visibilityState !== "hidden" });
      // Native presentation can hide its WebView while the app remains foreground.
      // The companion's canonical lifecycle event owns camera shutdown in that case.
      if (document.visibilityState === "hidden" && !landfallNativeHost()) {
        if (runtime.current?.read().mode === "BROWSER") void runtime.current.close();
        else void runtime.current?.useGuidedView();
      }
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
      clearInterval(discoveryTick);
      window.removeEventListener("blur", lock);
      window.removeEventListener("focus", unlock);
      document.removeEventListener("visibilitychange", pause);
      void runtime.current?.close();
      runtime.current = null;
      view?.close();
      onPresentationChange?.(false);
      previous?.focus();
    };
    // A Lens opening binds one immutable passage until it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function interact(entityId: string, type: "PICK" | "INSPECT" | "PLACE") {
    if (!runtime.current || busy) return;
    setBusy(true);
    setError(null);
    setObserved(false);
    try {
      const receipt = await runtime.current.interact(entityId, type, createBrowserUuid());
      setPending(receipt);
      if (!replay && record) await record(receipt);
      setPending(null);
      setObserved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Lens could not finish this interaction.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    nativeInteraction.current = (id, type) => {
      void interact(id, type);
    };
  });
  async function openNative() {
    if (!native.current || !runtime.current) return;
    setBusy(true);
    setError(null);
    try {
      const camera = await native.current.authorize();
      await runtime.current.updateDeviceContext(camera);
      await runtime.current.open(native.current);
    } catch {
      setError("The camera view is unavailable. The same clue is here in Guided View.");
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    if (!pending || !record || replay) return;
    setBusy(true);
    try {
      await record(pending);
      setPending(null);
      setError(null);
      setObserved(true);
    } catch {
      setError("This interaction is still waiting to be recorded.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialog} className={styles.lens} aria-labelledby="chronicle-lens-title" onCancel={onClose}>
      <header>
        <div>
          <p>Chronicle Lens</p>
          <h2 id="chronicle-lens-title">{activeMoment.version.title}</h2>
          {voyageContext?.voyageId === binding.sessionId && <VoyageContext voyage={voyageContext} />}
        </div>
        <button type="button" onClick={onClose} aria-label="Close Chronicle Lens">
          ×
        </button>
      </header>
      <div className={styles.stage}>
        {state && (
          <BrowserRoomView
            key={activeMoment.version.checksum}
            moment={activeMoment}
            runtime={browserRuntime}
            activeChanged={setBrowserRequested}
            select={(id) => {
              const entity = activeMoment.version.entities.find((e) => e.id === id);
              if (entity)
                void interact(id, entity.interactions.includes("INSPECT") ? "INSPECT" : entity.interactions[0]);
            }}
          />
        )}
        {!browserRequested && (
          <>
            <div className={styles.compass} aria-hidden="true">
              <LensMark />
            </div>
            <p className={styles.viewLabel}>{state?.mode === "NATIVE" ? "Camera View" : "Guided View"}</p>
            <p className={styles.narrative}>
              {activeMoment.attachment.overrides.narrative ?? activeMoment.version.fallback.narrative}
            </p>
          </>
        )}
        <div className={styles.objects} aria-label={browserRequested ? "Selected spatial object" : "Spatial objects"}>
          {activeMoment.version.entities
            .filter(
              (e) => state?.visibleEntityIds.includes(e.id) && (!browserRequested || state.selectedEntityId === e.id),
            )
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
                  {e.interactions.map((type) => (
                    <button
                      type="button"
                      key={type}
                      disabled={
                        busy ||
                        !state ||
                        !["READY", "GUIDED_FALLBACK"].includes(state.state) ||
                        (browserRequested && type === "PLACE")
                      }
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
                {state?.inspectedEntityId === e.id && (
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
        {nativeAvailable && (
          <button type="button" disabled={busy} onClick={() => void openNative()}>
            Use camera for local placement
          </button>
        )}
        {(!browserRequested || state?.mode === "BROWSER" || observed) && (
          <p role="status">
            {observed
              ? replay
                ? "Revisited. Your Voyage progress stays the same."
                : "Interaction recorded. Continue through the passage when you are ready."
              : (state?.guidance ?? "Opening this passage’s spatial moment…")}
          </p>
        )}
        {!browserRequested && <p>Readable, seated, and camera-free. The clue keeps its meaning here.</p>}
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
