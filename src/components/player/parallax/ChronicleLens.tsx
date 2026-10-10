"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ParallaxLensRuntime, type LensSnapshot } from "@/parallax/runtime";
import { unknownState } from "@/sextant/contracts";
import type { InstanceBinding, SpatialMoment } from "@/parallax/contracts";
import { NativeSpatialAdapter } from "@/parallax/native";
import { landfallNativeHost } from "@/landfall/native-bridge";
import styles from "./ChronicleLens.module.css";

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
          onClose={() => setOpen(false)}
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
}: {
  moment: SpatialMoment;
  binding: InstanceBinding;
  replayOnly: boolean;
  loadBinding?: () => Promise<{ moment: SpatialMoment; binding: InstanceBinding; replayOnly: boolean }>;
  record?: (receipt: unknown) => Promise<void>;
  onClose: () => void;
}) {
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
  const [replay, setReplay] = useState(replayOnly);
  const [pending, setPending] = useState<Awaited<ReturnType<ParallaxLensRuntime["interact"]>> | null>(null);
  useEffect(() => {
    let active = true;
    const previous = document.activeElement as HTMLElement | null;
    const view = dialog.current;
    view?.showModal();
    async function initialize() {
      try {
        const bound = loadBinding ? await loadBinding() : { moment, binding, replayOnly };
        if (!active) return;
        setReplay(bound.replayOnly);
        setActiveMoment(bound.moment);
        const lens = new ParallaxLensRuntime(
          bound.moment,
          bound.binding,
          { camera: unknownState(), replayOnly: bound.replayOnly, environment: "PRODUCTION" },
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
      if (document.visibilityState === "hidden") void runtime.current?.useGuidedView();
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", pause);
      void runtime.current?.close();
      runtime.current = null;
      view?.close();
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
      const receipt = await runtime.current.interact(entityId, type, crypto.randomUUID());
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
        </div>
        <button type="button" onClick={onClose} aria-label="Close Chronicle Lens">
          ×
        </button>
      </header>
      <div className={styles.stage}>
        <div className={styles.compass} aria-hidden="true">
          <LensMark />
        </div>
        <p className={styles.viewLabel}>{state?.mode === "NATIVE" ? "Camera View" : "Guided View"}</p>
        <p className={styles.narrative}>
          {activeMoment.attachment.overrides.narrative ?? activeMoment.version.fallback.narrative}
        </p>
        <div className={styles.objects}>
          {activeMoment.version.entities.map((e) => (
            <article
              key={e.id}
              className={`${styles.object} ${state?.selectedEntityId === e.id ? styles.selected : ""}`}
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
        {nativeAvailable && (
          <button type="button" disabled={busy} onClick={() => void openNative()}>
            Use camera for local placement
          </button>
        )}
        <p role="status">
          {observed
            ? replay
              ? "Revisited. Your Voyage progress stays the same."
              : "Interaction recorded. Continue through the passage when you are ready."
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
