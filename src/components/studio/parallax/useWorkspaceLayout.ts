"use client";
import { useEffect, useRef, useState } from "react";
import { readWorkspaceLayout, workspacePreset, type WorkspaceLayout } from "@/parallax/workspace-layout";

/** Account-scoped browser presentation preferences, independent of every authored draft and release. */
export function useWorkspaceLayout(scope?: string) {
  const [layout, setLayout] = useState<WorkspaceLayout>(() => workspacePreset("SPATIAL"));
  const hydratedScope = useRef<string | null>(null);
  useEffect(() => {
    if (!scope || hydratedScope.current === scope) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(`parallax.workspace.v1:${scope}`);
      } catch {}
      hydratedScope.current = scope;
      const restored = readWorkspaceLayout(raw);
      setLayout(
        innerWidth < 1100 ? { ...restored, libraryOpen: false, inspectorOpen: false, bottomOpen: false } : restored,
      );
    });
    return () => {
      active = false;
    };
  }, [scope]);
  useEffect(() => {
    const narrow = matchMedia("(max-width: 1099px)");
    const collapse = () => {
      if (narrow.matches) setLayout((previous) => ({ ...previous, libraryOpen: false, inspectorOpen: false }));
    };
    narrow.addEventListener("change", collapse);
    return () => narrow.removeEventListener("change", collapse);
  }, []);
  useEffect(() => {
    if (!scope || hydratedScope.current !== scope) return;
    try {
      localStorage.setItem(`parallax.workspace.v1:${scope}`, JSON.stringify(layout));
    } catch {}
  }, [layout, scope]);
  return {
    layout,
    setLayout,
    reset: () => setLayout(workspacePreset("SPATIAL")),
    choose: (preset: WorkspaceLayout["preset"]) =>
      setLayout((previous) => {
        const next = workspacePreset(preset, previous);
        return innerWidth < 1100 ? { ...next, inspectorOpen: false, libraryOpen: preset === "CONSTRUCTION" } : next;
      }),
  };
}
