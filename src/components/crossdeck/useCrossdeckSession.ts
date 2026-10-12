"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { HEARTBEAT_MS } from "@/crossdeck/contracts";
import { browserProjection, crossdeckRequest, storageKey } from "@/crossdeck/client";
import type { SurfaceDto } from "@/crossdeck/service";

type ActionResult = { surface?: SurfaceDto; code?: string; expiresAt?: string; removed?: boolean };
export type CrossdeckConnection = ReturnType<typeof useCrossdeckSession>;

/** Participation only. Presentation remains on the canonical committed-change transport. */
export function useCrossdeckSession(initialVoyage = "") {
  const [voyage, setVoyage] = useState(initialVoyage);
  const [surfaces, setSurfaces] = useState<SurfaceDto[]>([]);
  const [voyages, setVoyages] = useState<{ id: string; title: string }[]>([]);
  const [label, setLabel] = useState("My device");
  const [ownId, setOwnId] = useState<string | null>(null);
  const [csrf, setCsrf] = useState("");
  const [ready, setReady] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const own = useRef<string | null>(null),
    csrfRef = useRef("");
  const lastPair = useRef<string | null>(null);
  const refreshRevision = useRef(0);
  const actionLock = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setLabel((current) =>
        current === "My device"
          ? window.innerWidth < 600
            ? "Phone"
            : window.innerWidth < 1000
              ? "Tablet"
              : "This computer"
          : current,
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  const refresh = useCallback(
    async (signal?: AbortSignal, afterMutation = false) => {
      if (actionLock.current && !afterMutation) return;
      const revision = ++refreshRevision.current;
      const response = await fetch(`/api/crossdeck${voyage ? `?voyage=${encodeURIComponent(voyage)}` : ""}`, {
        cache: "no-store",
        signal,
      });
      const data = await response.json();
      if (signal?.aborted || revision !== refreshRevision.current) return;
      if (response.status === 401 || response.status === 403) {
        setSignedOut(response.status === 401);
        setSurfaces([]);
        setCsrf("");
        csrfRef.current = "";
        own.current = null;
        setOwnId(null);
        setReady(true);
        if (voyage) sessionStorage.removeItem(storageKey(voyage));
        setMessage(
          response.status === 401
            ? "Sign in again to connect your devices."
            : "Access to this Voyage has ended. Your device is no longer connected.",
        );
        return;
      }
      if (!response.ok) throw new Error(data.error || "Your devices could not be loaded. Try reconnecting.");
      setCsrf(data.csrfToken);
      csrfRef.current = data.csrfToken;
      setSignedOut(false);
      setSurfaces(data.surfaces);
      setVoyages(data.voyages);
      setReady(true);
      const saved = voyage ? sessionStorage.getItem(storageKey(voyage)) : null;
      const here = data.surfaces.find(
        (s: SurfaceDto) => s.surfaceId === saved && s.thisSession && s.voyageId === voyage,
      );
      own.current = here?.surfaceId ?? null;
      setOwnId(own.current);
      if (saved && !here) sessionStorage.removeItem(storageKey(voyage));
      if (here?.pairing?.state === "CONNECTED" && here.pairing.surfaceId !== lastPair.current) {
        const target = data.surfaces.find((s: SurfaceDto) => s.surfaceId === here.pairing.surfaceId);
        if (target) {
          lastPair.current = target.surfaceId;
          setMessage(`${target.label} connected. Your Voyage is ready on both devices.`);
        }
      }
    },
    [voyage],
  );

  useEffect(() => {
    const controller = new AbortController();
    let leaving = false,
      ticking = false;
    const tick = async () => {
      if (leaving || ticking || controller.signal.aborted) return;
      ticking = true;
      try {
        if (!own.current || !csrfRef.current) await refresh(controller.signal);
        if (leaving || controller.signal.aborted) return;
        if (own.current && csrfRef.current)
          await crossdeckRequest(
            {
              action: "heartbeat",
              surfaceId: own.current,
              lifecycle: document.visibilityState === "visible" ? "ACTIVE" : "BACKGROUND",
              capabilities: browserProjection(),
            },
            csrfRef.current,
            controller.signal,
          );
        if (!leaving) await refresh(controller.signal);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setSurfaces([]);
          setReady(true);
          setMessage(cause instanceof Error ? cause.message : "Connection interrupted. Try reconnecting.");
        }
      } finally {
        ticking = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), HEARTBEAT_MS);
    const changed = () => void tick();
    const leave = () => {
      leaving = true;
      if (own.current && csrfRef.current)
        void crossdeckRequest(
          { action: "heartbeat", surfaceId: own.current, lifecycle: "DISCONNECTED" },
          csrfRef.current,
          undefined,
          true,
        ).catch(() => {});
    };
    const returned = (event: PageTransitionEvent) => {
      if (event.persisted) {
        leaving = false;
        void tick();
      }
    };
    document.addEventListener("visibilitychange", changed);
    window.addEventListener("online", changed);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", returned);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", changed);
      window.removeEventListener("online", changed);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", returned);
    };
  }, [refresh]);

  const act = useCallback(
    async (body: unknown, success: string): Promise<ActionResult | undefined> => {
      if (actionLock.current) return;
      actionLock.current = true;
      refreshRevision.current++;
      setBusy(true);
      setMessage(success ? "Working on your connection…" : "");
      try {
        const data: ActionResult = await crossdeckRequest(body, csrfRef.current);
        const action = (body as { action?: string }).action;
        if (
          data.surface?.thisSession &&
          (action === "register" || action === "claim" || data.surface.surfaceId === own.current)
        ) {
          sessionStorage.setItem(storageKey(data.surface.voyageId), data.surface.surfaceId);
          own.current = data.surface.surfaceId;
          setOwnId(data.surface.surfaceId);
          setVoyage(data.surface.voyageId);
          setSurfaces((items) => [...items.filter((s) => s.surfaceId !== data.surface!.surfaceId), data.surface!]);
        }
        if ((body as { action?: string }).action !== "heartbeat")
          window.dispatchEvent(new Event("crossdeck-surface-changed"));
        setMessage(success);
        if (!data.surface || data.surface.voyageId === voyage) await refresh(undefined, true);
        return data;
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Try reconnecting in a moment.");
        return undefined;
      } finally {
        actionLock.current = false;
        setBusy(false);
      }
    },
    [refresh, voyage],
  );
  return {
    voyage,
    setVoyage,
    surfaces,
    voyages,
    here: surfaces.find((s) => s.surfaceId === ownId && s.thisSession),
    csrf,
    ready,
    signedOut,
    busy,
    message,
    setMessage,
    refresh,
    act,
    label,
    setLabel,
  };
}
