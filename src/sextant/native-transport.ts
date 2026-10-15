import { landfallNativeHost, landfallNativeRequest } from "@/landfall/native-bridge";
import type { SextantNativeTransport } from "./native-provider";

/** Reuses the companion's exact-origin transport. No new global, message
 * channel or sensor acquisition is created by capability discovery. */
export function createSextantNativeTransport(): SextantNativeTransport | null {
  const host = landfallNativeHost();
  if (!host) return null;
  return {
    platform: host.platform,
    request: landfallNativeRequest,
    subscribe(listener) {
      const receive = (event: Event) => listener((event as CustomEvent).detail);
      window.addEventListener("landfall-native-event", receive);
      return () => window.removeEventListener("landfall-native-event", receive);
    },
  };
}
