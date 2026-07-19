"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AuthoritativeAsyncPhase =
  | "idle"
  | "pending"
  | "slow"
  | "success"
  | "recoverable-error"
  | "terminal-error"
  | "cancelled";

export type AuthoritativeAsyncRun = Readonly<{ id: number; controller: AbortController }>;

export function useAuthoritativeAsyncState(slowAfterMs = 900) {
  const mounted = useRef(true);
  const sequence = useRef(0);
  const active = useRef<(AuthoritativeAsyncRun & { timer: ReturnType<typeof setTimeout> }) | null>(null);
  const [phase, setPhase] = useState<AuthoritativeAsyncPhase>("idle");
  const [busy, setBusy] = useState(false);

  const clear = useCallback((run: AuthoritativeAsyncRun) => {
    if (active.current?.id !== run.id) return false;
    clearTimeout(active.current.timer);
    return true;
  }, []);

  const begin = useCallback((): AuthoritativeAsyncRun | null => {
    if (active.current) return null;
    const run = { id: ++sequence.current, controller: new AbortController() };
    const timer = setTimeout(() => {
      if (mounted.current && active.current?.id === run.id && !run.controller.signal.aborted) setPhase("slow");
    }, slowAfterMs);
    active.current = { ...run, timer };
    setBusy(true);
    setPhase("pending");
    return run;
  }, [slowAfterMs]);

  const isCurrent = useCallback(
    (run: AuthoritativeAsyncRun) => mounted.current && active.current?.id === run.id && !run.controller.signal.aborted,
    [],
  );

  const succeed = useCallback(
    (run: AuthoritativeAsyncRun) => {
      if (!isCurrent(run) || !clear(run)) return false;
      setPhase("success");
      return true;
    },
    [clear, isCurrent],
  );

  const fail = useCallback(
    (run: AuthoritativeAsyncRun, terminal = false) => {
      if (!isCurrent(run) || !clear(run)) return false;
      active.current = null;
      setBusy(false);
      setPhase(terminal ? "terminal-error" : "recoverable-error");
      return true;
    },
    [clear, isCurrent],
  );

  const cancel = useCallback((reason = "cancelled") => {
    const current = active.current;
    if (!current) return;
    clearTimeout(current.timer);
    current.controller.abort(reason);
    active.current = null;
    if (mounted.current) {
      setBusy(false);
      setPhase("cancelled");
    }
  }, []);

  const reset = useCallback((reason = "reset") => {
    const current = active.current;
    if (current) {
      clearTimeout(current.timer);
      current.controller.abort(reason);
      active.current = null;
    }
    if (mounted.current) {
      setBusy(false);
      setPhase("idle");
    }
  }, []);

  const release = useCallback((run: AuthoritativeAsyncRun, next: AuthoritativeAsyncPhase = "idle") => {
    if (active.current?.id !== run.id) return false;
    clearTimeout(active.current.timer);
    active.current = null;
    if (mounted.current) {
      setBusy(false);
      setPhase(next);
    }
    return true;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = active.current;
      if (current) {
        clearTimeout(current.timer);
        current.controller.abort("unmounted");
        active.current = null;
      }
    };
  }, []);

  return { phase, busy, begin, isCurrent, succeed, fail, cancel, reset, release };
}
