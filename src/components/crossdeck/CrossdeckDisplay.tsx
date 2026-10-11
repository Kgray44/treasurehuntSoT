"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CrossdeckHandoff } from "./CrossdeckHandoff";
import { storageKey } from "@/crossdeck/client";
import type { ObjectRef, Continuity } from "@/crossdeck/sync-contracts";
import { LandfallMapRenderer } from "@/landfall/map-renderer";
import type { LandfallMapScene } from "@/landfall/map-projection";
export function CrossdeckDisplay({ voyageId }: { voyageId: string }) {
  return <CrossdeckDisplaySession key={voyageId} voyageId={voyageId} />;
}
function CrossdeckDisplaySession({ voyageId }: { voyageId: string }) {
  const pendingView = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const requestedObject = useRef<ObjectRef | null>(null);
  const [csrf, setCsrf] = useState("");
  const [viewObject, setViewObject] = useState<ObjectRef | null>(null);
  const [view, setView] = useState<{
    title: string;
    text: string;
    context: Continuity;
    scene?: LandfallMapScene;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      pendingView.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    const tick = async () => {
      const observedGeneration = generation.current;
      const live = () => !controller.signal.aborted && generation.current === observedGeneration;
      try {
        const r = await fetch(`/api/crossdeck?voyage=${encodeURIComponent(voyageId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await r.json();
        if (controller.signal.aborted) return;
        const own = data.surfaces?.find(
          (s: { surfaceId: string; role: string }) => s.surfaceId === sessionStorage.getItem(storageKey(voyageId)),
        );
        if (!r.ok || !own || own.role !== "SHARED_CREW_DISPLAY")
          throw new Error("Connect this device as a crew display first.");
        setCsrf(data.csrfToken);
        setError("");
        if (viewObject && JSON.stringify(viewObject) === JSON.stringify(requestedObject.current) && live()) {
          const params = new URLSearchParams({
            voyage: voyageId,
            surface: own.surfaceId,
            object: viewObject.objectId,
            version: viewObject.version,
            family: viewObject.family,
          });
          const refreshed = await fetch(`/api/crossdeck/view?${params}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!refreshed.ok) {
            if (live()) {
              setView(null);
              setViewObject(null);
            }
          } else {
            const currentView = await refreshed.json();
            if (live()) setView(currentView);
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          generation.current++;
          pendingView.current?.abort();
          requestedObject.current = null;
          setView(null);
          setViewObject(null);
          setCsrf("");
          setError(cause instanceof Error ? cause.message : "Connection interrupted.");
        }
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [voyageId, viewObject]);
  const resume = async (object: ObjectRef) => {
    pendingView.current?.abort();
    const controller = new AbortController();
    pendingView.current = controller;
    requestedObject.current = object;
    generation.current++;
    const params = new URLSearchParams({
      voyage: voyageId,
      surface: sessionStorage.getItem(storageKey(voyageId)) ?? "",
      object: object.objectId,
      version: object.version,
      family: object.family,
    });
    const r = await fetch(`/api/crossdeck/view?${params}`, { cache: "no-store", signal: controller.signal });
    if (controller.signal.aborted || pendingView.current !== controller) throw new Error("Crew view request ended.");
    if (!r.ok) {
      setView(null);
      throw new Error("This crew view is unavailable.");
    }
    const currentView = await r.json();
    if (controller.signal.aborted || pendingView.current !== controller) throw new Error("Crew view request ended.");
    setView(currentView);
    setViewObject(object);
  };
  return (
    <main className="page-shell">
      <h1>Crew display</h1>
      <p>Only views explicitly shared with your crew appear here.</p>
      {error && <p role="alert">{error}</p>}
      {view && (
        <article aria-label="Shared crew view">
          <h2>{view.title}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{view.text}</p>
          {view.scene && <LandfallMapRenderer scene={view.scene} />}
          {view.context.mapId && (
            <p>
              Chart: {view.context.mapId}
              {view.context.selectedMarkerId ? ` · Selected place: ${view.context.selectedMarkerId}` : ""}
            </p>
          )}
        </article>
      )}
      {csrf && <CrossdeckHandoff voyageId={voyageId} csrfToken={csrf} object={null} context={{}} resume={resume} />}
      <Link href={`/account/devices?voyage=${encodeURIComponent(voyageId)}`}>Manage this display</Link>
    </main>
  );
}
