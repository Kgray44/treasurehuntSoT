"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CrossdeckHandoff } from "./CrossdeckHandoff";
import { useCrossdeckSession, type CrossdeckConnection } from "./useCrossdeckSession";
import { companionHref } from "@/crossdeck/experiences";
import type { ObjectRef, Continuity } from "@/crossdeck/sync-contracts";
import { LandfallMapRenderer } from "@/landfall/map-renderer";
import type { LandfallMapScene } from "@/landfall/map-projection";
import styles from "./CrossdeckDisplay.module.css";

type Props = { voyageId: string; connection?: CrossdeckConnection };
type CrewView = { title: string; text: string; context: Continuity; scene?: LandfallMapScene };
type RenderedView = { payload: CrewView; object: ObjectRef; generation: number };
const hasCrewAuthority = (connection: CrossdeckConnection, voyageId: string) =>
  Boolean(
    connection.ready &&
      !connection.signedOut &&
      connection.csrf &&
      connection.here?.thisSession &&
      connection.here.voyageId === voyageId &&
      connection.here.role === "SHARED_CREW_DISPLAY",
  );

export function CrossdeckDisplay({ voyageId, connection }: Props) {
  return connection ? (
    <CrossdeckDisplaySession key={voyageId} voyageId={voyageId} connection={connection} />
  ) : (
    <CrossdeckDisplayParticipation key={voyageId} voyageId={voyageId} />
  );
}

/** Standalone displays participate; a companion gateway already owns this hook. */
function CrossdeckDisplayParticipation({ voyageId }: { voyageId: string }) {
  const connection = useCrossdeckSession(voyageId);
  return <CrossdeckDisplaySession voyageId={voyageId} connection={connection} />;
}

function CrossdeckDisplaySession({ voyageId, connection }: { voyageId: string; connection: CrossdeckConnection }) {
  const router = useRouter();
  const mounted = useRef(true);
  const surfaceId = connection.here?.surfaceId;
  const latestSurface = useRef(surfaceId);
  const [returning, setReturning] = useState(false);
  const [actionError, setActionError] = useState("");
  useLayoutEffect(() => {
    latestSurface.current = surfaceId;
  }, [surfaceId]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const returnToJournal = async () => {
    if (!hasCrewAuthority(connection, voyageId) || !surfaceId || returning || connection.busy) return;
    setReturning(true);
    setActionError("");
    try {
      const updated = await connection.act(
        { action: "role", surfaceId, role: "JOURNAL" },
        "Journal companion is ready on this device.",
      );
      if (!mounted.current || latestSurface.current !== surfaceId) return;
      if (
        !updated?.surface?.thisSession ||
        updated.surface.surfaceId !== surfaceId ||
        updated.surface.voyageId !== voyageId ||
        updated.surface.role !== "JOURNAL"
      ) {
        setActionError("The Journal companion could not open. Your crew display remains available.");
        return;
      }
      router.replace(companionHref(voyageId));
    } finally {
      if (mounted.current) setReturning(false);
    }
  };
  return (
    <CrossdeckDisplayPresentation
      key={`${surfaceId ?? "unconnected"}:${hasCrewAuthority(connection, voyageId)}`}
      voyageId={voyageId}
      connection={connection}
      returning={returning}
      actionError={actionError}
      onReturn={() => void returnToJournal()}
    />
  );
}

/** Authorization changes discard all presentation state and abort its pending receipts. */
function CrossdeckDisplayPresentation({
  voyageId,
  connection,
  returning,
  actionError,
  onReturn,
}: {
  voyageId: string;
  connection: CrossdeckConnection;
  returning: boolean;
  actionError: string;
  onReturn: () => void;
}) {
  const article = useRef<HTMLElement>(null);
  const pendingView = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const requestedObject = useRef<ObjectRef | null>(null);
  const authorized = hasCrewAuthority(connection, voyageId);
  const surfaceId = connection.here?.surfaceId;
  const [viewObject, setViewObject] = useState<ObjectRef | null>(null);
  const [view, setView] = useState<RenderedView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingView.current?.abort();
    };
  }, []);

  // Restricted presentation refresh is separate from the canonical participation heartbeat.
  useEffect(() => {
    if (!authorized || !viewObject || !surfaceId) return;
    const controller = new AbortController();
    let ticking = false;
    const tick = async () => {
      if (ticking || controller.signal.aborted) return;
      ticking = true;
      const observedGeneration = generation.current;
      const live = () =>
        !controller.signal.aborted &&
        mounted.current &&
        generation.current === observedGeneration &&
        JSON.stringify(viewObject) === JSON.stringify(requestedObject.current);
      let notice = "Connection interrupted. Reconnect this display to check the shared view.";
      try {
        const params = new URLSearchParams({
          voyage: voyageId,
          surface: surfaceId,
          object: viewObject.objectId,
          version: viewObject.version,
          family: viewObject.family,
        });
        const response = await fetch(`/api/crossdeck/view?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!live()) return;
        if (!response.ok) {
          notice = [401, 403, 404].includes(response.status)
            ? "This view is no longer shared with the crew."
            : "The shared view could not be refreshed. Reconnect to try again.";
          throw new Error(notice);
        }
        const payload: CrewView = await response.json();
        if (live())
          setView((current) => (current?.generation === observedGeneration ? { ...current, payload } : current));
      } catch {
        if (live()) {
          generation.current++;
          pendingView.current?.abort();
          requestedObject.current = null;
          setView(null);
          setViewObject(null);
          setError(notice);
        }
      } finally {
        ticking = false;
      }
    };
    const timer = window.setInterval(() => void tick(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [authorized, surfaceId, viewObject, voyageId]);

  const resume = async (object: ObjectRef) => {
    if (!authorized || !surfaceId || !mounted.current) throw new Error("Reconnect this crew display first.");
    pendingView.current?.abort();
    const controller = new AbortController();
    pendingView.current = controller;
    requestedObject.current = object;
    const observedGeneration = ++generation.current;
    const live = () =>
      !controller.signal.aborted &&
      mounted.current &&
      pendingView.current === controller &&
      generation.current === observedGeneration;
    setView(null);
    setViewObject(null);
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        voyage: voyageId,
        surface: surfaceId,
        object: object.objectId,
        version: object.version,
        family: object.family,
      });
      const response = await fetch(`/api/crossdeck/view?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!live()) throw new Error("Crew view request ended.");
      if (!response.ok) throw new Error("This crew view is unavailable. Ask your crew to share it again.");
      const payload: CrewView = await response.json();
      if (!live()) throw new Error("Crew view request ended.");
      setView({ payload, object, generation: observedGeneration });
      const displayed = () => {
        const panel = article.current;
        if (
          !live() ||
          !panel?.isConnected ||
          panel.dataset.crewGeneration !== String(observedGeneration) ||
          panel.dataset.crewObject !== object.objectId ||
          panel.dataset.crewVersion !== object.version ||
          panel.dataset.crewFamily !== object.family ||
          panel.getBoundingClientRect().width === 0 ||
          panel.getBoundingClientRect().height === 0 ||
          getComputedStyle(panel).visibility === "hidden" ||
          panel.querySelector("[data-crew-title]")?.textContent !== payload.title ||
          panel.querySelector("[data-crew-content]")?.textContent !== payload.text
        )
          return false;
        if (object.family !== "MAP") return true;
        if (!payload.scene) return false;
        const map = panel.querySelector<SVGElement | HTMLCanvasElement>(
          'svg[aria-label="Virtual Landfall chart"], svg[aria-label="Released physical chart"], [aria-label="Physical Landfall map"] canvas',
        );
        return Boolean(
          map &&
            !map.closest('[aria-hidden="true"], [inert]') &&
            map.getBoundingClientRect().width > 0 &&
            map.getBoundingClientRect().height > 0,
        );
      };
      const started = Date.now();
      while (live() && !displayed() && Date.now() - started < 8000)
        await new Promise((resolve) => setTimeout(resolve, 40));
      if (!displayed()) throw new Error("This crew view is not ready. Try receiving it again.");
      // A frame can be suspended in a background tab; cancellation and a deadline keep the receipt recoverable.
      await new Promise<void>((resolve, reject) => {
        const ended = () => {
          cancelAnimationFrame(frame);
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", ended);
          reject(new Error("Crew view request ended."));
        };
        const frame = requestAnimationFrame(() => {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", ended);
          resolve();
        });
        const timer = setTimeout(ended, Math.max(1, 8000 - (Date.now() - started)));
        controller.signal.addEventListener("abort", ended, { once: true });
      });
      if (!displayed()) throw new Error("Crew view request ended.");
      setViewObject(object);
      setLoading(false);
    } catch (cause) {
      if (live()) {
        setView(null);
        setViewObject(null);
        setLoading(false);
        setError(cause instanceof Error ? cause.message : "This crew view could not open.");
      }
      throw cause;
    }
  };

  return (
    <main className={styles.display} data-crossdeck-crew-display>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.mark} aria-hidden="true">
            ✦
          </span>
          <div>
            <p className={styles.eyebrow}>Crossdeck · shared with your crew</p>
            <h1>Crew display</h1>
          </div>
        </div>
        <Link
          className={styles.manageLink}
          href={`/account/devices?voyage=${encodeURIComponent(voyageId)}`}
          prefetch={false}
        >
          Manage this display
        </Link>
      </header>
      <p className={styles.status} role="status">
        <span className={authorized ? styles.connected : styles.reconnecting} aria-hidden="true" />
        {authorized
          ? "Connected · read-only crew view"
          : connection.ready
            ? "Display disconnected"
            : "Connecting your display"}
      </p>
      <section className={styles.workspace} aria-label="Crew presentation" aria-busy={loading || !connection.ready}>
        <p className={styles.eyebrow}>Your shared screen</p>
        <p className={styles.description}>
          Only views deliberately shared with the crew appear here. Personal notes stay private.
        </p>
        {!authorized ? (
          <div className={styles.empty}>
            <h2>{connection.ready ? "Reconnect this display" : "Getting your display ready"}</h2>
            <p>
              {connection.ready
                ? connection.message ||
                  "Connect this device as a crew display from your Chronicle to receive a shared view."
                : "Checking this device and your Voyage access…"}
            </p>
          </div>
        ) : error ? (
          <div className={styles.empty} role="alert">
            <h2>The shared view is unavailable</h2>
            <p>{error}</p>
            <p>Receive a newly shared view below, or reconnect this display.</p>
          </div>
        ) : view ? (
          <article
            ref={article}
            className={styles.presentation}
            aria-label="Shared crew view"
            data-crew-object={view.object.objectId}
            data-crew-version={view.object.version}
            data-crew-family={view.object.family}
            data-crew-generation={view.generation}
          >
            <h2 data-crew-title>{view.payload.title}</h2>
            <p className={styles.prose} data-crew-content>
              {view.payload.text}
            </p>
            {view.payload.scene && <LandfallMapRenderer key={view.generation} scene={view.payload.scene} />}
          </article>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyMark} aria-hidden="true">
              ✦
            </span>
            <h2>{loading ? "Opening the shared view" : "Ready for your crew’s next view"}</h2>
            <p>
              {loading
                ? "Preparing the released content for this screen…"
                : "On another connected device, choose a crew-visible view and send it to this display. Receive it below."}
            </p>
          </div>
        )}
      </section>
      {authorized && (
        <>
          <div className={styles.transfer}>
            <CrossdeckHandoff
              voyageId={voyageId}
              csrfToken={connection.csrf}
              object={null}
              context={{}}
              resume={resume}
            />
          </div>
          <footer className={styles.footer}>
            <p>Use this screen privately when you want to return to your own released passages.</p>
            {actionError && <p role="alert">{actionError}</p>}
            <button
              type="button"
              className={styles.journalAction}
              disabled={returning || connection.busy}
              onClick={onReturn}
            >
              {returning ? "Opening your Journal…" : "Use my Journal companion"}
            </button>
          </footer>
        </>
      )}
    </main>
  );
}
