"use client";

import { createContext, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import type { MotionMode } from "../core/animation-types";
import { isMotionMode, motionModeOrder, resolveMotionPolicy } from "../core/quality";
import { MotionPolicyContext, useMotionPolicyContext } from "../motion/MotionPolicyContext";
import { AnimationDirector } from "./AnimationDirector";

export const AnimationDirectorContext = createContext<AnimationDirector | null>(null);

const motionStorageKey = "forever-motion";
const rootMotionOwners = new WeakMap<HTMLElement, symbol>();

function readStoredMotionMode(): MotionMode {
  try {
    const stored = localStorage.getItem(motionStorageKey);
    if (isMotionMode(stored)) return stored;
    if (stored !== null) localStorage.removeItem(motionStorageKey);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return "full";
}

function storeMotionMode(mode: MotionMode) {
  try {
    localStorage.setItem(motionStorageKey, mode);
  } catch {
    // The in-memory provider remains authoritative when persistence is unavailable.
  }
}

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const director = useMemo(() => new AnimationDirector("full"), []);
  const rootMotionOwner = useMemo(() => Symbol("animation-provider-motion"), []);
  const [productMode, setProductMode] = useState<MotionMode>("full");
  const [systemReduced, setSystemReduced] = useState(false);
  const policy = useMemo(() => resolveMotionPolicy(productMode, systemReduced), [productMode, systemReduced]);
  const snapshot = useSyncExternalStore(director.subscribe, director.getSnapshot, director.getSnapshot);

  useEffect(() => {
    let cancelled = false;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateSystemPreference = () => setSystemReduced(query.matches);
    queueMicrotask(() => {
      if (!cancelled) setProductMode(readStoredMotionMode());
    });
    updateSystemPreference();
    query.addEventListener("change", updateSystemPreference);
    return () => {
      cancelled = true;
      query.removeEventListener("change", updateSystemPreference);
    };
  }, []);

  useEffect(() => {
    director.setMotionPolicy(policy);
  }, [director, policy]);

  useEffect(() => {
    const root = document.documentElement;
    rootMotionOwners.set(root, rootMotionOwner);
    root.setAttribute("data-motion-level", policy.level);
  }, [policy.level, rootMotionOwner]);

  useEffect(
    () => () => {
      director.kill();
      const root = document.documentElement;
      if (rootMotionOwners.get(root) === rootMotionOwner) {
        rootMotionOwners.delete(root);
        root.removeAttribute("data-motion-level");
      }
    },
    [director, rootMotionOwner],
  );

  const setMode = useCallback((next: MotionMode) => {
    if (!isMotionMode(next)) return;
    setProductMode(next);
    storeMotionMode(next);
  }, []);
  const cycle = useCallback(
    () => setMode(motionModeOrder[(motionModeOrder.indexOf(productMode) + 1) % motionModeOrder.length]),
    [productMode, setMode],
  );
  const motionContext = useMemo(
    () => ({ policy, mode: policy.level, productMode, systemReduced, setMode, cycle }),
    [cycle, policy, productMode, setMode, systemReduced],
  );

  return (
    <AnimationDirectorContext.Provider value={director}>
      <MotionPolicyContext.Provider value={motionContext}>
        <MotionConfig
          reducedMotion={policy.level === "reduced" ? "always" : "never"}
          transition={{ duration: snapshot.mode === "full" ? 0.38 : snapshot.mode === "gentle" ? 0.16 : 0.01 }}
        >
          {children}
        </MotionConfig>
      </MotionPolicyContext.Provider>
    </AnimationDirectorContext.Provider>
  );
}

export function useProductMotionMode() {
  return useMotionPolicyContext().productMode;
}
