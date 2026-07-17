"use client";

import { useCallback, useEffect, useState } from "react";
import type { MotionMode } from "../core/animation-types";
import { resolveMotionMode } from "../core/quality";
import { useAnimationDirector } from "../director/useAnimationDirector";

const order: MotionMode[] = ["full", "gentle", "reduced"];

export function useMotionMode() {
  const systemReduced = useSystemReducedMotion();
  const [productMode, setProductMode] = useState<MotionMode>("full");
  const { director } = useAnimationDirector();
  const mode = resolveMotionMode(productMode, systemReduced);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      const saved = localStorage.getItem("forever-motion") as MotionMode | null;
      if (!cancelled && saved && order.includes(saved)) setProductMode(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => director.setMode(mode), [director, mode]);
  const setMode = useCallback((next: MotionMode) => {
    setProductMode(next);
    localStorage.setItem("forever-motion", next);
  }, []);
  const cycle = useCallback(
    () => setMode(order[(order.indexOf(productMode) + 1) % order.length]),
    [productMode, setMode],
  );
  return { mode, productMode, systemReduced, setMode, cycle };
}

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
