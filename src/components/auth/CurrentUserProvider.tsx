"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  CURRENT_USER_CONTEXT_VERSION,
  isCurrentUserContext,
  type CurrentUserClientState,
  type CurrentUserContext,
} from "@/homeport/current-user";

const channelName = "voyagewright-current-user";
const invalidationMessage = { type: "current-user-invalidated", version: 1 } as const;

type CurrentUserValue = {
  state: CurrentUserClientState;
  refresh: () => Promise<CurrentUserContext>;
  invalidate: () => Promise<CurrentUserContext>;
};

const CurrentUserReactContext = createContext<CurrentUserValue | null>(null);

function unavailableContext(): CurrentUserContext {
  return {
    contextVersion: CURRENT_USER_CONTEXT_VERSION,
    status: "unavailable",
    authenticated: false,
    correlationId: "client-context-read-failed",
    retryable: true,
  };
}

function sameContext(previous: CurrentUserClientState, next: CurrentUserContext) {
  if (previous.status === "loading" || previous.status !== next.status) return false;
  if (previous.status === "authenticated" && next.status === "authenticated")
    return previous.revision === next.revision;
  if (previous.status === "restricted" && next.status === "restricted") return previous.reason === next.reason;
  if (previous.status === "unavailable" && next.status === "unavailable")
    return previous.correlationId === next.correlationId;
  return true;
}

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CurrentUserClientState>({ status: "loading", authenticated: false });
  const channel = useRef<BroadcastChannel | null>(null);
  const lastRefreshAt = useRef(0);
  const requestGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const response = await fetch("/api/auth/context", { cache: "no-store", credentials: "same-origin" });
      const body: unknown = await response.json().catch(() => null);
      const next = isCurrentUserContext(body) ? body : unavailableContext();
      if (generation === requestGeneration.current) {
        setState((previous) => (sameContext(previous, next) ? previous : next));
        if (next.status === "authenticated") sessionStorage.setItem("wayfarer-csrf", next.csrfToken);
        else sessionStorage.removeItem("wayfarer-csrf");
        lastRefreshAt.current = Date.now();
      }
      return next;
    } catch {
      const next = unavailableContext();
      if (generation === requestGeneration.current) {
        setState((previous) => (sameContext(previous, next) ? previous : next));
        sessionStorage.removeItem("wayfarer-csrf");
        lastRefreshAt.current = Date.now();
      }
      return next;
    }
  }, []);

  const invalidate = useCallback(async () => {
    channel.current?.postMessage(invalidationMessage);
    return refresh();
  }, [refresh]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const refetchOnFocus = () => {
      if (Date.now() - lastRefreshAt.current >= 1_000) void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAt.current >= 1_000) void refresh();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", visible);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(channelName);
      channel.current.addEventListener("message", (event) => {
        if (event.data?.type === invalidationMessage.type && event.data?.version === invalidationMessage.version)
          void refresh();
      });
    }
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", visible);
      channel.current?.close();
      channel.current = null;
    };
  }, [refresh]);

  return (
    <CurrentUserReactContext.Provider value={{ state, refresh, invalidate }}>
      {children}
    </CurrentUserReactContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(CurrentUserReactContext);
  if (!context) throw new Error("useCurrentUser must be used inside CurrentUserProvider.");
  return context;
}
