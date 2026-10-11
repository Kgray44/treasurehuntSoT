"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CrossdeckHandoff } from "./CrossdeckHandoff";
import { storageKey } from "@/crossdeck/client";
import type { ObjectRef, Continuity } from "@/crossdeck/sync-contracts";
import { LandfallMapRenderer } from "@/landfall/map-renderer";
import type { LandfallMapScene } from "@/landfall/map-projection";
export function CrossdeckDisplay({ voyageId }: { voyageId: string }) {
  const [csrf, setCsrf] = useState("");
  const [viewObject, setViewObject] = useState<ObjectRef | null>(null);
  const [view, setView] = useState<{
    title: string;
    text: string;
    context: Continuity;
    scene?: LandfallMapScene;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const tick = async () => {
      try {
        const r = await fetch(`/api/crossdeck?voyage=${encodeURIComponent(voyageId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await r.json();
        const own = data.surfaces?.find(
          (s: { surfaceId: string; role: string }) => s.surfaceId === sessionStorage.getItem(storageKey(voyageId)),
        );
        if (!r.ok || !own || own.role !== "SHARED_CREW_DISPLAY")
          throw new Error("Connect this device as a crew display first.");
        setCsrf(data.csrfToken);
        setError("");
        if (viewObject) {
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
            setView(null);
            setViewObject(null);
          } else if (!controller.signal.aborted) setView(await refreshed.json());
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setView(null);
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
    const params = new URLSearchParams({
      voyage: voyageId,
      surface: sessionStorage.getItem(storageKey(voyageId)) ?? "",
      object: object.objectId,
      version: object.version,
      family: object.family,
    });
    const r = await fetch(`/api/crossdeck/view?${params}`, { cache: "no-store" });
    if (!r.ok) {
      setView(null);
      throw new Error("This crew view is unavailable.");
    }
    setView(await r.json());
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
