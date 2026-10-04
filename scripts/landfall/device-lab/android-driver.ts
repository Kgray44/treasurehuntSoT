/** Android connection primitives do not inherit Page action timeouts. Cleanup is still owned by the caller. */
export async function boundedAndroidDriver<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
  timeout = 20000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new Error("LANDFALL_NATIVE_NEARBY_CANCELLED"));
        if (signal?.aborted) onAbort();
        else signal?.addEventListener("abort", onAbort, { once: true });
        timer = setTimeout(() => reject(new Error("LANDFALL_NATIVE_NEARBY_DRIVER_TIMEOUT")), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}
