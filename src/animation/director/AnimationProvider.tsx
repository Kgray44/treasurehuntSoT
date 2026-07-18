"use client";

import { createContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import type { MotionMode } from "../core/animation-types";
import { AnimationDirector } from "./AnimationDirector";

export const AnimationDirectorContext = createContext<AnimationDirector | null>(null);

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const director = useMemo(() => new AnimationDirector("full"), []);
  const snapshot = useSyncExternalStore(director.subscribe, director.getSnapshot, director.getSnapshot);
  useEffect(() => () => director.kill(), [director]);
  return (
    <AnimationDirectorContext.Provider value={director}>
      <MotionConfig
        reducedMotion="never"
        transition={{ duration: snapshot.mode === "full" ? 0.38 : snapshot.mode === "gentle" ? 0.16 : 0.01 }}
      >
        {children}
      </MotionConfig>
    </AnimationDirectorContext.Provider>
  );
}

export function useProductMotionMode() {
  const stored = typeof window === "undefined" ? null : (localStorage.getItem("forever-motion") as MotionMode | null);
  return stored ?? "full";
}
