"use client";

import { useContext, useSyncExternalStore } from "react";
import { AnimationDirectorContext } from "./AnimationProvider";

export function useAnimationDirector() {
  const director = useContext(AnimationDirectorContext);
  if (!director) throw new Error("useAnimationDirector must be used inside AnimationProvider.");
  const snapshot = useSyncExternalStore(director.subscribe, director.getSnapshot, director.getSnapshot);
  return { director, snapshot };
}
