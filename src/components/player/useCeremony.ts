"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientProgressEvent } from "@/domain/story";

export const ceremonyStages = ["omen", "attention", "seal", "parchment", "ink-heading", "ink-story", "ink-objective", "ink-riddle", "map", "active"] as const;
export type CeremonyStage = (typeof ceremonyStages)[number] | "idle";
export const getCeremonyStages = (reducedMotion: boolean) => reducedMotion ? (["attention", "ink-heading", "ink-objective", "ink-riddle", "map", "active"] as const) : ceremonyStages;
const timing = { omen: 650, attention: 550, seal: 900, parchment: 800, "ink-heading": 350, "ink-story": 700, "ink-objective": 450, "ink-riddle": 900, map: 700, active: 250 } as const;
const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => { const id = window.setTimeout(resolve, ms); signal.addEventListener("abort", () => { clearTimeout(id); resolve(); }, { once: true }); });

export function useCeremony({ reducedMotion, onComplete }: { reducedMotion: boolean; onComplete: (event: ClientProgressEvent) => void }) {
  const [stage, setStage] = useState<CeremonyStage>("idle"); const [current, setCurrent] = useState<ClientProgressEvent | null>(null); const queue = useRef<ClientProgressEvent[]>([]); const running = useRef(false); const controller = useRef<AbortController | null>(null);
  const process = useCallback(async () => {
    if (running.current || !queue.current.length) return; running.current = true;
    while (queue.current.length) { const event = queue.current.shift()!; setCurrent(event); const abort = new AbortController(); controller.current = abort; const stages = getCeremonyStages(reducedMotion);
      for (const next of stages) { if (abort.signal.aborted) break; setStage(next); await wait(reducedMotion ? Math.min(timing[next], 120) : timing[next], abort.signal); }
      setStage("active"); onComplete(event); controller.current = null; await wait(300, new AbortController().signal); setStage("idle"); setCurrent(null);
    }
    running.current = false;
  }, [onComplete, reducedMotion]);
  const enqueue = useCallback((event: ClientProgressEvent) => { if (queue.current.some((item) => item.id === event.id) || current?.id === event.id) return; queue.current.push(event); queue.current.sort((a, b) => a.sequence - b.sequence); void process(); }, [current?.id, process]);
  const skip = useCallback(() => controller.current?.abort(), []);
  const replay = useCallback((event: ClientProgressEvent) => { queue.current.push({ ...event, id: `${event.id}:replay:${Date.now()}` }); void process(); }, [process]);
  useEffect(() => () => controller.current?.abort(), []);
  return { stage, current, enqueue, skip, replay, isPlaying: current !== null };
}
