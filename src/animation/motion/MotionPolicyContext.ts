"use client";

import { createContext, useContext } from "react";
import type { MotionMode, ResolvedMotionPolicy } from "../core/animation-types";

export type MotionPolicyContextValue = {
  ready: boolean;
  policy: ResolvedMotionPolicy;
  mode: MotionMode;
  productMode: MotionMode;
  systemReduced: boolean;
  setMode: (mode: MotionMode) => void;
  cycle: () => void;
};

export const MotionPolicyContext = createContext<MotionPolicyContextValue | null>(null);

export function useOptionalMotionPolicyContext() {
  return useContext(MotionPolicyContext);
}

export function useMotionPolicyContext() {
  const context = useOptionalMotionPolicyContext();
  if (!context) throw new Error("useMotionMode must be used inside AnimationProvider.");
  return context;
}
