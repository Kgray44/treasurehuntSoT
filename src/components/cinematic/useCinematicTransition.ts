"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MotionMode = "full" | "gentle" | "reduced";
export type TransitionStage = { name: string; duration: number; gentle?: number; reduced?: number };
export type TransitionPlan = {
  opening: readonly TransitionStage[];
  success?: readonly TransitionStage[];
  failure?: readonly TransitionStage[];
};

const wait = (duration: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = window.setTimeout(resolve, duration);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });

function durationFor(stage: TransitionStage, mode: MotionMode) {
  if (mode === "reduced") return stage.reduced ?? Math.min(stage.duration, 120);
  if (mode === "gentle") return stage.gentle ?? Math.min(stage.duration, 420);
  return stage.duration;
}

export function useCinematicTransition(mode: MotionMode) {
  const [name, setName] = useState("dormant");
  const [stage, setStage] = useState("settled");
  const [isPlaying, setPlaying] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const skip = useCallback(() => controller.current?.abort(), []);
  const runStages = useCallback(
    async (stages: readonly TransitionStage[], signal: AbortSignal) => {
      for (const next of stages) {
        if (signal.aborted) break;
        setStage(next.name);
        await wait(durationFor(next, mode), signal);
      }
    },
    [mode],
  );

  const play = useCallback(
    async <T>(sequenceName: string, plan: TransitionPlan, operation?: () => Promise<T>) => {
      if (running.current) throw new Error("A cinematic transition is already underway.");
      running.current = true;
      setPlaying(true);
      setName(sequenceName);
      const abort = new AbortController();
      controller.current = abort;
      try {
        const operationPromise = operation?.().then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        );
        await runStages(plan.opening, abort.signal);
        if (abort.signal.aborted) return undefined;
        let result: T | undefined;
        try {
          if (operationPromise) {
            const settled = await operationPromise;
            if (!settled.ok) throw settled.error;
            result = settled.value;
          }
        } catch (error) {
          await runStages(plan.failure ?? [], abort.signal);
          throw error;
        }
        await runStages(plan.success ?? [], abort.signal);
        return result;
      } finally {
        setStage("settled");
        setPlaying(false);
        setName("dormant");
        controller.current = null;
        running.current = false;
      }
    },
    [runStages],
  );

  useEffect(() => {
    const visibility = () => document.documentElement.classList.toggle("cinematic-hidden", document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      controller.current?.abort();
      document.removeEventListener("visibilitychange", visibility);
      document.documentElement.classList.remove("cinematic-hidden");
    };
  }, []);
  return { name, stage, isPlaying, play, skip, cancel };
}
