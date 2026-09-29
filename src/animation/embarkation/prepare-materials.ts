/** A bounded, abortable preparation job. No DOM or application content crosses
 * this boundary: only material geometry and physical states enter the worker. */
export function prepareMaterials<T>(payload: object, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./cloth-worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    worker.onmessage = (event) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.caches);
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "Material preparation worker failed"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.postMessage(payload);
  });
}
