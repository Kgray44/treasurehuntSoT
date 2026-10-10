import { projectCapabilities, type SurfaceCapabilities } from "./contracts";
export const storageKey = (voyage: string) => `crossdeck.surface.v1:${voyage}`;
export function browserProjection(): SurfaceCapabilities {
  const width = window.innerWidth;
  return projectCapabilities({
    formFactor: "UNKNOWN",
    viewportClass: width < 600 ? "COMPACT" : width < 1000 ? "MEDIUM" : "WIDE",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
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
