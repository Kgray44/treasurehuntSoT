/** Bound browser startup work so permissions, downloads and WASM initialization
 * cannot hold a camera lease indefinitely. The caller owns resource cleanup.
 */
export function waitForTrackingOperation<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  timeoutMessage: string,
  timeoutMs = 15000,
): Promise<T> {
  if (signal.aborted) {
    // The browser operation may already be in flight; consume its late failure
    // while returning the cancellation outcome to its resource owner.
    void operation.catch(() => {});
    return Promise.reject(new Error("Browser AR opening was cancelled."));
  }
  return new Promise<T>((resolve, reject) => {
    const finish = (action: () => void) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      action();
    };
    const cancel = () => finish(() => reject(new Error("Browser AR opening was cancelled.")));
    const timer = setTimeout(() => finish(() => reject(new Error(timeoutMessage))), timeoutMs);
    signal.addEventListener("abort", cancel, { once: true });
    operation.then(
      (result) => finish(() => resolve(result)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}
