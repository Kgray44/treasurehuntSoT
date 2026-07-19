"use client";

import { useMotionPolicyContext } from "./MotionPolicyContext";

export function useMotionMode() {
  return useMotionPolicyContext();
}
