import { projectCapabilities, type SurfaceCapabilities } from "./contracts";
import { webSextantRuntime } from "@/sextant/web-runtime";
import type { WebSensorTarget } from "@/sextant/web-provider";
export const storageKey = (voyage: string) => `crossdeck.surface.v1:${voyage}`;
export function browserProjection(): SurfaceCapabilities {
  const width = window.innerWidth;
  const runtime = webSextantRuntime(window as unknown as WebSensorTarget, navigator);
  return projectCapabilities(
    {
      formFactor: "UNKNOWN",
      viewportClass: width < 600 ? "COMPACT" : width < 1000 ? "MEDIUM" : "WIDE",
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
    (id) => runtime.projectCapability(id),
  );
}
export async function crossdeckRequest(body: unknown, csrfToken: string, signal?: AbortSignal, keepalive = false) {
  const response = await fetch("/api/crossdeck", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(body),
    signal,
    keepalive,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "That device could not connect.");
  return result;
}
