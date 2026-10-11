"use client";
import { createContext, useContext, useRef, useMemo, useState, type ReactNode } from "react";
import type { Continuity } from "@/crossdeck/sync-contracts";

type Bridge = { capture: () => Continuity; resume: (context: Continuity) => void | Promise<void> };
const Context = createContext<{
  readonly current: Bridge | null;
  register: (value: Bridge) => () => void;
  changes: EventTarget;
} | null>(null);
export function CrossdeckContinuityProvider({ children }: { children: ReactNode }) {
  const bridge = useRef<Bridge | null>(null);
  const [changes] = useState(() => new EventTarget());
  const shared = useMemo(
    () => ({
      get current() {
        return bridge.current;
      },
      register(value: Bridge) {
        bridge.current = value;
        return () => {
          if (bridge.current === value) bridge.current = null;
        };
      },
      changes,
    }),
    [changes],
  );
  return <Context.Provider value={shared}>{children}</Context.Provider>;
}
export const useCrossdeckContinuity = () => useContext(Context);
