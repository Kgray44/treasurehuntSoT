"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  reachRuntimePolicyEnvelopeSchema,
  type ReachRuntimePolicy,
  type ReachRuntimePolicyEnvelope,
} from "./runtime-policy";

export type ReachPolicyStatus = "LOADING" | "READY" | "DISABLED" | "UNAVAILABLE";
type PolicyState = {
  status: ReachPolicyStatus;
  policy: ReachRuntimePolicy | null;
  revision: number | null;
};
const refreshIntervalMs = 15000;
const maximumPolicyAgeMs = 30000;
const requestTimeoutMs = 5000;
const unavailable: PolicyState = { status: "UNAVAILABLE", policy: null, revision: null };

/** Mandatory server policy; no persisted client preference or fallback override. */
export function useReachRuntimePolicy() {
  const [state, setState] = useState<PolicyState>({ status: "LOADING", policy: null, revision: null });
  const alive = useRef(false);
  const cache = useRef<{ envelope: ReachRuntimePolicyEnvelope; receivedAt: number } | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const expiration = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const publishCache = useCallback(() => {
    const saved = cache.current;
    if (!saved || performance.now() - saved.receivedAt >= maximumPolicyAgeMs) {
      cache.current = null;
      if (alive.current) setState(unavailable);
      return;
    }
    if (alive.current)
      setState({
        status: saved.envelope.policy.featureEnabled ? "READY" : "DISABLED",
        policy: saved.envelope.policy,
        revision: saved.envelope.revision,
      });
  }, []);
  const refresh = useCallback(async () => {
    if (!alive.current) return;
    if (cache.current) publishCache();
    if (document.visibilityState !== "visible" || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    let onAbort = () => {};
    try {
      const aborted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new Error("REACH_POLICY_REQUEST_ABORTED"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const load = async () => {
        const response = await fetch("/api/reach/policy", {
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("REACH_POLICY_UNAVAILABLE");
        return reachRuntimePolicyEnvelopeSchema.parse(await response.json());
      };
      const envelope = await Promise.race([load(), aborted]);
      if (!alive.current || inFlight.current !== controller || controller.signal.aborted) return;
      cache.current = { envelope, receivedAt: performance.now() };
      clearTimeout(expiration.current);
      expiration.current = setTimeout(publishCache, maximumPolicyAgeMs);
      publishCache();
    } catch {
      if (alive.current && inFlight.current === controller) publishCache();
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", onAbort);
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [publishCache]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const poll = setInterval(() => void refresh(), refreshIntervalMs);
    const focused = () => void refresh();
    window.addEventListener("focus", focused);
    document.addEventListener("visibilitychange", focused);
    return () => {
      alive.current = false;
      clearInterval(poll);
      clearTimeout(expiration.current);
      inFlight.current?.abort();
      inFlight.current = null;
      window.removeEventListener("focus", focused);
      document.removeEventListener("visibilitychange", focused);
    };
  }, [refresh]);
  return { ...state, refresh };
}
