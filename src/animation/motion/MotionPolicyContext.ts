"use client";

import { createContext, useContext } from "react";
import type { MotionMode, ResolvedMotionPolicy } from "../core/animation-types";

export type MotionPolicyContextValue = {
  policy: ResolvedMotionPolicy;
  mode: MotionMode;
  productMode: MotionMode;
  systemReduced: boolean;
  setMode: (mode: MotionMode) => void;
  cycle: () => void;
};

export const MotionPolicyContext = createContext<MotionPolicyContextValue | null>(null);

export function useMotionPolicyContext() {
  const context = useContext(MotionPolicyContext);
  if (!context) throw new Error("useMotionMode must be used inside AnimationProvider.");
  return context;
}
