/** Private native/provider requests are bounded before parsing or external work. */
export async function readLandfallBoundedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  const chunks: Uint8Array[] = [];
  let length = 0,
    cancelled = false;
  const cancel = () => {
    cancelled = true;
    void reader.cancel().catch(() => undefined);
  };
  const timer = setTimeout(cancel, 3000);
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) cancel();
  try {
    for (;;) {
      const value = await reader.read();
      if (value.done) break;
      length += value.value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value.value);
    }
    if (cancelled) throw new Error("INVALID_BODY");
    const bytes = Buffer.concat(chunks);
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } finally {
      bytes.fill(0);
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
    for (const chunk of chunks) chunk.fill(0);
    chunks.length = 0;
  }
}
