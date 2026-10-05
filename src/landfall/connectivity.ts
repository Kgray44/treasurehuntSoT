import type { ConnectivityState } from "@/landfall/provider-policy";

/** Browser online is only a hint. A fresh same-origin challenge proves application reachability. */
export class LandfallConnectivityProvider {
  private inFlight: Promise<{ state: ConnectivityState; latencyMs: number }> | null = null;
  constructor(
    private readonly origin: string,
    private readonly transport: typeof fetch = fetch,
    private readonly now = () => performance.now(),
  ) {
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      (parsed.protocol !== "https:" &&
        !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)))
    )
      throw new Error("LANDFALL_CONNECTIVITY_ORIGIN_INVALID");
  }
  probe(onlineHint?: boolean): Promise<{ state: ConnectivityState; latencyMs: number }> {
    if (onlineHint === false) return Promise.resolve({ state: "OFFLINE", latencyMs: 0 });
    if (this.inFlight) return this.inFlight;
    const task = this.run();
    this.inFlight = task;
    void task.finally(() => {
      if (this.inFlight === task) this.inFlight = null;
    });
    return task;
  }
  private async run(): Promise<{ state: ConnectivityState; latencyMs: number }> {
    const challenge = crypto.randomUUID();
    const started = this.now();
    const elapsed = () => Math.max(0, this.now() - started);
    try {
      const response = await this.transport(`${this.origin}/api/landfall/connectivity?challenge=${challenge}`, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return { state: "DEGRADED", latencyMs: elapsed() };
      if (
        response.headers.get("content-type")?.split(";")[0] !== "application/json" ||
        Number(response.headers.get("content-length") ?? 0) > 512 ||
        !response.body
      )
        return { state: "CAPTIVE_OR_UNUSABLE", latencyMs: elapsed() };
      const reader = response.body.getReader();
      let text = "";
      const decoder = new TextDecoder();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          text += decoder.decode(chunk.value, { stream: true });
          if (text.length > 512) {
            await reader.cancel();
            return { state: "CAPTIVE_OR_UNUSABLE", latencyMs: elapsed() };
          }
        }
      } finally {
        reader.releaseLock();
      }
      const data: unknown = JSON.parse(text);
      if (
        !data ||
        typeof data !== "object" ||
        Object.keys(data).length !== 2 ||
        !("challenge" in data) ||
        data.challenge !== challenge ||
        !("landfall" in data) ||
        data.landfall !== "reachable"
      )
        return { state: "CAPTIVE_OR_UNUSABLE", latencyMs: elapsed() };
      const latencyMs = elapsed();
      return { state: latencyMs > 1500 ? "DEGRADED" : "ONLINE", latencyMs };
    } catch {
      return { state: "UNKNOWN", latencyMs: elapsed() };
    }
  }
}
